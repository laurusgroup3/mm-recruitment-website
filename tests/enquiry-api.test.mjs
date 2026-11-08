// Regression tests for functions/api/send-enquiry.js (no network:
// fetch is stubbed). Run: node tests/enquiry-api.test.mjs
import assert from 'node:assert/strict';
import { onRequestPost, onRequestOptions } from '../functions/api/send-enquiry.js';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; } catch (e) { failed++; console.log('  FAIL: ' + name + '\n    ' + e.message); }
}
const ENV = { RESEND_API_KEY: 're_test_dummy', MM_ENQUIRY_NOTIFICATION_EMAIL: 'staff@example.test' };
function req(origin, body, url = 'https://mmrecruitmentltd.co.uk/api/send-enquiry') {
  const headers = { 'Content-Type': 'application/json' };
  if (origin) headers.Origin = origin;
  return new Request(url, { method: 'POST', headers, body: JSON.stringify(body) });
}
const good = { formType: 'contact', fields: { name: 'Test Person', email: 'person@example.test', message: 'Hello', consent: true } };
let sent = [];
globalThis.fetch = async (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return new Response('{}', { status: 200 }); };

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

console.log(`\nenquiry-api.test.mjs: ${passed} passed, ${failed} failed (${passed + failed} total)`);
if (failed) process.exitCode = 1;
