// Guards that internal /docs files are never served publicly.
// Usage: node --test tests/docs-not-public.test.mjs   (no dependencies)

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { onRequest } from "../functions/docs/[[path]].js";

const ctx = (path, method = "GET", assets) => ({
  request: new Request(`https://mmrecruitmentltd.co.uk${path}`, { method }),
  env: { ASSETS: assets || { fetch: async () => new Response("<h1>Page not found</h1>", { status: 200 }) } },
});

test("every /docs path answers 404 with the site's own not-found page", async () => {
  for (const p of ["/docs", "/docs/", "/docs/LOS-INTEGRATION-PROPOSAL.md", "/docs/DEPLOYMENT.md", "/docs/DESIGN-SYSTEM.md", "/docs/anything/else.md"]) {
    const res = await onRequest(ctx(p));
    assert.equal(res.status, 404, p);
    assert.match(await res.text(), /Page not found/, p);
    assert.equal(res.headers.get("x-robots-tag"), "noindex");
  }
});

test("still a 404 if the 404 page itself can't be loaded", async () => {
  const res = await onRequest(ctx("/docs/DEPLOYMENT.md", "GET", { fetch: async () => { throw new Error("down"); } }));
  assert.equal(res.status, 404);
  assert.equal(await res.text(), "Not found");
});

test("HEAD requests get a 404 with no body", async () => {
  const res = await onRequest(ctx("/docs/DEPLOYMENT.md", "HEAD"));
  assert.equal(res.status, 404);
  assert.equal(await res.text(), "");
});

test("the source documents are kept in the repository", () => {
  const docs = new URL("../docs/", import.meta.url);
  assert.ok(existsSync(docs));
  for (const f of ["LOS-INTEGRATION-PROPOSAL.md", "DEPLOYMENT.md", "DESIGN-SYSTEM.md"]) {
    assert.ok(readdirSync(docs).includes(f), f);
  }
});
