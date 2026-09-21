# MM Recruitment Ltd × Laurus Operating System — Integration Proposal (Phase 2)

Written for: whoever decides how MM Recruitment's candidate/employer
portals actually get built. This is a **proposal**, not an
implementation - nothing described here has been built, and no code in
this repository depends on it. Phase 1 (this repository's current
state) is a static marketing site with the portal pages explicitly
disabled; this document is what Phase 2 would need to do to turn them
on safely.

## 1. What was inspected, and why it rules out one obvious-looking option

Laurus Recruitment's existing application (`laurusgroup3/`
`laurusgrouprecruitment-website`) is a **single-tenant** system:

- One Supabase project holds every table (`profiles`, `candidate_profiles`,
  `employer_organisations`, `vacancies`, `candidate_applications`,
  `notes`, `notifications`, and around a dozen more) with Row Level
  Security policies written entirely in terms of `auth.uid()` and a
  `role` column (`candidate` / `employer` / `consultant` / `admin`).
  **There is no `tenant_id`, `brand_id`, or equivalent column anywhere
  in the schema** - nothing in the current design distinguishes "a
  Laurus Recruitment candidate" from "an MM Recruitment candidate".
- Staff sign in via Google OAuth + an explicit `staff_access_requests`
  approval workflow, scoped to *that one Supabase project's* `profiles`
  table.
- Email (Resend) sends from Laurus Recruitment's own verified sending
  domain, with templates that say "Laurus Recruitment" in the copy
  itself.
- The public-facing LOS hub (`losportal.com`, repo `losportal-redirect`)
  is a deliberately **static site with no database access of its own at
  all** - its own architecture document states this as a permanent
  rule: *"No cross-module database access, ever... every branch node
  either links out to that module's own already-secured application."*
  LOS proves *who* a staff member is (via Cloudflare Access, not yet
  configured); it never proves *what they can do in a given module*,
  and it never reaches into a module's data on anyone's behalf.

**Conclusion:** retrofitting multi-tenancy into the existing single
Supabase project (adding a `brand_id` to every table, rewriting every
RLS policy to scope by it, and trusting that no policy is ever missed)
would mean editing Laurus Recruitment's live production schema and
every one of its ~30 RLS policies - directly contradicting "do not
modify the existing Laurus Recruitment production website, database or
authentication configuration," and introducing real risk of a policy
bug leaking one business's candidate data into the other's. This
proposal does not recommend that path.

## 2. Recommended approach: separately deployed, code-templated

Give MM Recruitment its **own, independent deployment** of the same
kind of application - not a shared multi-tenant instance:

- **Its own Supabase project** (own Postgres database, own Auth user
  pool, own Storage buckets). MM candidates/employers/staff are rows in
  *this* project only - there is no user record, and no possibility of
  one, shared with Laurus Recruitment.
- **Its own Cloudflare Pages project and Functions**, deployed from
  this repository (or a sibling repository if the application code
  grows large enough to warrant separating the marketing site from the
  portal application - see §6).
- **Its own Resend sending domain/templates**, addressed as MM
  Recruitment throughout (matching the brief's "should feel like MM
  Recruitment's own service").
- **Reuses the proven application code as a starting template**, not a
  shared runtime: Laurus Recruitment's schema design (roles, RLS
  patterns, the notes/notifications model, the staff-access-request
  workflow) is already reviewed, tested and working - copying that
  *pattern* into MM's own project is far lower-risk than designing
  multi-tenancy from scratch, while producing zero runtime coupling
  between the two businesses. Copying **code** (schema files, Function
  logic) is fine; copying **data, secrets, or live credentials** is
  never acceptable and is explicitly not proposed anywhere in this
  document.

This is consistent with how the wider Laurus Group ecosystem already
works today: Podium Vehicle Solutions, Laurus Trade Quotes, and Laurus
Recruitment are three entirely separate Supabase projects, three
separate Cloudflare Pages deployments, and three separate codebases,
each with its own domain and its own staff sign-in - not one shared
multi-tenant platform. MM Recruitment would become a fourth, following
the same precedent.

## 3. Isolation, point by point (the brief's own checklist)

| Concern | Proposal |
|---|---|
| **Candidates** | MM's own `candidate_profiles`/`candidate_experience`/`candidate_skills`/etc. tables, in MM's own Supabase project. No foreign key, view, or API path connects them to Laurus Recruitment's candidate table at all. |
| **Employers** | Same - MM's own `employer_organisations` and membership tables, own project. |
| **Staff** | MM's own `profiles` (role=`consultant`/`admin`) and its own staff-access-request approval flow. A Laurus Recruitment consultant's login does **not** work on MM's portal, and vice versa, because they are different Supabase Auth user pools entirely - not a permission distinction, a *different database* distinction. |
| **Permissions** | RLS policies re-authored for MM's own schema (same proven patterns - `auth.uid()`-scoped candidate/employer access, role-gated staff access via a non-recursive `private.is_consultant_or_admin()`-style helper) - never shared policies, never a cross-project role check. |
| **Email templates** | MM's own copy, own sending domain, own Resend account/API key - addressed as MM Recruitment throughout, with LOS mentioned only as a discreet "powered by" line if at all, matching the brief's branding requirement. |
| **Applications / recruitment records** | MM's own `candidate_applications`, `vacancies`, `notes`, `notifications`, `audit_events` tables - structurally identical *pattern* to Laurus Recruitment's, physically separate *data*. |
| **Storage (CVs/documents)** | MM's own Supabase Storage buckets (`candidate-cvs`, `candidate-documents` equivalents), own bucket policies. Never Laurus Recruitment's storage buckets or signed-URL Functions. |
| **Cloudflare routing** | MM's own Cloudflare Pages project bound to `mmrecruitmentltd.co.uk`. No shared Worker, no shared KV/D1, no shared environment variables with Laurus Recruitment's Pages project. |

## 4. LOS's role: attribution and (eventually) shared staff identity - never data access

Two things LOS *can* legitimately do here, consistent with its own
architecture doc, and one thing it should never do:

1. **"Powered by LOS" attribution** (Phase 1, already shipped in this
   repository's footer) - a visual acknowledgement only, no technical
   coupling.
2. **Shared staff identity, eventually** - the LOS architecture doc
   describes a planned (not yet configured) Cloudflare Access
   application using Google Workspace SSO as *identity* proof for
   staff across every module. If/when that's configured, an MM
   Recruitment consultant could in principle prove "I am a genuine
   Laurus Group staff member" via the same Access login LOS uses -
   **but this must never be read as "therefore has access to MM
   Recruitment data"**. Exactly like Trade Quotes' own partial adoption
   of this model, MM would still need its own `staff_access_requests`-
   style explicit approval before that identity translates into any
   actual permission in MM's database. Access authenticates a person;
   it never authorises them.
3. **What LOS should never do**: read MM Recruitment's Supabase project
   directly, hold MM's database credentials, or expose MM candidate/
   employer data through any losportal.com page. A future "MM
   Recruitment" tile on the LOS dashboard (mirroring the existing
   Recruitment/Podium tiles) should be a plain navigation link to MM's
   own already-secured portal - never a live data widget.

## 5. Implementation plan (once approved)

**Step 1 - Provisioning (infrastructure only, no application code):**
- Create a new, dedicated Supabase project for MM Recruitment.
- Create a new Cloudflare Pages project (or extend this one - see §6)
  with its own environment variables (`SUPABASE_URL`,
  `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`,
  scoped to MM's own accounts only).

**Step 2 - Schema:**
- Port the *pattern* (not the data) of Laurus Recruitment's schema:
  `profiles`, `candidate_profiles` (+skills/experience/preferences/
  availability), `employer_organisations` (+members), `vacancies`,
  `candidate_applications` (+status history), `notes`, `notifications`,
  `staff_access_requests`, `audit_events` - each migration written
  fresh against MM's own project, reviewed independently rather than
  blindly copy-pasted, since MM's actual candidate journey/employer
  workflow may differ once confirmed.
- RLS policies follow the same reviewed conventions already proven in
  Laurus Recruitment (including the non-recursive `private` schema
  helper-function pattern, and column-level privilege hardening for
  any sensitive delivery-status columns) - written for MM's project
  from day one, not retrofitted later.

**Step 3 - Authentication:**
- Candidate/employer sign-up and sign-in: Supabase Auth, MM's own
  project - email/password to start (matching Laurus Recruitment's
  current candidate/employer auth), Google OAuth optional/later.
- Staff sign-in: Google OAuth + `staff_access_requests` approval,
  scoped to MM's own project - or, if Cloudflare Access/SSO has been
  configured group-wide by then, staff identity via Access with MM's
  own explicit approval step still required (see §4.2).

**Step 4 - Storage:**
- Dedicated Supabase Storage buckets in MM's project for CVs and
  supporting documents, with the same private-by-default, signed-URL-
  only access pattern already proven in Laurus Recruitment (RLS-scoped
  for candidates reading their own files, staff reading any candidate's
  file, employers reached only through a server-side Function that
  re-verifies an active sharing authorisation - never a direct storage
  policy for employers).

**Step 5 - Email notifications:**
- MM's own Resend account and verified sending domain
  (`mmrecruitmentltd.co.uk`), own templates, in MM's own brand voice.
- Reuse the *pattern* proven in Laurus Recruitment: tracked delivery
  status (sent/failed/pending) on every notification row, a
  candidate/employer-safe generic email that never puts message content
  in the email body itself, and staff-configurable per-type email
  preferences.

**Step 6 - Cloudflare routing:**
- `mmrecruitmentltd.co.uk` → MM's Cloudflare Pages project (this
  repository, or a paired application repository - see §6).
- No DNS, Worker route, or Pages project shared with Laurus
  Recruitment's `laurusgrouprecruitment.co.uk`.

**Step 7 - Enable the portal pages:**
- Only once Steps 1-6 are live and tested end-to-end (a real sign-up,
  a real sign-in, a real candidate profile, a real staff review) does
  `candidate-portal.html`/`employer-portal.html` stop being a disabled
  mockup - remove the `coming-soon-badge`/`fieldset[disabled]` markup
  and wire the real forms to the new endpoints.

## 6. One open structural question for the business/technical owner

Should the portal **application** (candidate/employer sign-in,
dashboards, Functions) live in *this* repository alongside the
marketing site, or in a **separate, dedicated repository** (the way
Laurus Recruitment's own portal and marketing pages already coexist in
one repo, but Podium and Trade Quotes are each their own repo)? Either
is workable; this document doesn't assume an answer, since it changes
how Cloudflare Pages projects/branches are organised in Step 1. Recommend
deciding this before Step 1 begins.

## 7. What this document deliberately does not do

- It does not create any Supabase project, Cloudflare Pages project, or
  environment variable.
- It does not copy any secret, access token, production database
  credential, or real candidate/employer data from Laurus Recruitment
  into this repository or anywhere else.
- It does not assume MM Recruitment's actual candidate/employer journey
  is identical to Laurus Recruitment's - Step 2's schema should be
  reviewed against MM's real requirements, not assumed from a template.
- It does not switch on any part of the candidate/employer portal in
  this repository - `candidate-portal.html`/`employer-portal.html`
  remain explicit, honest previews until every step above is actually
  complete and tested.
