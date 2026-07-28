/**
 * Bundle the built calculator into ONE self-contained HTML file.
 *
 * Artifacts run under a strict CSP that blocks every external request — no CDN
 * scripts, no external stylesheets, no fonts. Vite emits separate asset files,
 * so this inlines them. It also drops the document skeleton: the artifact host
 * supplies <!doctype>, <html>, <head> and <body>, and a second set nested inside
 * would be invalid.
 *
 * Usage:  node scripts/build_artifact.mjs
 * Output: app/dist/artifact.html
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = new URL('../app/dist/', import.meta.url).pathname;
const ASSETS = join(DIST, 'assets');

const files = readdirSync(ASSETS);
const cssFile = files.find((f) => f.endsWith('.css'));
const jsFile = files.find((f) => f.endsWith('.js'));

if (!cssFile || !jsFile) {
  console.error('no built assets found — run `npm run build` in app/ first');
  process.exit(1);
}

const css = readFileSync(join(ASSETS, cssFile), 'utf8');
const js = readFileSync(join(ASSETS, jsFile), 'utf8');

/**
 * A literal `</script>` anywhere in the bundle would close the tag early. The
 * sequence is legal inside a JS string, so escaping the slash is the fix that
 * keeps the code identical while making it safe to inline.
 */
const safeJs = js.replace(/<\/script/gi, '<\\/script');

const html = `<title>US → Japan tax calculator</title>
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${safeJs}
</script>
`;

const out = join(DIST, 'artifact.html');
writeFileSync(out, html);

const kb = (n) => `${Math.round(n / 1024)} kB`;
console.log(`OK    ${out}`);
console.log(`      css ${kb(css.length)} · js ${kb(js.length)} · total ${kb(html.length)}`);

// A self-contained page must not reference any external host. Catch a stray
// absolute URL in markup or CSS before it becomes a silent CSP failure.
const external = [...html.matchAll(/(?:src|href)\s*=\s*["']https?:\/\/[^"']+/gi)].map((m) => m[0]);
const remoteCss = [...html.matchAll(/url\(\s*["']?https?:\/\/[^)]+/gi)].map((m) => m[0]);
const problems = [...external, ...remoteCss];
if (problems.length) {
  console.error(`\nFAIL  ${problems.length} external reference(s) would be blocked by CSP:`);
  for (const p of problems.slice(0, 10)) console.error(`      ${p.slice(0, 100)}`);
  process.exit(1);
}
console.log('      no external references — CSP clean');
