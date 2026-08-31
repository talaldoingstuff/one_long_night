// The editors reference the module by name. This checks every M.x and C._X they
// use actually exists, that the page parses, and that it RUNS - the last of
// those is the one that matters. Parsing and name-checking both passed on an
// editor whose readout threw a ReferenceError on its first frame and rendered
// nothing at all, because the call was to a local helper that had been deleted,
// not to anything on M or C. Running it is the only way to see that.
import fs from 'fs';
import vm from 'vm';
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const ctx = new Proxy({ canvas: { style: {} } }, { get: (t, k) => (k in t ? t[k] : () => anyObj), set: () => true });
globalThis.document = { getElementById: () => ({ getContext: () => ctx, style: {} }) };
globalThis.devicePixelRatio = 1; globalThis.innerWidth = 900; globalThis.innerHeight = 500;
globalThis.addEventListener = () => {};
// One frame, then stop: enough to run everything a page does on load, without
// looping forever.
let raf = 0;
globalThis.requestAnimationFrame = (fn) => { if (raf++ < 2) fn(0); };
globalThis.localStorage = {};
// navigator is a getter-only global in Node, so patch what an editor uses onto it
if (!globalThis.navigator.clipboard) Object.defineProperty(globalThis.navigator, 'clipboard',
  { value: { writeText: () => {} }, configurable: true });
const M = await import('../src/main.js');

// A DOM thin enough to build a panel of sliders and buttons into, and to draw a
// canvas overlay onto. Anything an editor reaches for that is not here shows up
// as a throw, which is the point.
const el = () => {
  const e = { style: {}, classList: { add(){}, remove(){}, toggle(){}, contains: () => false },
              children: [], value: 0, textContent: '', dataset: {},
              addEventListener(){}, removeEventListener(){}, focus(){}, blur(){},
              setAttribute(){}, getAttribute: () => null,
              getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 300 }) };
  e.click = () => e.onclick && e.onclick({});
  e.querySelector = () => el();
  e.querySelectorAll = () => [];
  e.append = (...k) => e.children.push(...k);
  e.appendChild = (k) => e.children.push(k);
  e.getContext = () => ctx;
  e.remove = () => {};
  return e;
};
const byId = {};
globalThis.document = {
  getElementById: (id) => (byId[id] ||= el()),
  createElement: () => el(),
  body: el(),
};

let bad = 0;
for (const f of fs.readdirSync(new URL('../tools/', import.meta.url)).filter((n) => n.endsWith('.html'))) {
  const s = fs.readFileSync(new URL('../tools/' + f, import.meta.url), 'utf8');
  const body = s.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  try { new vm.SourceTextModule(body); } catch (e) { console.log('FAIL  ' + f + ' does not parse: ' + e.message); bad++; continue; }
  // Run it, by writing the script out and importing it: the globals above are
  // already in place, so it drives the same code a browser would. vm contexts
  // were tried first and hung - the game's own frame loop recurses through a
  // synchronous requestAnimationFrame, and a contextified global made that worse.
  let ran = '';
  raf = 0;
  for (const k of Object.keys(byId)) delete byId[k];
  const tmp = new URL('./.edcheck-' + f + '.mjs', import.meta.url);
  try {
    fs.writeFileSync(tmp, body.replace("await import('/src/main.js')",
      "await import('" + new URL('../src/main.js', import.meta.url).href + "')"));
    await import(tmp.href + '?t=' + Date.now());
  } catch (e) { ran = '  THREW ON LOAD: ' + e.message; }
  finally { try { fs.unlinkSync(tmp); } catch {} }
  const seams = [...new Set([...body.matchAll(/\bM\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]))];
  const keys = [...new Set([...body.matchAll(/\bC\.(_[A-Z0-9]+)/g)].map((m) => m[1]))];
  const missS = seams.filter((k) => !(k in M));
  const missK = keys.filter((k) => !(k in M.C));
  console.log((missS.length + missK.length + (ran ? 1 : 0) ? 'FAIL  ' : 'PASS  ') + f.padEnd(22) +
    seams.length + ' seams, ' + keys.length + ' config keys' +
    (missS.length ? '  MISSING SEAM: ' + missS.join(', ') : '') +
    (missK.length ? '  MISSING KEY: ' + missK.join(', ') : '') + ran);
  bad += missS.length + missK.length + (ran ? 1 : 0);
}
const NL = String.fromCharCode(10);
console.log(bad ? NL + '  ' + bad + ' problem(s)'
  : NL + '  every editor parses, resolves every name it uses, and runs a frame');
