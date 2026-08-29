// Shared js13k build config. vite.config.js and tools/sdk-cost.js both use this so
// the SDK measurement is packed by exactly the same pipeline as the game.
import { js13kViteConfig, defaultTerserOptions } from 'js13k-vite-plugins';
import { inlinePlugin, HTML_MINIFY } from './inline.js';

// DESIGN.md 3: Roadroller only if the JS exceeds ~8KB; test both ways. The JS is
// 23.8KB now, and it was measured both ways: 9998 bytes packed without it, 8921
// with. ROADROLLER=0 npm run size  turns it back off to re-measure.
export const ROADROLLER = process.env.ROADROLLER !== '0';

// Its memory is worth setting rather than taking the default, and the curve is
// flat where it matters. Packed size against what the decompressor allocates:
//     8MB -> 9025    16MB -> 8921    32MB -> 8878    64MB -> 8857    150MB -> 8809
// The default is 150, which spends 274MB more than 16 to save 112 bytes. 16 gets
// 91% of the win for 7% of the memory, and boots in the same 235ms.
export const RR_MEMORY = 16;

// DESIGN.md 3: "Terser mangle.properties with a regex scope (e.g. names matching /^_/)".
// The package default mangles *every* unquoted non-builtin property, which silently
// breaks any object whose keys are read back by name. Scoping it to a leading
// underscore keeps the tuning config (and anything else) readable and safe.
export const terserOptions = {
  ...defaultTerserOptions,
  mangle: {
    ...defaultTerserOptions.mangle,
    properties: {
      ...defaultTerserOptions.mangle.properties,
      regex: /^_/,
    },
  },
};

export function packConfig({ root, outDir, define } = {}) {
  const cfg = js13kViteConfig({
    terserOptions,
    imageMinOptions: false,        // no image assets ship; skip the imagemin pass entirely
    roadrollerOptions: ROADROLLER ? { maxMemoryMB: RR_MEMORY } : false,
    htmlMinifyOptions: HTML_MINIFY,
    ectOptions: { level: 10009, strip: true },
    advzipOptions: { shrinkLevel: 'insane' },
  });
  if (!ROADROLLER) cfg.plugins.push(inlinePlugin());
  if (root) cfg.root = root;
  if (define) cfg.define = define;
  cfg.build = {
    ...cfg.build,
    outDir: outDir ?? 'dist',
    emptyOutDir: true,
    reportCompressedSize: false,
  };
  return cfg;
}
