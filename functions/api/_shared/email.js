// Shared enquiry-email sender for MM Recruitment's public site. Plain
// fetch() against Resend's HTTP API - no npm dependency, matching the
// Cloudflare Pages Functions convention used across the Laurus Group
// ecosystem. Independent of every other project's copy of this same
// idea - this repository has its own Resend account/API key, never
// Laurus Recruitment's.
//
// Honesty: if RESEND_API_KEY isn't set, this returns {sent:false,
// reason:"not-configured"} rather than pretending to send - the brief
// is explicit that nothing here should claim a live integration that
// hasn't actually been wired up. This is the ONLY outbound email this
// repository sends in Phase 1 - it is a plain enquiry relay, not part
// of the (currently disabled) candidate/employer authentication system.
export async function sendEnquiryEmail(env, { to, replyTo, subject, html }) {
  const apiKey = (env.RESEND_API_KEY || '').trim();
  if (!apiKey || !to) {
    return { sent: false, reason: 'not-configured' };
  }
  const fromAddress = (env.RESEND_FROM_ADDRESS || '').trim() || 'MM Recruitment Ltd <notifications@mmrecruitmentltd.co.uk>';

  let res;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        reply_to: replyTo || undefined,
        subject,
        html,
      }),
    });
  } catch {
    return { sent: false, reason: 'network-error' };
  }

  if (!res.ok) {
    return { sent: false, reason: 'provider-error' };
  }
  return { sent: true };
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Renders a plain, table-based enquiry notification email - fields is
// an ordered array of [label, value] pairs, every value escaped before
// insertion (this handles real, untrusted visitor input, unlike the
// generic "you have an update" templates other Laurus Group projects
// send to their own already-verified users).
export function renderEnquiryEmailHtml(heading, fields) {
  const rows = fields
    .filter(([, value]) => !!value)
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;font-weight:bold;color:#26231F;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:8px 12px;color:#26231F;">${escapeHtml(value).replace(/\n/g, '<br>')}</td></tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:#FAF7F1;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF7F1;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background-color:#26231F;padding:24px 28px;">
              <span style="font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#E9D7B4;">MM Recruitment Ltd</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#26231F;">${escapeHtml(heading)}</h1>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
