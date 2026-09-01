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

// A property may legally be called `do`, `if` or `in`, and terser will happily
// mangle one to a keyword because `o.do` is valid JavaScript. Roadroller disagrees:
// its tokenizer sees a keyword, decides the `/` after it opens a REGEX rather than
// a division, and then runs to the end of the file looking for the closing slash.
// What comes out is "Packer: invalid JS code in the input" - the build dying in one
// second, with no line, no name and nothing pointing at the cause.
//
// It is not hypothetical and it is not rare. main.js has TEN places where a mangled
// property is followed directly by a division (`C._F / (C._F + z)`, `C._HL / 2`,
// `C._FIRE / C._FIREG ** l` ...), and which name lands on which property is decided
// by frequency order. Adding two unrelated config keys was enough to move `_HL`
// onto `do` and break the build.
//
// So the generator skips them. They are three of the fifty-four two-character names
// and a handful of the three-character ones, so the cost is nothing, and it makes a
// whole class of build failure impossible instead of waiting to be rediscovered.
const RESERVED = new Set([
  'do', 'if', 'in', 'of', 'for', 'new', 'try', 'var', 'let', 'case', 'else', 'enum',
  'eval', 'null', 'this', 'true', 'void', 'with', 'break', 'catch', 'class', 'const',
  'false', 'super', 'throw', 'while', 'yield', 'delete', 'export', 'import', 'public',
  'return', 'static', 'switch', 'typeof', 'default', 'extends', 'finally', 'package',
  'private', 'continue', 'debugger', 'function', 'arguments', 'interface', 'protected',
  'implements', 'instanceof',
]);
// base54, the same alphabet terser uses: a name cannot START with a digit, so the
// first character comes from a smaller set than the rest.
const FIRST = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_';
const REST = FIRST + '0123456789';
const base54 = (n) => {
  let s = FIRST[n % FIRST.length];
  n = (n / FIRST.length) | 0;
  while (n > 0) { n--; s += REST[n % REST.length]; n = (n / REST.length) | 0; }
  return s;
};
// get(n) has to be stable for a given n, so the kept names are built up in order
// and remembered rather than recomputed around the gaps.
const NAMES = [];
let scanned = 0;
export const nthIdentifier = {
  get(n) {
    while (NAMES.length <= n) {
      const s = base54(scanned++);
      if (!RESERVED.has(s)) NAMES.push(s);
    }
    return NAMES[n];
  },
  // terser's property mangler only ever calls get(), but the interface it replaces
  // has these too and a future version may reach for them.
  consider() {}, sort() {}, reset() {},
};

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
      nth_identifier: nthIdentifier,
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
