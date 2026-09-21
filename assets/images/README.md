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
`.media-placeholder` block with a real `<img>` (see `index.html`'s
`.hero-media` for the working example of an already-real image slot's
markup shape) and remove the placeholder styling from that instance.

## Founder photograph

`about.html`'s "Our founder" section has its own dedicated placeholder,
separate from the general photography above - do not fill it with a
stand-in photo of anyone else. Replace it once the actual founder
photograph and biography are supplied.
