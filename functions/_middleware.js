// Keeps internal project files off the public website.
//
// The site deploys the repository root, so without this, internal files
// (project docs, the README, test scripts, the env example, image notes)
// would be readable at their URLs. Every request passes through this
// middleware (there is deliberately no _routes.json): Cloudflare matches
// _routes.json against the raw URL but decodes it when serving files, so
// an encoded path such as /%52EADME.md would skip a route-limited Function
// and still reach the file. Here the path is decoded before it is checked;
// public requests go straight on. The source files stay in the repository -
// only public web access is removed.

const PRIVATE_EXACT = new Set(["/README.md", "/docs", "/tests"]);
const PRIVATE_PREFIXES = ["/docs/", "/tests/", "/functions/", "/supabase/"];

export function isPrivatePath(pathname) {
  let p = pathname;
  try { p = decodeURIComponent(pathname); } catch { /* keep raw */ }
  p = p.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  if (PRIVATE_EXACT.has(p)) return true;
  if (PRIVATE_PREFIXES.some((prefix) => p.startsWith(prefix))) return true;
  const segments = p.split("/").filter(Boolean);
  // Any dotfile or dot-directory anywhere in the path (.env.example,
  // .gitignore, .git/..., .well-known is NOT used by this site) and any
  // Markdown file anywhere (assets/images/README.md and the like) are
  // internal. ".." never reaches a file on Pages but is treated as
  // private too rather than passed on.
  if (segments.some((s) => s.startsWith("."))) return true;
  if (segments.length && /\.(md|markdown)$/i.test(segments[segments.length - 1])) return true;
  return false;
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
