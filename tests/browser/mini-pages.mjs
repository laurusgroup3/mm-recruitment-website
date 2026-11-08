// Minimal local stand-in for Cloudflare Pages: serves static files with
// the site's _headers, routes /api/<name> to functions/api/<name>.js.
// Outbound fetch from Functions is stubbed (records emails, no network).
// Usage: node mini-pages.mjs <siteDir> <port> [envJson]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [site, port, envJson] = [path.resolve(process.argv[2]), Number(process.argv[3]), process.argv[4] || "{}"];
const env = JSON.parse(envJson);
const outbox = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith("https://api.resend.com/")) { outbox.push(JSON.parse(init.body)); return new Response('{"id":"stub"}', { status: 200 }); }
  return realFetch(url, init);
};
const headers = {};
const hp = path.join(site, "_headers");
if (fs.existsSync(hp)) {
  let cur = null;
  for (const line of fs.readFileSync(hp, "utf8").split("\n")) {
    if (line.trim() === "/*") { cur = "all"; continue; }
    if (!line.startsWith(" ")) { cur = null; continue; }
    if (cur && line.includes(":")) { const i = line.indexOf(":"); headers[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  }
}
delete headers["Strict-Transport-Security"];
if (headers["Content-Security-Policy"]) headers["Content-Security-Policy"] = headers["Content-Security-Policy"].replace("; upgrade-insecure-requests", "");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".json": "application/json", ".webp": "image/webp", ".jpg": "image/jpeg" };
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  if (url.pathname === "/__outbox") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify(outbox)); }
  if (url.pathname.startsWith("/api/")) {
    const fn = path.join(site, "functions", url.pathname + ".js");
    if (!fs.existsSync(fn)) { res.writeHead(404); return res.end(); }
    const mod = await import(pathToFileURL(fn).href);
    const method = req.method[0] + req.method.slice(1).toLowerCase();
    const handler = mod["onRequest" + method] || mod.onRequest;
    if (!handler) { res.writeHead(405); return res.end(); }
    const chunks = []; for await (const c of req) chunks.push(c);
    const request = new Request(url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
    const out = await handler({ request, env });
    const h = Object.fromEntries(out.headers); Object.assign(h, headers);
    res.writeHead(out.status, h); return res.end(Buffer.from(await out.arrayBuffer()));
  }
  let file = path.join(site, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
  if (!file.startsWith(site) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, headers); return res.end("not found"); }
  res.writeHead(200, { ...headers, "Content-Type": types[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => console.log("listening " + port));
