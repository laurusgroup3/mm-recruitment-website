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
| `TURNSTILE_SITE_KEY` | Optional. Public site key of a Cloudflare Turnstile widget for `mmrecruitmentltd.co.uk` (+ `www`). Served to the browser by `/api/enquiry-config`. |
| `TURNSTILE_SECRET_KEY` | Optional, **encrypted** variable. Turnstile secret, used only server-side for siteverify. Turnstile is enforced only when **both** Turnstile variables are set, so setting one alone changes nothing. |

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
- [x] The approved logo has been added (see `assets/images/README.md`).
- [ ] Real photography has replaced the `.media-placeholder` blocks, or
      a decision has been made to launch with placeholders and revisit.
- [ ] Contact and Employer Enquiry forms tested end-to-end on the
      Preview URL with `RESEND_API_KEY` set, confirming a real email
      arrives at `MM_ENQUIRY_NOTIFICATION_EMAIL`.
- [ ] Sitemap/robots.txt URLs match the final domain (already set to
      `mmrecruitmentltd.co.uk` - update if the domain changes).

## 6. Enquiry form spam and abuse protection

Always on in code (no configuration):

- Requests must carry a browser `Origin` of the production site or of
  the deployment itself; scripts and cross-site relays get 403.
- JSON only, body capped at 16 KB before parsing.
- Hidden honeypot field; more than 3 links or BBCode/HTML links are
  rejected with an honest message.
- Name/email are stripped of control characters (no header injection);
  every field is HTML-escaped in the staff email.

Needs dashboard configuration (each one is a live change; get approval):

1. **Rate limit** - Security → WAF → Rate limiting rules on the
   `mmrecruitmentltd.co.uk` zone: when URI path equals
   `/api/send-enquiry` and method is `POST`, count by IP, 5 requests per
   10 minutes, action Block for 10 minutes.
2. **Turnstile** - create a Managed widget for `mmrecruitmentltd.co.uk`
   and `www.mmrecruitmentltd.co.uk`, then set `TURNSTILE_SITE_KEY` and
   `TURNSTILE_SECRET_KEY` together (Production), and redeploy. The CSP in
   `_headers` already allows `https://challenges.cloudflare.com`. To test
   on a Preview first, add the preview hostname to the widget and set
   Cloudflare's published test keys on the Preview environment only.

Tests: `node tests/enquiry-api.test.mjs` (17 checks) and, with Python
Playwright, `python3 tests/browser/enquiry_e2e.py` and
`python3 tests/browser/turnstile_on_e2e.py` (real Functions, email
stubbed, desktop and mobile).

## 7. The failing "Workers Builds" check

Two Cloudflare projects are connected to this repository: the **Pages**
project `mm-recruitment-website` (deploys every branch successfully;
this is the pipeline this document describes) and a separate **Worker**
also named `mm-recruitment-website` (created 26 Sep 2026, last deployed
18 Oct 2026). The repository has no `wrangler.toml`/`wrangler.jsonc`.
The Worker's build check succeeds on `main` but fails on every non-main
branch in under a second, with no build output - it is rejected before
any build runs, i.e. a project setting, not this code. It has failed on
every PR since PR #2.

Recommended fix (dashboard, needs approval): first confirm in Workers &
Pages → the custom domains tab of each project which one actually
serves `mmrecruitmentltd.co.uk`. If it is the Pages project, open the
Worker → Settings → Build and either disconnect the Git repository or
turn off non-production branch builds. Do **not** add a Wrangler config
to this repo to make the check pass: the Worker's production build runs
on every push to `main`, so that would change what the Worker deploys.

## 8. What is deliberately NOT part of this deployment

Candidate/employer authentication, portals, and any LOS integration are
**not** part of this Phase 1 deployment - see
`docs/LOS-INTEGRATION-PROPOSAL.md` for the Phase 2 plan. Do not wire up
Laurus Recruitment's Supabase project or Cloudflare Pages Functions to
this site under any circumstances; MM Recruitment needs its own,
entirely separate backend when that phase begins.
