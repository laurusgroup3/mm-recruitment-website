// Internal project documents live in /docs for the team, but must not be
// publicly readable on the website. This Pages Function catches every
// request to /docs and /docs/* (Functions run before static assets) and
// answers with the site's normal 404 page - the source files themselves
// stay in the repository, untouched.

export async function onRequest(context) {
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
    headers: {
      "content-type": type,
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
