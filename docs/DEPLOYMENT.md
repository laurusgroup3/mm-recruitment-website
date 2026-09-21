# MM Recruitment Ltd — Cloudflare Pages Deployment

Written for: whoever sets up hosting/DNS for mmrecruitmentltd.co.uk.
Nothing described here has been performed yet - this is the exact set
of steps still needed, not a record of what's already live.

## What this site is

A static site (plain HTML/CSS/JS) plus one Cloudflare Pages Function
(`functions/api/send-enquiry.js`) that relays the Contact and Employer
Enquiry forms by email. No database, no authentication, no build step -
Cloudflare Pages can serve this repository directly.

## 1. Create the Cloudflare Pages project

1. Cloudflare dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Select `laurusgroup3/mm-recruitment-website`.
3. Production branch: `main`. **Do not** connect this project's Production environment to any branch until the site has been reviewed and approved for launch - keep deployments on the feature branch/Preview only until then.
4. Build settings:
   - Framework preset: **None**
   - Build command: *(leave blank - no build step)*
   - Build output directory: `/` (repository root)
5. Deploy. Cloudflare will give you a `*.pages.dev` Preview URL immediately - use this to review the site before touching DNS.

## 2. Environment variables

Pages → this project → **Settings → Environment variables**. Add for
**both** Preview and Production (values will differ once real
credentials exist):

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Enables the Contact/Employer Enquiry forms to actually send email. Without it, `send-enquiry.js` honestly reports "delivery unavailable" rather than pretending to send. |
| `RESEND_FROM_ADDRESS` | e.g. `MM Recruitment Ltd <notifications@mmrecruitmentltd.co.uk>` - must be a domain verified in your Resend account (see step 4). |
| `MM_ENQUIRY_NOTIFICATION_EMAIL` | The real mailbox enquiries should land in - to be confirmed by the business. |

None of these exist yet in any environment - the forms will not
actually deliver email until they're set.

## 3. Custom domain

Pages → this project → **Custom domains** → **Set up a custom domain**
→ enter `mmrecruitmentltd.co.uk` (and `www.mmrecruitmentltd.co.uk` if
both should resolve). If the domain's DNS is already on Cloudflare,
this is a one-click "Activate domain" step; if it's registered
elsewhere, Cloudflare will give you the CNAME/NS records to add at the
registrar. Do not repoint the domain until the Preview deployment has
been reviewed and approved.

## 4. Resend (email) setup - for the enquiry forms

1. Create (or use an existing) Resend account.
2. Add and verify the sending domain (`mmrecruitmentltd.co.uk`) under
   Resend → Domains - this requires adding the DNS records Resend
   provides (SPF/DKIM) at your DNS provider.
3. Create an API key scoped to sending only, and set it as
   `RESEND_API_KEY` above.
4. Confirm a real, monitored mailbox for `MM_ENQUIRY_NOTIFICATION_EMAIL`
   before going live - enquiries will otherwise go unnoticed.

## 5. Checks before approving Production

- [ ] Preview URL reviewed on desktop and mobile widths.
- [ ] Every `class="tbc"` placeholder in the legal pages and Contact
      page has been replaced with a confirmed, real value (registered
      address, company number, contact email/phone, ICO registration).
- [ ] The approved logo has been added (see
      `assets/images/README.md`) - the site should not go live with the
      empty `.logo-mark` placeholder if the asset is available by then.
- [ ] Real photography has replaced the `.media-placeholder` blocks, or
      a decision has been made to launch with placeholders and revisit.
- [ ] Contact and Employer Enquiry forms tested end-to-end on the
      Preview URL with `RESEND_API_KEY` set, confirming a real email
      arrives at `MM_ENQUIRY_NOTIFICATION_EMAIL`.
- [ ] Sitemap/robots.txt URLs match the final domain (already set to
      `mmrecruitmentltd.co.uk` - update if the domain changes).

## 6. What is deliberately NOT part of this deployment

Candidate/employer authentication, portals, and any LOS integration are
**not** part of this Phase 1 deployment - see
`docs/LOS-INTEGRATION-PROPOSAL.md` for the Phase 2 plan. Do not wire up
Laurus Recruitment's Supabase project or Cloudflare Pages Functions to
this site under any circumstances; MM Recruitment needs its own,
entirely separate backend when that phase begins.
