# Image assets

## Logo

The approved logo (gold angel silhouette holding a daisy, "MM
Recruitment" wordmark) is live: `assets/images/mm-recruitment-logo.png`,
used in every page's header `.logo-mark` span, replacing the old
reserved empty slot and the separate live-text `.wordmark` (now
redundant since the image carries the brand name itself; the footer's
own separate `.wordmark` text is untouched).

The supplied artwork was a full lockup - icon + "MM Recruitment" +
a "PEOPLE · TALENT · OPPORTUNITY" tagline line. Only the icon+wordmark
portion is used in the header; the tagline row was cropped out since it
would be illegible at header height (~52px desktop, 40px mobile - see
`assets/css/style.css`'s `.logo-mark` rules and the `@media (max-width:
720px)` override). The source file was resized down from its original
~1500px width to a ~3x-retina-appropriate 540px, since the header never
displays it wider than ~130px.

`favicon.ico` (repo root) and `assets/images/favicon-32x32.png` /
`favicon-16x16.png` / `apple-touch-icon.png` are cropped from the same
artwork's icon-only figure (the daisy itself couldn't be cleanly
separated from the wordmark at favicon scale - the two overlap in the
source art - so the favicon uses the dancing-figure glyph alone).
Referenced via `<link rel="icon">`/`<link rel="apple-touch-icon">` in
every page's `<head>`.

## Photography

Every hero/split-section image on the site is currently a
`.media-placeholder` (a warm gradient block with a text label), never a
stock photo standing in as MM Recruitment's own. As real photography
featuring genuine human connection is supplied, replace each
`.media-placeholder` block with a real `<img>` and remove the
placeholder styling from that instance.

Two of `index.html`'s `.split-media` slots are now filled - see either
for the working example: a plain `<img>` inside `.split-media` (no
`media-placeholder` class), sized to the source file's intrinsic
`width`/`height`, `loading="lazy"`, and descriptive `alt` text that
describes the scene without naming or implying any specific real
person.

- "Who we are" section: `assets/images/photography/consultant-candidate-conversation.jpg`
- "We're here to support your whole journey" section: `assets/images/photography/candidate-support-consultation.jpg` (shows the brand's own "It's about people" wall art - alt text names it as wall art, not as a claim about a real office)

Both are AI-generated photographs (not real MM Recruitment consultants,
candidates or clients), optimised as progressive JPEGs.
`assets/css/style.css`'s `.split-media`/`.split-media img` rules
(added alongside the first image) give any real photo dropped into a
`.split-media` slot the same rounded-corner, shadowed treatment as
`.hero-media`, cropped via `object-fit: cover`.

The homepage hero (`.hero-media`) is also filled now:
`assets/images/photography/hero-consultant-portrait.jpg`, a warm 4:5
portrait crop of a recruitment consultant mid-conversation. It's
cropped from a wider AI-generated image that also included a full
marketing overlay (headline, body copy and "FOR CANDIDATES"/"FOR
EMPLOYERS" buttons baked into the pixels) - only the clean photographic
region was kept, specifically to avoid shipping non-clickable,
non-accessible fake buttons next to the page's real ones. The site's
own live `<h1>`, lede and CTA buttons in the hero section were left
untouched.

The homepage's last slot, "Hiring for your team?", is filled too:
`assets/images/photography/employer-team-collaboration.jpg`, two
engineering colleagues examining a component together on a workshop
bench (cropped from a wider AI-generated image that also included
ambient wall signage, trimmed out here for a tighter 5:4 crop). With
this, every image slot on `index.html` now has a real photo.

`about.html`'s "Our philosophy" split is filled too:
`assets/images/photography/philosophy-team-discussion.jpg` - four
colleagues in plain (unbranded) office attire discussing notes
together. A separate AI-generated photo showing the same scene but
with the group wearing "MM RECRUITMENT"-branded polo shirts was
deliberately not used here or anywhere else on the site - on a company
page in particular, branded workwear reads as a claim that these are
real MM Recruitment staff, which they are not.

Still pending: every placeholder on `candidates.html` and
`employers.html` (both currently just "Portal preview" mockup slots,
not photography) and `people-consultancy.html` (no image slots exist
on that page yet).

## Founder photograph

Filled: `about.html`'s "Our founder" section now shows the real
director, Mandy - `assets/images/photography/mm-recruitment-director-header.webp`.
Unlike every other photo on this site, this one is a real photograph
of a real MM Recruitment person, supplied directly, not AI-generated -
do not replace it with a stand-in. The section's `.split-media` was
switched from its placeholder `aspect-ratio:1/1` to `4/5` to match the
supplied photo's native composition exactly (no cropping needed). The
biography text in that section is still "Content pending" - out of
scope for this image swap, untouched.
