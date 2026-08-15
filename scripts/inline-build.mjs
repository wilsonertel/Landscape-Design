/**
 * Fold the production build into ONE self-contained HTML file.
 *
 * A normal Vite build loads its JS as `<script type="module" src=...>`, and
 * browsers refuse to fetch module scripts over file:// (CORS treats a local
 * file as origin "null"). So double-clicking dist/index.html gives a blank
 * page. Inlining the bundle removes the fetch entirely, which makes the
 * result openable straight from the file system — no server, no install.
 *
 * Run after `vite build`:  node scripts/inline-build.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const assets = join(dist, 'assets');

const files = readdirSync(assets);
const jsFile = files.find((f) => f.endsWith('.js'));
const cssFile = files.find((f) => f.endsWith('.css'));

if (!jsFile) {
  console.error('No JS bundle found in dist/assets — run `npm run build` first.');
  process.exit(1);
}

const js = readFileSync(join(assets, jsFile), 'utf8');
const css = cssFile ? readFileSync(join(assets, cssFile), 'utf8') : '';

let html = readFileSync(join(dist, 'index.html'), 'utf8');

/*
 * Insert with REPLACER FUNCTIONS, never with replacement strings.
 *
 * String.prototype.replace treats `$&`, `$\``, `$'` and `$1` in a replacement
 * *string* as substitution patterns, and a minified bundle is full of `$`.
 * Passing the payload as a plain string silently corrupts the JS — it fails
 * later with a syntax error a long way from the actual cause. A function
 * replacer returns its value verbatim.
 *
 * Inline text (rather than a data: URI or an external file) is what makes the
 * result work from file://: an inline script is never fetched, so the CORS
 * rule that blocks module scripts on local files never applies.
 */
const put = (value) => () => value;

html = html
  .replace(/\s*<script type="module"[^>]*><\/script>/, '')
  .replace(/\s*<link rel="stylesheet"[^>]*>/, '')
  .replace('</head>', put(`    <style>\n${css}\n    </style>\n  </head>`))
  .replace('</body>', put(`    <script type="module">\n${js}\n    </script>\n  </body>`));

// Cheap guard: if either payload failed to land, fail loudly rather than
// shipping an HTML file that opens to a blank page.
if (!html.includes('<style>') || html.length < js.length) {
  console.error('Inlining did not produce the expected output.');
  process.exit(1);
}

const out = join(dist, 'landscape-studio.html');
writeFileSync(out, html, 'utf8');

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`Wrote ${out} (${kb} KB) — open it directly in a browser.`);
