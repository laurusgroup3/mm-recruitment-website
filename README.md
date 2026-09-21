# MM Recruitment Ltd — Website

Recruitment consultancy website for MM Recruitment Ltd.

## Status

Initial static foundation. No backend, database, or form handling is connected yet.

## Structure

```
index.html        Home page
about.html         About the company
jobs.html          Job listings (placeholder content)
employers.html     Information for employer clients
contact.html       Contact form (not yet wired to a backend)
css/styles.css     Shared stylesheet
js/main.js         Shared behaviour (mobile nav toggle)
assets/            Logo and favicon (placeholder brand mark)
```

## Branding

The gold colour palette and placeholder flower mark in `assets/logo.svg` and
`assets/favicon.svg` are stand-ins pending the company's approved brand
assets (logo files, exact colours, typography). Replace:

- CSS custom properties at the top of `css/styles.css` (`--color-gold`, etc.)
- `assets/logo.svg` and `assets/favicon.svg`

## Running locally

This is a static site with no build step. Open `index.html` directly in a
browser, or serve the folder with any static file server, e.g.:

```
npx serve .
```

## Next steps

- Confirm and apply approved brand assets (logo, colours, fonts)
- Connect the contact form to a backend or form service
- Replace placeholder job listings with a real data source
- Add real company content (About, sectors covered, contact details)
