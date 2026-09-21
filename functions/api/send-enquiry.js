// Public enquiry relay for MM Recruitment's Contact and Employer
// Enquiry forms - the ONLY backend behaviour this Phase 1 site has.
// Deliberately NOT an authentication endpoint, NOT connected to any
// candidate/employer record, and NOT part of LOS - just a plain email
// relay so a real visitor's message actually reaches the business,
// matching "the initial deployment must not depend on unfinished
// backend services" while still giving these two forms genuine
// (not mocked) behaviour.
//
// Spam/abuse minimisation appropriate for a public, unauthenticated
// form: a honeypot field (real visitors never fill in "company_website",
// which is hidden via CSS - a bot filling every field will), a message-
// length cap, and same-origin-only CORS (matches every other Laurus
// Group public Function's convention).
import { sendEnquiryEmail, renderEnquiryEmailHtml } from './_shared/email.js';

const MAX_FIELD_LENGTH = 4000;
const ALLOWED_FORM_TYPES = ['contact', 'employer'];

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: corsHeaders(context.request) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const headers = corsHeaders(request);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid-request' }, 400, headers);
  }

  const formType = String(payload.formType || '');
  if (!ALLOWED_FORM_TYPES.includes(formType)) {
    return jsonResponse({ error: 'invalid-request' }, 400, headers);
  }

  const fields = payload.fields && typeof payload.fields === 'object' ? payload.fields : {};

  // Honeypot - a hidden field named "company_website" that only an
  // automated submitter would ever populate. A silent, honest-looking
  // 200 is returned (never reveal to a bot that it was caught).
  if (String(fields.company_website || '').trim()) {
    return jsonResponse({ ok: true }, 200, headers);
  }

  const name = String(fields.name || '').trim().slice(0, 200);
  const email = String(fields.email || '').trim().slice(0, 320);
  const message = String(fields.message || '').trim().slice(0, MAX_FIELD_LENGTH);
  const consent = fields.consent === 'on' || fields.consent === true;

  if (!name || !email || !message) {
    return jsonResponse({ error: 'invalid-request', message: 'Please fill in your name, email and message.' }, 400, headers);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'invalid-email', message: 'Please enter a valid email address.' }, 400, headers);
  }
  if (!consent) {
    return jsonResponse({ error: 'consent-required', message: 'Please confirm you are happy for us to contact you about your enquiry.' }, 400, headers);
  }

  const isEmployer = formType === 'employer';
  const heading = isEmployer ? 'New employer enquiry' : 'New contact enquiry';
  const orderedFields = [
    ['Name', name],
    ['Email', email],
    ['Phone', String(fields.phone || '').trim().slice(0, 60)],
  ];
  if (isEmployer) {
    orderedFields.push(['Company', String(fields.company || '').trim().slice(0, 200)]);
    orderedFields.push(['Hiring need', String(fields.hiringNeed || '').trim().slice(0, 200)]);
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
  // provider isn't configured yet (a real, current gap in this brand-
  // new project - see docs/DEPLOYMENT.md), that is reported plainly
  // rather than a false "message sent" confirmation.
  if (!emailResult.sent) {
    return jsonResponse(
      { error: 'delivery-unavailable', message: "We couldn't send your message right now - please try again shortly, or email us directly." },
      503,
      headers
    );
  }

  return jsonResponse({ ok: true }, 200, headers);
}

function jsonResponse(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(extraHeaders || {}) },
  });
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ['https://mmrecruitmentltd.co.uk', 'https://www.mmrecruitmentltd.co.uk'];
  const isPreview = /\.pages\.dev$/.test(new URL(origin || 'https://none.invalid').hostname || '');
  const headers = { 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (allowed.includes(origin) || isPreview) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}
