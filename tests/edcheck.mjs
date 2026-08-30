// The editors reference the module by name. This checks every M.x and C._X they
// use actually exists, and that the page parses - a broken editor is only found
// by opening it otherwise.
import fs from 'fs';
import vm from 'vm';
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const ctx = new Proxy({ canvas: { style: {} } }, { get: (t, k) => (k in t ? t[k] : () => anyObj), set: () => true });
globalThis.document = { getElementById: () => ({ getContext: () => ctx, style: {} }) };
globalThis.devicePixelRatio = 1; globalThis.innerWidth = 900; globalThis.innerHeight = 500;
globalThis.addEventListener = () => {}; globalThis.requestAnimationFrame = () => {};
const M = await import('../src/main.js');

let bad = 0;
for (const f of fs.readdirSync(new URL('../tools/', import.meta.url)).filter((n) => n.endsWith('.html'))) {
  const s = fs.readFileSync(new URL('../tools/' + f, import.meta.url), 'utf8');
  const body = s.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  try { new vm.SourceTextModule(body); } catch (e) { console.log('FAIL  ' + f + ' does not parse: ' + e.message); bad++; continue; }
  const seams = [...new Set([...body.matchAll(/\bM\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]))];
  const keys = [...new Set([...body.matchAll(/\bC\.(_[A-Z0-9]+)/g)].map((m) => m[1]))];
  const missS = seams.filter((k) => !(k in M));
  const missK = keys.filter((k) => !(k in M.C));
  console.log((missS.length + missK.length ? 'FAIL  ' : 'PASS  ') + f.padEnd(22) +
    seams.length + ' seams, ' + keys.length + ' config keys' +
    (missS.length ? '  MISSING SEAM: ' + missS.join(', ') : '') +
    (missK.length ? '  MISSING KEY: ' + missK.join(', ') : ''));
  bad += missS.length + missK.length;
}
console.log(bad ? '\n  ' + bad + ' broken reference(s)' : '\n  every editor parses and every name it uses exists');
