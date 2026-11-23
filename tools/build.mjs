// Bundles index.html + css + js into single-file builds.
//   node tools/build.mjs [outDir]
// Writes:
//   <outDir>/dealer-empire.html   standalone page (open directly in a browser)
//   <outDir>/artifact.html        body-only fragment for hosts that supply the document skeleton
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(root, 'dist');
mkdirSync(out, { recursive: true });
const html = readFileSync(join(root, 'index.html'), 'utf8');
const css = [...html.matchAll(/<link rel="stylesheet" href="(css\/[^"]+)">/g)].map(m => readFileSync(join(root, m[1]), 'utf8')).join('\n');
const localScripts = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]);
const cdnScripts = [...html.matchAll(/<script src="(https:[^"]+)"><\/script>/g)].map(m => m[0]);
const js = localScripts.map(p => `/* ${p} */\n` + readFileSync(join(root, p), 'utf8')).join('\n');
const fontLink = html.match(/<link rel="stylesheet" href="https:\/\/fonts[^>]+>/)[0];
const title = html.match(/<title>[^<]*<\/title>/)[0];
const desc = html.match(/<meta name="description"[^>]+>/)[0];
const safeJs = js.replace(/<\/script/gi, '<\\/script');

const body = `<div id="app"></div>\n${cdnScripts.join('\n')}\n<script>\n${safeJs}\n</script>`;
const standalone = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${title}\n${desc}\n${fontLink}\n<style>\n${css}\n</style>\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
const fragment = `${title}\n<meta name="claude:viewport-fit-sides" content="cover">\n${fontLink}\n<style>\n${css}\n</style>\n${body}\n`;
writeFileSync(join(out, 'dealer-empire.html'), standalone);
writeFileSync(join(out, 'artifact.html'), fragment);
console.log(`Built ${localScripts.length} scripts → ${out} (${(standalone.length / 1024).toFixed(0)} KB)`);
