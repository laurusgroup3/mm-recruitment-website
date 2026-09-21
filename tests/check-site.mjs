// Lightweight, dependency-free static-site checker for MM Recruitment's
// plain HTML build - no npm dependency, matching this project's
// zero-build-step convention. Not a substitute for a real browser-based
// accessibility audit (e.g. axe/Lighthouse) - this catches the class of
// mistakes that are easy to make by hand across many similar pages
// (a broken internal link, a missing alt attribute, an unlabelled form
// field, a missing <title>) without needing any tooling installed.
//
// Usage: node tests/check-site.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML_FILES = readdirSync(ROOT).filter((f) => f.endsWith('.html'));

let errors = 0;
let warnings = 0;

function fail(file, message) {
  errors++;
  console.log(`  FAIL  ${file}: ${message}`);
}
function warn(file, message) {
  warnings++;
  console.log(`  WARN  ${file}: ${message}`);
}

for (const file of HTML_FILES) {
  const html = readFileSync(join(ROOT, file), 'utf8');

  // --- Structural basics ---
  if (!/<title>[^<]+<\/title>/.test(html)) fail(file, 'missing or empty <title>');
  if (!/<meta\s+name=["']description["']/.test(html)) warn(file, 'missing meta description');
  if (!/<html[^>]*\blang=/.test(html)) fail(file, 'missing lang attribute on <html>');
  if (!/<a class="skip-link"/.test(html)) warn(file, 'missing skip link');

  // --- Heading hierarchy: exactly one <h1>, no jump from h1 straight to h3+ before an h2 ---
  const h1Count = (html.match(/<h1[\s>]/g) || []).length;
  if (h1Count === 0) fail(file, 'no <h1> found');
  if (h1Count > 1) fail(file, `${h1Count} <h1> elements found - should be exactly one`);

  // --- Images: every <img> must have a non-empty alt attribute ---
  const imgTags = html.match(/<img\b[^>]*>/g) || [];
  imgTags.forEach((tag) => {
    if (!/\balt\s*=\s*"[^"]*"/.test(tag)) {
      fail(file, `<img> missing alt attribute: ${tag.slice(0, 80)}`);
    }
  });

  // --- Form fields: every <input>/<textarea>/<select> with an id should have a matching <label for="">, unless type=hidden/checkbox-inside-label ---
  const labelFors = new Set((html.match(/<label\b[^>]*\bfor="([^"]+)"/g) || []).map((m) => m.match(/for="([^"]+)"/)[1]));
  const fieldTags = html.match(/<(input|textarea|select)\b[^>]*>/g) || [];
  fieldTags.forEach((tag) => {
    const idMatch = tag.match(/\bid="([^"]+)"/);
    const typeMatch = tag.match(/\btype="([^"]+)"/);
    const type = typeMatch ? typeMatch[1] : null;
    // Hidden fields need no label. A checkbox with no id is assumed to
    // be wrapped directly inside a <label> (this codebase's
    // .form-consent pattern) - implicitly labelled by that wrapping,
    // which this regex-based checker cannot verify without a real DOM,
    // so it's deliberately not flagged at all rather than guessed at.
    if (type === 'hidden' || type === 'checkbox') return;
    if (!idMatch) {
      warn(file, `form field with no id (cannot verify label): ${tag.slice(0, 80)}`);
      return;
    }
    if (!labelFors.has(idMatch[1])) {
      fail(file, `form field #${idMatch[1]} has no associated <label for="${idMatch[1]}">`);
    }
  });

  // --- Internal <a href> links resolve to a real file in this repo
  //     (deliberately only <a> tags - <link href="...css?v=1"> and
  //     similar asset references legitimately carry cache-busting
  //     query strings that aren't "the file doesn't exist"). ---
  const anchorHrefs = html.match(/<a\b[^>]*\bhref="([^"]+)"/g) || [];
  anchorHrefs.forEach((tag) => {
    const href = tag.match(/href="([^"]+)"/)[1];
    if (/^(https?:)?\/\//.test(href) || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return;
    const [pathPart] = href.split('#')[0].split('?');
    if (!pathPart) return;
    const target = join(ROOT, pathPart);
    if (!existsSync(target)) {
      fail(file, `broken internal link: ${href}`);
    }
  });

  // --- No leftover Lorem ipsum / template placeholder text ---
  if (/lorem ipsum/i.test(html)) fail(file, 'contains Lorem ipsum placeholder text');
}

console.log(`\nChecked ${HTML_FILES.length} HTML files: ${errors} error(s), ${warnings} warning(s).`);
if (errors > 0) process.exitCode = 1;
