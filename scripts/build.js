/**
 * Bundles the content script into a single IIFE for MV3.
 * The background service worker and popup scripts are loaded
 * natively as ES modules by Chrome, so they are not bundled.
 */
import { build } from 'esbuild';

await build({
  entryPoints: ['content/content.js'],
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  outfile: 'dist/content.bundle.js',
});

console.log('✓ dist/content.bundle.js');
