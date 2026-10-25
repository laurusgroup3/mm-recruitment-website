// Abuse-protection coverage for functions/api/send-enquiry.js and
// functions/api/enquiry-config.js: origin enforcement, JSON-only,
// header-injection stripping, honeypot, optional Turnstile. Real
// Functions with fetch mocked - no network.
// Usage: node --test tests/   (no dependencies)

import { test } from "node:test";
import assert from "node:assert/strict";
import { onRequestPost, onRequestOptions, GENERIC_REJECTION_MESSAGE } from "../functions/api/send-enquiry.js";
import { onRequestGet as configGet } from "../functions/api/enquiry-config.js";

const SITE = "https://mmrecruitmentltd.co.uk";
const ENV = { RESEND_API_KEY: "re_test_key", RESEND_FROM_ADDRESS: "MM <no-reply@mm.test>", MM_ENQUIRY_NOTIFICATION_EMAIL: "enquiries@mm.test" };

function goodFields(overrides) {
  return Object.assign({ name: "Jo Bloggs", email: "jo@example.test", phone: "07700 900000", message: "Hello\nthere", consent: "on", company_website: "" }, overrides || {});
}
// `origin: null` / `contentType: null` omit that header entirely (undefined
// would fall back to the defaults).
function request({ origin = SITE, url = SITE + "/api/send-enquiry", contentType = "application/json", body, headers } = {}) {
  const h = Object.assign({}, contentType === null ? {} : { "Content-Type": contentType }, origin === null ? {} : { Origin: origin }, headers || {});
  return new Request(url, { method: "POST", headers: h, body: body !== undefined ? body : JSON.stringify({ formType: "contact", fields: goodFields() }) });
}

// Records Resend and Turnstile calls; every other fetch is an error.
function mock(opts = {}) {
  const sent = [];
  const verified = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith("https://api.resend.com/")) { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ id: "em_1" }), { status: 200 }); }
    if (u.startsWith("https://challenges.cloudflare.com/turnstile/")) {
      verified.push({ secret: init.body.get("secret"), token: init.body.get("response"), remoteip: init.body.get("remoteip") });
      if (opts.turnstileDown) return new Response("bad gateway", { status: 502 });
      const ok = init.body.get("response") === "token-ok";
      return new Response(JSON.stringify(ok ? { success: true, action: opts.action || "enquiry" } : { success: false, "error-codes": ["invalid-input-response"] }), { status: 200 });
    }
    throw new Error("unexpected fetch " + u);
  };
  return { sent, verified, restore: () => { globalThis.fetch = realFetch; } };
}
async function post(req, env = ENV, opts) {
  const m = mock(opts);
  try {
    const res = await onRequestPost({ request: req, env });
    const body = await res.json();
    return { status: res.status, body, headers: res.headers, sent: m.sent, verified: m.verified };
  } finally {
    m.restore();
  }
}

test("a genuine same-origin JSON submission is relayed, with no-store and a same-origin CORS header", async () => {
  const r = await post(request());
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true });
  assert.equal(r.sent.length, 1);
  assert.deepEqual(r.sent[0].to, ["enquiries@mm.test"]);
  assert.equal(r.sent[0].reply_to, "jo@example.test");
  assert.equal(r.sent[0].subject, "New contact enquiry - Jo Bloggs");
  assert.equal(r.headers.get("Cache-Control"), "no-store");
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), SITE);
});

test("the www. production origin and a preview deployment posting to ITSELF are accepted", async () => {
  assert.equal((await post(request({ origin: "https://www.mmrecruitmentltd.co.uk" }))).status, 200);
  const preview = "https://abc123.mm-recruitment-website.pages.dev";
  assert.equal((await post(request({ origin: preview, url: preview + "/api/send-enquiry" }))).status, 200);
});

test("cross-site, missing and 'null' Origins are refused (403, generic message) and nothing is sent", async () => {
  for (const origin of ["https://attacker.example", "https://evil.pages.dev", "https://other-project.pages.dev", "null", null, ""]) {
    const r = await post(request({ origin }));
    assert.equal(r.status, 403, String(origin));
    assert.equal(r.body.message, GENERIC_REJECTION_MESSAGE);
    assert.equal(r.sent.length, 0, String(origin));
    assert.equal(r.headers.get("Access-Control-Allow-Origin"), null, String(origin));
  }
});

test("a preview deployment cannot post to a DIFFERENT preview or to production", async () => {
  const r = await post(request({ origin: "https://abc123.mm-recruitment-website.pages.dev" }));
  assert.equal(r.status, 403);
  assert.equal(r.sent.length, 0);
});

test("non-JSON bodies (a plain cross-site form post) are refused before parsing", async () => {
  for (const ct of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x", null]) {
    const r = await post(request({ contentType: ct, body: "formType=contact" }));
    assert.equal(r.status, 415, ct);
    assert.equal(r.sent.length, 0);
  }
  const bad = await post(request({ body: "{not json" }));
  assert.equal(bad.status, 400);
});

test("CR/LF and control characters in single-line fields never reach the subject; the message keeps its line breaks", async () => {
  const r = await post(request({ body: JSON.stringify({ formType: "employer", fields: goodFields({ name: "Jo\r\nBcc: victim@example.test\u0000", company: "Acme\nLtd", hiringNeed: "x\ry", message: "line one\r\nline two" }) }) }));
  assert.equal(r.status, 200);
  assert.equal(r.sent[0].subject, "New employer enquiry - Jo Bcc: victim@example.test");
  assert.doesNotMatch(r.sent[0].subject, /[\r\n\u0000]/);
  assert.match(r.sent[0].html, /Acme Ltd/);
  assert.match(r.sent[0].html, /line one<br>line two/);
});

test("the reply-to must be a single plausible mailbox", async () => {
  for (const email of ["a,b@c.test", "a@b.test;c@d.test", "a b@c.test", "<a@b.test>", "a@b", "a@b.test\nBcc:x@y.z"]) {
    const r = await post(request({ body: JSON.stringify({ formType: "contact", fields: goodFields({ email }) }) }));
    assert.equal(r.status, 400, email);
    assert.equal(r.sent.length, 0, email);
  }
});

test("honeypot: a filled company_website gets a fake success and sends nothing", async () => {
  const r = await post(request({ body: JSON.stringify({ formType: "contact", fields: goodFields({ company_website: "https://spam.example" }) }) }));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true });
  assert.equal(r.sent.length, 0);
});

test("validation: unknown form type, array payloads and missing consent are refused", async () => {
  assert.equal((await post(request({ body: JSON.stringify({ formType: "admin", fields: goodFields() }) }))).status, 400);
  assert.equal((await post(request({ body: "[]" }))).status, 400);
  assert.equal((await post(request({ body: JSON.stringify({ formType: "contact", fields: goodFields({ consent: "" }) }) }))).status, 400);
});

const TURNSTILE_ENV = Object.assign({}, ENV, { TURNSTILE_SITE_KEY: "site-key", TURNSTILE_SECRET_KEY: "secret-key" });

test("Turnstile off (no secret): submissions work without a token and siteverify is never called", async () => {
  const r = await post(request());
  assert.equal(r.status, 200);
  assert.equal(r.verified.length, 0);
});

test("Turnstile on: a missing or failing token is refused with the generic message; nothing is sent", async () => {
  const missing = await post(request(), TURNSTILE_ENV);
  assert.equal(missing.status, 400);
  assert.equal(missing.body.message, GENERIC_REJECTION_MESSAGE);
  assert.equal(missing.sent.length, 0);
  assert.equal(missing.verified.length, 0, "no token -> no verify call");
  const forged = await post(request({ body: JSON.stringify({ formType: "contact", fields: goodFields(), turnstileToken: "forged" }) }), TURNSTILE_ENV);
  assert.equal(forged.status, 400);
  assert.equal(forged.body.message, GENERIC_REJECTION_MESSAGE);
  assert.equal(forged.sent.length, 0);
});

test("Turnstile on: a valid token is verified with the secret and the visitor IP, then the enquiry is sent", async () => {
  const r = await post(request({ body: JSON.stringify({ formType: "contact", fields: goodFields(), turnstileToken: "token-ok" }), headers: { "CF-Connecting-IP": "203.0.113.9" } }), TURNSTILE_ENV);
  assert.equal(r.status, 200);
  assert.equal(r.verified.length, 1);
  assert.deepEqual(r.verified[0], { secret: "secret-key", token: "token-ok", remoteip: "203.0.113.9" });
  assert.equal(r.sent.length, 1);
});

test("Turnstile on: a token minted for another action is refused; siteverify outage -> 503, not a silent pass", async () => {
  const wrong = await post(request({ body: JSON.stringify({ formType: "contact", fields: goodFields(), turnstileToken: "token-ok" }) }), TURNSTILE_ENV, { action: "login" });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.sent.length, 0);
  const down = await post(request({ body: JSON.stringify({ formType: "contact", fields: goodFields(), turnstileToken: "token-ok" }) }), TURNSTILE_ENV, { turnstileDown: true });
  assert.equal(down.status, 503);
  assert.equal(down.sent.length, 0);
});

test("responses never contain the Resend or Turnstile secret", async () => {
  for (const r of [await post(request(), TURNSTILE_ENV), await post(request({ origin: "https://attacker.example" }), TURNSTILE_ENV)]) {
    const text = JSON.stringify(r.body) + [...r.headers].join(" ");
    assert.equal(text.includes("secret-key"), false);
    assert.equal(text.includes("re_test_key"), false);
  }
});

test("OPTIONS preflight only echoes a trusted origin", async () => {
  const ok = await onRequestOptions({ request: new Request(SITE + "/api/send-enquiry", { method: "OPTIONS", headers: { Origin: SITE } }) });
  assert.equal(ok.headers.get("Access-Control-Allow-Origin"), SITE);
  const bad = await onRequestOptions({ request: new Request(SITE + "/api/send-enquiry", { method: "OPTIONS", headers: { Origin: "https://attacker.example" } }) });
  assert.equal(bad.headers.get("Access-Control-Allow-Origin"), null);
});

test("enquiry-config exposes the site key only, never the secret, and only when configured", async () => {
  const on = await configGet({ env: TURNSTILE_ENV });
  assert.deepEqual(await on.json(), { turnstileSiteKey: "site-key" });
  assert.equal(on.headers.get("Cache-Control"), "no-store");
  const off = await configGet({ env: ENV });
  assert.deepEqual(await off.json(), { turnstileSiteKey: null });
});
