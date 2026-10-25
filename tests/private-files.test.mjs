// Guards that internal files (docs/, README.md, tests/, any Markdown
// file, any dotfile such as .env.example) are never served publicly,
// while the site and its enquiry API keep working.
// Usage: node --test tests/   (no dependencies)

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { onRequest, isPrivatePath } from "../functions/_middleware.js";

const ctx = (path, { method = "GET", assets } = {}) => {
  let nextCalled = false;
  return {
    request: new Request(`https://mmrecruitmentltd.co.uk${path}`, { method }),
    env: { ASSETS: assets || { fetch: async () => new Response("<h1>Page not found</h1>", { status: 200 }) } },
    next: async () => { nextCalled = true; return new Response("public page", { status: 200 }); },
    get nextCalled() { return nextCalled; },
  };
};

const PRIVATE = [
  "/README.md", "/docs", "/docs/", "/docs/LOS-INTEGRATION-PROPOSAL.md", "/docs/DEPLOYMENT.md", "/docs/DESIGN-SYSTEM.md",
  "/tests", "/tests/", "/tests/check-site.mjs", "/tests/private-files.test.mjs",
  "/.env.example", "/.env", "/.gitignore", "/.git/config", "/.git/HEAD", "/assets/images/README.md", "/assets/README.MD",
  "/functions/api/send-enquiry.js", "/supabase/config.toml",
  "/%52EADME.md", "/%64ocs/DEPLOYMENT.md", "/%74ests/check-site.mjs", "/docs%2FDEPLOYMENT.md", "/tests%2fcheck-site.mjs", "//docs/DEPLOYMENT.md",
  "/%2Eenv.example", "/assets/images/%52EADME.md", "/assets%5Cimages%5CREADME.md",
];
const PUBLIC = [
  "/", "/index.html", "/about", "/contact.html", "/assets/css/style.css", "/assets/js/main.js", "/assets/images/mm-recruitment-logo.png",
  "/api/send-enquiry", "/api/enquiry-config", "/docs-and-guides", "/testsuite", "/robots.txt", "/sitemap.xml", "/favicon.ico", "/404.html",
];

test("internal files answer 404 with the site's own not-found page", async () => {
  for (const p of PRIVATE) {
    const c = ctx(p);
    const res = await onRequest(c);
    assert.equal(res.status, 404, p);
    assert.match(await res.text(), /Page not found/, p);
    assert.equal(res.headers.get("x-robots-tag"), "noindex", p);
    assert.equal(res.headers.get("cache-control"), "no-store", p);
    assert.equal(c.nextCalled, false, `${p} must not reach the static file`);
  }
});

test("public pages, assets and the enquiry API pass straight through", async () => {
  for (const p of PUBLIC) {
    const c = ctx(p);
    const res = await onRequest(c);
    assert.equal(res.status, 200, p);
    assert.equal(c.nextCalled, true, p);
    assert.equal(isPrivatePath(p), false, p);
  }
});

test("still a 404 if the 404 page itself can't be loaded; HEAD has no body", async () => {
  const res = await onRequest(ctx("/README.md", { assets: { fetch: async () => { throw new Error("down"); } } }));
  assert.equal(res.status, 404);
  assert.equal(await res.text(), "Not found");
  const head = await onRequest(ctx("/tests/check-site.mjs", { method: "HEAD" }));
  assert.equal(head.status, 404);
  assert.equal(await head.text(), "");
});

test("no _routes.json: every request, including encoded paths, reaches the middleware", () => {
  assert.equal(existsSync(new URL("../_routes.json", import.meta.url)), false, "a route-limited _routes.json lets encoded paths bypass the check");
  assert.ok(existsSync(new URL("../functions/api/send-enquiry.js", import.meta.url)));
});

test("the source files are kept in the repository", () => {
  for (const f of ["../README.md", "../docs/LOS-INTEGRATION-PROPOSAL.md", "../docs/DEPLOYMENT.md", "../docs/DESIGN-SYSTEM.md", "../.env.example", "../assets/images/README.md", "./check-site.mjs"]) {
    assert.ok(existsSync(new URL(f, import.meta.url)), f);
  }
});
