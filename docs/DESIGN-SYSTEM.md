# MM Recruitment Ltd — Design System

Written for: whoever maintains or extends this site's front end next.

All tokens live in `assets/css/style.css`'s `:root` block - nothing
below is duplicated logic, just a guide to what's there and why.

## Brand identity

MM Recruitment Ltd is an **independent brand** - this repository shares
no CSS, no fonts, and no visual tokens with Laurus Recruitment or any
other Laurus Group project. That's deliberate: MM Recruitment's public
experience should feel like its own service, with LOS acknowledged only
as the "Powered by" technology underneath (see the footer on every
page).

## Logo

Live: the approved gold angel-and-daisy mark + "MM Recruitment"
wordmark, in every page's header. See `assets/images/README.md` for
what was cropped from the supplied artwork (the tagline line, for the
header; a favicon-only icon crop for the tab icon) and why.

## Colour tokens

| Token | Hex | Use |
|---|---|---|
| `--ivory` | `#FAF7F1` | Page background |
| `--gold` | `#B18A43` | Primary accent, buttons, links |
| `--gold-dark` | `#93702f` | Hover states, darker accent text |
| `--champagne` | `#E9D7B4` | Warm section backgrounds, badges |
| `--charcoal` | `#26231F` | Body text, dark sections, footer |
| `--white` | `#FFFFFF` | Cards, form fields |

`--gold-dark` is the one token not in the original brief's palette - a
slightly deeper shade of the approved gold, used only for hover/focus
states so interactive elements have a visible state change without
introducing an unapproved colour family. If this isn't wanted, every
usage is confined to `:hover`/`:focus` rules in `style.css` and can be
swapped for `--gold` directly.

## Typography

- **Display / headings / wordmark**: [Fraunces](https://fonts.google.com/specimen/Fraunces) (variable serif) - loaded via Google Fonts `<link>` tags in every page's `<head>`. Chosen for its warmth without tipping into "generic recruitment template" territory.
- **Body / UI**: [Inter](https://fonts.google.com/specimen/Inter) - a clean, highly legible humanist sans, weights 400/500/600/700.

Both are loaded identically on every page - if you add a new page, copy
the two `<link rel="preconnect">` tags and the combined `<link
href="...fonts.googleapis.com/css2?family=Fraunces...">` tag from any
existing page's `<head>`.

## Layout primitives

- `.container` - the shared max-width (1180px) + gutter wrapper. Every section's content sits inside one.
- `.section` / `.section-tight` - vertical rhythm; `.section-warm` (champagne bg) and `.section-charcoal` (dark bg, inverted text colour) are the two background variants used for visual pacing down a page.
- `.split` / `.split.reverse` - the image-and-copy two-column layout used throughout (About, Home, Candidates, Employers). `.reverse` flips which side the image sits on without duplicating markup logic - just add the class.
- `.grid.grid-2/3/4` - simple responsive card grids, collapsing to 2 columns at tablet and 1 at phone width (see the `@media` block at the bottom of `style.css`).

## Components

- `.button.primary/.secondary/.on-dark` - three button treatments; `.on-dark` is specifically for use on `.section-charcoal`/hero-on-photo contexts where `.secondary`'s dark border/text would disappear.
- `.card` / `.value-card` - the two content-card shapes (services/values grids).
- `.media-placeholder` - the warm-gradient "photography coming soon" block used everywhere real photography hasn't been supplied yet. Replace with a real `<img>` as photography arrives (see `assets/images/README.md`).
- `.coming-soon-badge` + `.mock-portal-panel` - the explicitly-inert portal preview components (`candidate-portal.html`/`employer-portal.html`). `fieldset[disabled]` inside `.mock-portal-panel` is load-bearing - it's what makes the sign-in form genuinely non-interactive, not just styled to look disabled.
- `.review-banner` + `.tbc` - used throughout the legal pages to flag content that needs a real answer from the business before publishing. Search any HTML file for `class="tbc"` to find every outstanding placeholder.

## Accessibility notes already built in

- Skip link (`.skip-link`) as the first focusable element on every page.
- Mobile nav toggle has `aria-expanded`/`aria-controls`, closes on Escape and on link click (`assets/js/main.js`).
- Every form field has a real `<label for="">`, not just a placeholder.
- Colour contrast: body text (`--charcoal` on `--ivory`/`--white`) and header text on `--charcoal` sections were chosen to meet WCAG AA at normal text sizes - re-check with a contrast tool if any token is changed.
- `prefers-reduced-motion` isn't explicitly handled yet, since the only animation on the site is small hover transitions (buttons, nav) - worth adding an override if any larger motion is introduced later.

## Adding a new page

There's no shared header/footer partial in this build (plain static
HTML, no templating layer, matching this project's zero-build-step
Cloudflare Pages deployment) - copy the `<header>`/`<footer>` block from
an existing page verbatim, update the active nav link's `aria-current`,
and update the `<title>`/meta description/canonical URL for the new
page. See `docs/DEPLOYMENT.md` if introducing anything that needs a new
Cloudflare Pages Function.
