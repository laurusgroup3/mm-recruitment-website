# MM Recruitment Ltd — Website

Production domain: `mmrecruitmentltd.co.uk` (not yet connected - see
`docs/DEPLOYMENT.md`). Hosting: Cloudflare Pages.

A people consultancy website for MM Recruitment Ltd, an independent
business using Laurus Operating System (LOS) recruitment technology
behind the scenes. **Phase 1** (this repository's current state): a
complete, static public website with a working Contact/Employer
Enquiry form and honest, explicitly-disabled candidate/employer portal
previews. No candidate/employer authentication, database, or LOS
integration exists yet - see `docs/LOS-INTEGRATION-PROPOSAL.md` for
that plan.

## Structure

Plain HTML/CSS/JS, no build step - deploys to Cloudflare Pages
directly from the repository root.

```
index.html, about.html, candidates.html, employers.html,
people-consultancy.html, contact.html          Public pages
candidate-portal.html, employer-portal.html    Disabled portal previews
privacy-policy.html, cookie-policy.html,
terms.html                                     Legal (draft - see below)
assets/css/style.css                           Design system (tokens + components)
assets/js/main.js                              Nav toggle + enquiry-form handling
assets/images/                                 Logo (pending) + photography notes
functions/api/send-enquiry.js                  Contact/Employer Enquiry email relay
docs/DESIGN-SYSTEM.md                          Brand tokens, components, how to extend
docs/DEPLOYMENT.md                             Cloudflare Pages / domain / Resend setup
docs/LOS-INTEGRATION-PROPOSAL.md               Phase 2 plan - not yet implemented
```

## Local preview

No build step - open any `.html` file directly, or serve the folder
with any static file server, e.g.:

```
npx serve .
```

`functions/api/send-enquiry.js` only runs under Cloudflare Pages (or
`wrangler pages dev .` if you have Wrangler installed) - opening the
HTML files directly means the enquiry forms will fail to reach it,
which is expected in a plain static preview.

## Before this goes live

Every `class="tbc"` span (legal pages, Contact page) marks a real
business detail (company number, registered address, ICO registration,
contact email/phone) that must be confirmed before publishing - none of
these have been invented. See `docs/DEPLOYMENT.md`'s checklist for the
full pre-launch list, including the still-pending logo and photography.

## Branding

Palette, typography and component tokens are documented in
`docs/DESIGN-SYSTEM.md`. This is an independent brand identity -
nothing here is shared with Laurus Recruitment's or any other Laurus
Group project's design system.
