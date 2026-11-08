// Regression tests for functions/api/send-enquiry.js (no network:
// fetch is stubbed). Run: node tests/enquiry-api.test.mjs
import assert from 'node:assert/strict';
import { onRequestPost, onRequestOptions } from '../functions/api/send-enquiry.js';
import { onRequestGet as configGet } from '../functions/api/enquiry-config.js';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; } catch (e) { failed++; console.log('  FAIL: ' + name + '\n    ' + e.message); }
}
const ENV = { RESEND_API_KEY: 're_test_dummy', MM_ENQUIRY_NOTIFICATION_EMAIL: 'staff@example.test' };
function req(origin, body, url = 'https://mmrecruitmentltd.co.uk/api/send-enquiry', extraHeaders) {
  const headers = Object.assign({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7' }, extraHeaders || {});
  if (origin !== false) headers.Origin = origin || 'https://mmrecruitmentltd.co.uk';
  return new Request(url, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
}
const good = { formType: 'contact', fields: { name: 'Test Person', email: 'person@example.test', message: 'Hello', consent: true } };
let sent = [];
let siteverify = [];
let siteverifyReply = () => new Response(JSON.stringify({ success: true, action: 'enquiry', hostname: 'mmrecruitmentltd.co.uk' }), { status: 200 });
globalThis.fetch = async (url, init) => {
  if (String(url).includes('challenges.cloudflare.com/turnstile/v0/siteverify')) {
    siteverify.push(Object.fromEntries(new URLSearchParams(String(init.body))));
    return siteverifyReply();
  }
  sent.push({ url, body: JSON.parse(init.body) });
  return new Response('{}', { status: 200 });
};
const TS_ENV = Object.assign({}, ENV, { TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET_KEY: 'test-secret-not-real' });

await test('production origin is allowed', async () => {
  const res = await onRequestPost({ request: req('https://mmrecruitmentltd.co.uk', good), env: ENV });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://mmrecruitmentltd.co.uk');
});
await test('own preview origin (same origin) is allowed', async () => {
  const url = 'https://abc123.mm-recruitment-website.pages.dev/api/send-enquiry';
  const res = await onRequestOptions({ request: new Request(url, { method: 'OPTIONS', headers: { Origin: 'https://abc123.mm-recruitment-website.pages.dev' } }) });
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://abc123.mm-recruitment-website.pages.dev');
});
await test('an unrelated *.pages.dev site is NOT granted CORS', async () => {
  const res = await onRequestOptions({ request: new Request('https://mmrecruitmentltd.co.uk/api/send-enquiry', { method: 'OPTIONS', headers: { Origin: 'https://attacker.pages.dev' } }) });
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
});
await test('CR/LF in the name never reaches the subject line', async () => {
  sent = [];
  const res = await onRequestPost({ request: req(null, { ...good, fields: { ...good.fields, name: 'Eve\r\nBcc: victim@example.test' } }), env: ENV });
  assert.equal(res.status, 200);
  assert.doesNotMatch(sent[0].body.subject, /[\r\n]/);
});
await test('HTML in the message is escaped in the email body', async () => {
  sent = [];
  await onRequestPost({ request: req(null, { ...good, fields: { ...good.fields, message: '<script>x</script>' } }), env: ENV });
  assert.doesNotMatch(sent[0].body.html, /<script>x<\/script>/);
});
await test('honeypot field short-circuits without sending', async () => {
  sent = [];
  const res = await onRequestPost({ request: req(null, { ...good, fields: { ...good.fields, company_website: 'spam' } }), env: ENV });
  assert.equal(res.status, 200);
  assert.equal(sent.length, 0);
});

// --- Abuse controls (always on) -----------------------------------------
await test('no Origin header (a script, not a browser on this site) -> 403, nothing sent', async () => {
  sent = [];
  const res = await onRequestPost({ request: req(false, good), env: ENV });
  assert.equal(res.status, 403);
  assert.equal(sent.length, 0);
});
await test('a foreign Origin (cross-site relay) -> 403, nothing sent', async () => {
  sent = [];
  const res = await onRequestPost({ request: req('https://attacker.pages.dev', good), env: ENV });
  assert.equal(res.status, 403);
  assert.equal(sent.length, 0);
});
await test('non-JSON body -> 415', async () => {
  const res = await onRequestPost({ request: req(null, 'name=x', undefined, { 'Content-Type': 'application/x-www-form-urlencoded' }), env: ENV });
  assert.equal(res.status, 415);
});
await test('oversized body -> 413, nothing sent', async () => {
  sent = [];
  const big = { ...good, fields: { ...good.fields, message: 'x'.repeat(20000) } };
  const res = await onRequestPost({ request: req(null, big), env: ENV });
  assert.equal(res.status, 413);
  assert.equal(sent.length, 0);
});
await test('link-stuffed message -> 400 with an honest message, nothing sent', async () => {
  sent = [];
  const spam = { ...good, fields: { ...good.fields, message: 'buy http://a.test http://b.test http://c.test http://d.test' } };
  const res = await onRequestPost({ request: req(null, spam), env: ENV });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'too-many-links');
  assert.equal(sent.length, 0);
});
await test('BBCode link -> rejected; a normal message with one link -> sent', async () => {
  sent = [];
  assert.equal((await onRequestPost({ request: req(null, { ...good, fields: { ...good.fields, message: '[url=http://x.test]x[/url]' } }), env: ENV })).status, 400);
  assert.equal((await onRequestPost({ request: req(null, { ...good, fields: { ...good.fields, message: 'Our vacancy: https://example.test/job' } }), env: ENV })).status, 200);
  assert.equal(sent.length, 1);
});

// --- Turnstile (only when BOTH keys are configured) -----------------------
await test('config endpoint: no site key unless both keys are set; never exposes the secret', async () => {
  assert.equal((await (await configGet({ env: ENV })).json()).turnstileSiteKey, null);
  assert.equal((await (await configGet({ env: { TURNSTILE_SECRET_KEY: 's' } })).json()).turnstileSiteKey, null, 'half-configured -> off');
  const body = await (await configGet({ env: TS_ENV })).text();
  assert.match(body, /1x00000000000000000000AA/);
  assert.doesNotMatch(body, /test-secret-not-real/);
});
await test('Turnstile on: missing token -> 403, siteverify never called, nothing sent', async () => {
  sent = []; siteverify = [];
  const res = await onRequestPost({ request: req(null, good), env: TS_ENV });
  assert.equal(res.status, 403);
  assert.equal(siteverify.length, 0);
  assert.equal(sent.length, 0);
});
await test('Turnstile on: valid token -> verified with secret + client IP, then sent', async () => {
  sent = []; siteverify = [];
  const res = await onRequestPost({ request: req(null, { ...good, turnstileToken: 'tok' }), env: TS_ENV });
  assert.equal(res.status, 200);
  assert.deepEqual([siteverify[0].secret, siteverify[0].response, siteverify[0].remoteip], ['test-secret-not-real', 'tok', '203.0.113.7']);
  assert.equal(sent.length, 1);
});
await test('Turnstile on: wrong action or foreign hostname -> 403', async () => {
  for (const reply of [{ success: true, action: 'login', hostname: 'mmrecruitmentltd.co.uk' }, { success: true, action: 'enquiry', hostname: 'evil.test' }, { success: false }]) {
    sent = [];
    siteverifyReply = () => new Response(JSON.stringify(reply), { status: 200 });
    const res = await onRequestPost({ request: req(null, { ...good, turnstileToken: 'tok' }), env: TS_ENV });
    assert.equal(res.status, 403, JSON.stringify(reply));
    assert.equal(sent.length, 0);
  }
});
await test('Turnstile on: siteverify unreachable -> 503 (fails closed), nothing sent', async () => {
  sent = [];
  siteverifyReply = () => { throw new TypeError('network'); };
  const res = await onRequestPost({ request: req(null, { ...good, turnstileToken: 'tok' }), env: TS_ENV });
  assert.equal(res.status, 503);
  assert.equal(sent.length, 0);
  siteverifyReply = () => new Response(JSON.stringify({ success: true, action: 'enquiry', hostname: 'mmrecruitmentltd.co.uk' }), { status: 200 });
});

console.log(`\nenquiry-api.test.mjs: ${passed} passed, ${failed} failed (${passed + failed} total)`);
if (failed) process.exitCode = 1;
