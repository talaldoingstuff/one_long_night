// Shared js13k build config. vite.config.js and tools/sdk-cost.js both use this so
// the SDK measurement is packed by exactly the same pipeline as the game.
import { js13kViteConfig, defaultTerserOptions } from 'js13k-vite-plugins';
import { inlinePlugin, HTML_MINIFY } from './inline.js';

// DESIGN.md 3: Roadroller only if the JS exceeds ~8KB; test both ways.
// ROADROLLER=1 npm run size  flips it on.
export const ROADROLLER = process.env.ROADROLLER === '1';

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
    roadrollerOptions: ROADROLLER ? {} : false,
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
