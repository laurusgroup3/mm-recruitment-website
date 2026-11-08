// Spam and abuse controls for the public enquiry endpoint.
//
// Always on (no configuration needed):
//   * a browser Origin header from the production site or this
//     deployment's own origin is required (cross-site relays rejected);
//   * JSON only, body capped at MAX_BODY_BYTES before parsing;
//   * link-stuffing heuristics (too many URLs, BBCode/HTML links).
// Enabled only when BOTH TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY
// are set (so a half-configured environment never blocks every
// enquiry): Cloudflare Turnstile, verified server-side with siteverify,
// checking action and hostname as Cloudflare's guidance requires.
// Volume limiting is a Cloudflare WAF rate-limiting rule on
// /api/send-enquiry (dashboard setting - see docs/DEPLOYMENT.md).

export const PRODUCTION_ORIGINS = ["https://mmrecruitmentltd.co.uk", "https://www.mmrecruitmentltd.co.uk"];
export const MAX_BODY_BYTES = 16 * 1024;
export const MAX_LINKS = 3;
export const TURNSTILE_ACTION = "enquiry";
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function isAllowedOrigin(request) {
  const origin = request.headers.get("Origin") || "";
  if (!origin) return false;
  if (PRODUCTION_ORIGINS.includes(origin)) return true;
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

// Reads the body with a hard size cap. Returns { ok, payload } or
// { ok: false, status }.
export async function readJsonBody(request) {
  const type = (request.headers.get("Content-Type") || "").toLowerCase();
  if (!type.startsWith("application/json")) return { ok: false, status: 415 };
  const declared = Number(request.headers.get("Content-Length") || "0");
  if (declared > MAX_BODY_BYTES) return { ok: false, status: 413 };
  let text;
  try {
    text = await request.text();
  } catch {
    return { ok: false, status: 400 };
  }
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return { ok: false, status: 413 };
  try {
    return { ok: true, payload: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400 };
  }
}

export function looksLikeLinkSpam(text) {
  const s = String(text || "");
  const links = (s.match(/\bhttps?:\/\/|\bwww\.[a-z0-9-]+\./gi) || []).length;
  if (links > MAX_LINKS) return true;
  if (/\[url[=\]]|<a\s+href/i.test(s)) return true;
  return false;
}

export function turnstileEnabled(env) {
  return !!((env.TURNSTILE_SITE_KEY || "").trim() && (env.TURNSTILE_SECRET_KEY || "").trim());
}

// Returns "ok", "failed" (reject as 403) or "unavailable" (reject as 503).
export async function verifyTurnstile(env, request, token) {
  if (typeof token !== "string" || !token || token.length > 2048) return "failed";
  const allowedHosts = new Set(PRODUCTION_ORIGINS.map((o) => new URL(o).hostname));
  try {
    allowedHosts.add(new URL(request.url).hostname);
  } catch {
    // ignore
  }
  let result;
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY.trim(),
        response: token,
        remoteip: request.headers.get("CF-Connecting-IP") || "",
      }),
    });
    if (!res.ok) return "unavailable";
    result = await res.json();
  } catch {
    return "unavailable";
  }
  if (!result || result.success !== true) return "failed";
  if (result.action !== TURNSTILE_ACTION) return "failed";
  if (!allowedHosts.has(result.hostname)) return "failed";
  return "ok";
}
