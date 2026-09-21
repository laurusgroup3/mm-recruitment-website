# Image assets - pending

## Logo (blocking)

The approved logo - a gold angel silhouette holding a daisy, positioned
to the left of the MM Recruitment Ltd wordmark - has not been supplied
yet. No substitute has been invented anywhere in this site; every page
ships a reserved, zero-width `.logo-mark` slot in the header instead
(see `assets/css/style.css`'s own comment on that class).

**To add the real logo once supplied:**

1. Save the approved file here as `mm-recruitment-logo.svg` (preferred
   - scales cleanly at any size) or `mm-recruitment-logo.png` (at least
   200px tall, transparent background).
2. In every page's `<header>`, replace:
   ```html
   <span class="logo-mark"></span>
   ```
   with:
   ```html
   <span class="logo-mark">
     <img src="assets/images/mm-recruitment-logo.svg" alt="MM Recruitment Ltd" width="44" height="44" />
   </span>
   ```
3. Remove the `width: 0;` rule's effect by confirming `.logo-mark img`
   in `style.css` renders at the size you want (already set to 44px
   tall) - the `.logo-mark` wrapper itself only needs `width: auto`
   once it has real content; no other CSS change should be needed.
4. Repeat across every HTML file that has a `.logo-mark` span (every
   page in this repository) - there is no shared header partial in this
   plain-HTML build, so this is a find-and-replace across files, not a
   one-line change. A quick check: `grep -rl "logo-mark></span>" .`
   should return nothing once every page has been updated.

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

Still pending: `about.html`'s founder photo (`.split-media`, 1:1 -
must be the real founder, never a stand-in), and every placeholder on
`candidates.html` and `employers.html` (both currently just "Portal
preview" mockup slots, not photography) and `people-consultancy.html`
(no image slots exist on that page yet).

## Founder photograph

`about.html`'s "Our founder" section has its own dedicated placeholder,
separate from the general photography above - do not fill it with a
stand-in photo of anyone else. Replace it once the actual founder
photograph and biography are supplied.
