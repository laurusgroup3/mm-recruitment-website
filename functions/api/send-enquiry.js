// Public enquiry relay for MM Recruitment's Contact and Employer
// Enquiry forms - the ONLY backend behaviour this Phase 1 site has.
// Deliberately NOT an authentication endpoint, NOT connected to any
// candidate/employer record, and NOT part of LOS - just a plain email
// relay so a real visitor's message actually reaches the business,
// matching "the initial deployment must not depend on unfinished
// backend services" while still giving these two forms genuine
// (not mocked) behaviour.
//
// Abuse protection for a public, unauthenticated form (hardened after
// the 25 October 2026 security audit):
//   * the request must come from this site: the Origin header has to
//     match the origin serving this Function, or one of the production
//     hostnames. No Origin, "null", or any other site (including other
//     *.pages.dev projects) is refused. Browsers always send Origin on
//     a cross-site or JSON POST, so a genuine visitor is never blocked;
//   * JSON only - a plain-text or form-encoded body (what a cross-site
//     form post without a preflight looks like) is refused;
//   * Cloudflare Turnstile, when configured (TURNSTILE_SECRET_KEY set):
//     the token the form obtained is verified server-side and the
//     message is refused without a valid one. Until the keys are set the
//     forms work as before, without the check;
//   * a honeypot field (real visitors never fill in "company_website",
//     which is hidden via CSS - a bot filling every field will);
//   * single-line fields are stripped of CR/LF and control characters
//     before reaching the email subject or headers; length caps on
//     everything.
// The recipient is fixed server-side (MM_ENQUIRY_NOTIFICATION_EMAIL),
// so this can never relay mail to an address the visitor chooses.
// Nothing a visitor typed is ever logged.
import { sendEnquiryEmail, renderEnquiryEmailHtml } from './_shared/email.js';

const MAX_FIELD_LENGTH = 4000;
const ALLOWED_FORM_TYPES = ['contact', 'employer'];
const PRODUCTION_ORIGINS = ['https://mmrecruitmentltd.co.uk', 'https://www.mmrecruitmentltd.co.uk'];
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TURNSTILE_ACTION = 'enquiry';
// One wording for every refusal of a suspected automated submission -
// never says which check failed.
export const GENERIC_REJECTION_MESSAGE = "We couldn't send your message. Please refresh the page and try again, or email us directly.";

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: corsHeaders(context.request) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const headers = corsHeaders(request);

  if (!isTrustedOrigin(request)) {
    return jsonResponse({ error: 'rejected', message: GENERIC_REJECTION_MESSAGE }, 403, headers);
  }
  const contentType = (request.headers.get('Content-Type') || '').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    return jsonResponse({ error: 'rejected', message: GENERIC_REJECTION_MESSAGE }, 415, headers);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid-request' }, 400, headers);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return jsonResponse({ error: 'invalid-request' }, 400, headers);
  }

  const formType = String(payload.formType || '');
  if (!ALLOWED_FORM_TYPES.includes(formType)) {
    return jsonResponse({ error: 'invalid-request' }, 400, headers);
  }

  const fields = payload.fields && typeof payload.fields === 'object' && !Array.isArray(payload.fields) ? payload.fields : {};

  // Honeypot - a hidden field named "company_website" that only an
  // automated submitter would ever populate. A silent, honest-looking
  // 200 is returned (never reveal to a bot that it was caught).
  if (singleLine(fields.company_website, 200)) {
    return jsonResponse({ ok: true }, 200, headers);
  }

  const name = singleLine(fields.name, 200);
  const email = singleLine(fields.email, 320);
  const message = multiLine(fields.message, MAX_FIELD_LENGTH);
  const consent = fields.consent === 'on' || fields.consent === true;

  if (!name || !email || !message) {
    return jsonResponse({ error: 'invalid-request', message: 'Please fill in your name, email and message.' }, 400, headers);
  }
  if (!isPlausibleEmail(email)) {
    return jsonResponse({ error: 'invalid-email', message: 'Please enter a valid email address.' }, 400, headers);
  }
  if (!consent) {
    return jsonResponse({ error: 'consent-required', message: 'Please confirm you are happy for us to contact you about your enquiry.' }, 400, headers);
  }

  // Turnstile, only once the secret is configured for this environment.
  const turnstileSecret = (env.TURNSTILE_SECRET_KEY || '').trim();
  if (turnstileSecret) {
    const token = singleLine(payload.turnstileToken, 2048);
    const verified = token ? await verifyTurnstile(token, turnstileSecret, request.headers.get('CF-Connecting-IP')) : { ok: false };
    if (!verified.ok) {
      if (verified.unavailable) {
        return jsonResponse(
          { error: 'delivery-unavailable', message: "We couldn't send your message right now - please try again shortly, or email us directly." },
          503,
          headers
        );
      }
      console.warn(JSON.stringify({ event: 'enquiry', outcome: 'rejected', reason: 'turnstile', codes: (verified.codes || []).slice(0, 5), ray: request.headers.get('CF-Ray') || null }));
      return jsonResponse({ error: 'rejected', message: GENERIC_REJECTION_MESSAGE }, 400, headers);
    }
  }

  const isEmployer = formType === 'employer';
  const heading = isEmployer ? 'New employer enquiry' : 'New contact enquiry';
  const orderedFields = [
    ['Name', name],
    ['Email', email],
    ['Phone', singleLine(fields.phone, 60)],
  ];
  if (isEmployer) {
    orderedFields.push(['Company', singleLine(fields.company, 200)]);
    orderedFields.push(['Hiring need', singleLine(fields.hiringNeed, 200)]);
  }
  orderedFields.push(['Message', message]);

  const staffRecipient = (env.MM_ENQUIRY_NOTIFICATION_EMAIL || '').trim();
  const emailResult = await sendEnquiryEmail(env, {
    to: staffRecipient,
    replyTo: email,
    subject: `${heading} - ${name}`,
    html: renderEnquiryEmailHtml(heading, orderedFields),
  });

  // The visitor always sees a clear, honest outcome - if the email
  // provider isn't configured yet (see docs/DEPLOYMENT.md), that is
  // reported plainly rather than a false "message sent" confirmation.
  if (!emailResult.sent) {
    console.error(JSON.stringify({ event: 'enquiry', outcome: 'error', reason: emailResult.reason || 'send-failed', ray: request.headers.get('CF-Ray') || null }));
    return jsonResponse(
      { error: 'delivery-unavailable', message: "We couldn't send your message right now - please try again shortly, or email us directly." },
      503,
      headers
    );
  }

  return jsonResponse({ ok: true }, 200, headers);
}

// A value destined for an email subject/header or a one-line field:
// CR, LF and other control characters are removed outright so nothing a
// visitor types can add headers to, or break, the notification email.
function singleLine(value, max) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function multiLine(value, max) {
  return String(value == null ? '' : value)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g, '')
    .trim()
    .slice(0, max);
}

// One mailbox, nothing a mail library could read as a list or a header.
function isPlausibleEmail(value) {
  return /^[^\s@,;<>()"'\\]+@[^\s@,;<>()"'\\]+\.[^\s@,;<>()"'\\]+$/.test(value) && value.length <= 320;
}

export function isTrustedOrigin(request) {
  const origin = (request.headers.get('Origin') || '').trim();
  if (!origin || origin === 'null') return false;
  let own = '';
  try {
    own = new URL(request.url).origin;
  } catch {
    return false;
  }
  return origin === own || PRODUCTION_ORIGINS.includes(origin);
}

async function verifyTurnstile(token, secret, remoteIp) {
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (remoteIp) body.append('remoteip', remoteIp);
  let res;
  try {
    res = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body });
  } catch {
    return { ok: false, unavailable: true };
  }
  if (!res.ok) return { ok: false, unavailable: true };
  let outcome;
  try {
    outcome = await res.json();
  } catch {
    return { ok: false, unavailable: true };
  }
  if (!outcome || outcome.success !== true) {
    return { ok: false, codes: (outcome && outcome['error-codes']) || [] };
  }
  if (outcome.action && outcome.action !== TURNSTILE_ACTION) {
    return { ok: false, codes: ['action-mismatch'] };
  }
  return { ok: true };
}

function jsonResponse(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(extraHeaders || {}) },
  });
}

// The forms post same-origin, so CORS only ever needs to echo an origin
// this site itself serves from. Nothing else is ever reflected.
function corsHeaders(request) {
  const headers = { 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' };
  if (isTrustedOrigin(request)) {
    headers['Access-Control-Allow-Origin'] = request.headers.get('Origin').trim();
  }
  return headers;
}
