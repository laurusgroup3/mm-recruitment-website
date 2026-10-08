// Keeps internal project files off the public website.
//
// The site deploys the repository root, so without this, internal files
// (project docs, the README, test scripts) would be readable at their URLs.
// _routes.json sends only these paths (plus /api/*) through Functions; every
// other request is served straight from static files and never reaches here.
// The source files stay in the repository - only public web access is removed.

const PRIVATE_EXACT = new Set(["/README.md", "/docs", "/tests"]);
const PRIVATE_PREFIXES = ["/docs/", "/tests/"];

export function isPrivatePath(pathname) {
  let p = pathname;
  try { p = decodeURIComponent(pathname); } catch { /* keep raw */ }
  p = p.replace(/\/{2,}/g, "/");
  if (PRIVATE_EXACT.has(p)) return true;
  return PRIVATE_PREFIXES.some((prefix) => p.startsWith(prefix));
}

async function notFound(context) {
  let body = "Not found";
  let type = "text/plain; charset=utf-8";
  try {
    const page = await context.env.ASSETS.fetch(new URL("/404.html", context.request.url));
    if (page.ok) {
      body = await page.text();
      type = "text/html; charset=utf-8";
    }
  } catch {
    // fall back to the plain-text body
  }
  return new Response(context.request.method === "HEAD" ? null : body, {
    status: 404,
    headers: { "content-type": type, "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}

export async function onRequest(context) {
  if (isPrivatePath(new URL(context.request.url).pathname)) return notFound(context);
  return context.next();
}
