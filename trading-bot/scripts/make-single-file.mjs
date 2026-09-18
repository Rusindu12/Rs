#!/usr/bin/env node
/**
 * Packs the Expo web export (dist/) into ONE self-contained HTML file.
 *
 *   node scripts/make-single-file.mjs
 *   → dist/AI-Trading-Bot.html
 *
 * The JS bundle is inlined, so the file runs by simply double-clicking it —
 * no web server, no internet hosting needed (API/stream data still comes
 * from Binance over the network). Handy for sharing: one file = whole app.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist', import.meta.url).pathname;
const html = readFileSync(join(dist, 'index.html'), 'utf8');

const bundleDir = join(dist, '_expo/static/js/web');
const bundleName = readdirSync(bundleDir).find((f) => f.endsWith('.js'));
if (!bundleName) throw new Error('no JS bundle found in dist/_expo/static/js/web');
const js = readFileSync(join(bundleDir, bundleName), 'utf8');

if (/<\/script/i.test(js)) {
  throw new Error('bundle contains </script — needs escaping before inlining');
}

const srcMatch = html.match(/<script src="([^"]+)"[^>]*><\/script>/);
if (!srcMatch) throw new Error('no script tag found in dist/index.html');

const out = html.replace(srcMatch[0], `<script>\n${js}\n</script>`);
const dest = join(dist, 'AI-Trading-Bot.html');
writeFileSync(dest, out);
console.log(`packed ${srcMatch[1]} → ${dest} (${(out.length / 1024).toFixed(0)} KB)`);
