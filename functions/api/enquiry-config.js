// Public, non-secret configuration for the enquiry forms: the
// Turnstile SITE key (public by design) when Turnstile is enabled.
// The secret key never leaves the server.
import { turnstileEnabled } from "./_shared/abuse.js";

export async function onRequestGet(context) {
  const { env } = context;
  const body = { turnstileSiteKey: turnstileEnabled(env) ? env.TURNSTILE_SITE_KEY.trim() : null };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
