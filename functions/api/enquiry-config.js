// Public, read-only: tells the enquiry forms whether Cloudflare Turnstile
// is switched on for this environment and, if so, the SITE key to render
// the widget with. The site key is public by design; the secret key is
// only ever read by send-enquiry.js and never leaves the server.
export async function onRequestGet(context) {
  const siteKey = (context.env.TURNSTILE_SITE_KEY || '').trim();
  return new Response(JSON.stringify({ turnstileSiteKey: siteKey || null }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
