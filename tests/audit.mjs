// What in the source is not carrying its weight. Reads src/main.js as text and
// as a module, so it can tell an unused constant from one used once.
import { readFileSync } from 'node:fs';

const SRC = new URL('../src/main.js', import.meta.url);
const s = readFileSync(SRC, 'utf8');

const cfgStart = s.indexOf('export const C = {');
const cfgEnd = s.indexOf('\n};', cfgStart);
const cfg = s.slice(cfgStart, cfgEnd);
const body = s.slice(0, cfgStart) + s.slice(cfgEnd);

console.log('--- config keys --------------------------------------------------');
// Config keys carry a leading underscore so terser's mangle.properties, scoped
// to /^_/, can shorten them. The pattern has to follow.
const keys = [...cfg.matchAll(/^  (_[A-Z][A-Z0-9_]*):/gm)].map((m) => m[1]);
const unused = keys.filter((k) => !new RegExp('C\\.' + k + '\\b').test(body));
console.log('  ' + keys.length + ' keys, ' + (unused.length ? 'UNUSED: ' + unused.join(', ') : 'all referenced'));

console.log('\n--- top-level declarations ---------------------------------------');
const decls = [...s.matchAll(/^(?:export )?(?:const|let) ([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
const dead = decls.filter((d) => {
  const uses = (s.match(new RegExp('\\b' + d.replace(/\$/g, '\\$') + '\\b', 'g')) || []).length;
  return uses <= 1;
});
console.log('  ' + decls.length + ' declarations, ' + (dead.length ? 'NEVER USED: ' + dead.join(', ') : 'all used'));

console.log('\n--- exports ------------------------------------------------------');
const exps = [...s.matchAll(/^export (?:const|let) ([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
const internal = exps.filter((e) => {
  const after = s.slice(s.indexOf('export const ' + e) + 1);
  return new RegExp('\\b' + e + '\\b').test(after) || new RegExp('\\b' + e + '\\b').test(s.slice(0, s.indexOf('export const ' + e)));
});
console.log('  ' + exps.length + ' exports: ' + exps.join(', '));
console.log('  (exports are dropped by the app build, so a seam costs nothing)');

console.log('\n--- anything left from the previous game --------------------------');
const era = ['prism', 'ghost track', 'lane', 'tier', 'ribbon', 'herd', 'gallop', 'hoof', 'mountain',
  'parallax', 'horizon band', 'obstacle', 'gate', 'booster', 'energy bar', 'PPU', 'VIEW'];
// Whole words. Substring matching flagged 'lane' inside 'plane' and 'VIEW'
// inside it too, on a file that says 'sagittal plane' five times - so this had
// been reporting three leftovers from the old game for weeks, none of which
// existed, which is the fastest way to make a check stop being read.
const found = era.filter((t) => new RegExp('\b' + t + '\b', 'i').test(s));
console.log('  ' + (found.length ? 'MENTIONS: ' + found.join(', ') : 'nothing'));

console.log('\n--- the rainbow --------------------------------------------------');
const rbv = /const RBV = \[([^\]]*\])[^;]*;/.exec(s);
console.log('  RBV present: ' + (rbv ? 'yes' : 'NO'));
const uses = (s.match(/RBV/g) || []).length;
console.log('  referenced ' + (uses - 1) + ' time(s) beyond its declaration');

// An unused config key is dead weight in a 13KB budget, and anything left from
// the previous game is a name that should not be in this one. Both were reported
// and neither could be noticed by anything but a person reading the output.
process.exitCode = (unused.length || found.length) ? 1 : 0;
