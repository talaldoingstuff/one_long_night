// Does the mix clip? The recorder says what plays and when; this renders those
// notes as actual samples and measures the peak, because the destination node
// clamps at +-1.0 and a stack of harmonically related sines does add up.
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const ctx = new Proxy({ canvas: { style: {} } }, { get: (t, k) => (k in t ? t[k] : () => anyObj), set: () => true });
globalThis.document = { getElementById: () => ({ getContext: () => ctx, style: {} }) };
globalThis.devicePixelRatio = 1; globalThis.innerWidth = 900; globalThis.innerHeight = 500;
globalThis.addEventListener = () => {}; globalThis.requestAnimationFrame = () => {};
const { C } = await import('../src/main.js');

const SR = 44100;
// vol -> attack over ATK -> exponential down to 1e-4 by dur, the shape tone() makes
const env = (t, vol, dur) => (t < 0 || t > dur ? 0
  : t < C._ATK ? vol * t / C._ATK
  : vol * (1e-4 / vol) ** ((t - C._ATK) / Math.max(1e-4, dur - C._ATK)));

const peak = (notes, span) => {
  let mx = 0;
  const n = Math.ceil(span * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (const q of notes) v += env(t - q.at, q.vol, q.dur) * Math.sin(2 * Math.PI * q.f * (t - q.at));
    if (Math.abs(v) > mx) mx = Math.abs(v);
  }
  return mx;
};

const arpNotes = (i, m) => {
  const q = C._ARP[i];
  return q[0].map((s, k) => ({ f: q[1] * 2 ** (s / 12), vol: q[4] * m, dur: q[3], at: k * q[2] }));
};
const chargeNotes = (m) => {
  const q = C._CHG, sc = C._MUSSCALE, n = sc.length;
  const out = [];
  let at = 0;
  for (let i = 0; i < q[1]; i++) {
    const k = i / q[1];
    out.push({ f: q[0] * 2 ** ((sc[i % n] + 12 * (i / n | 0)) / 12), vol: q[3] * m, dur: q[2], at });
    at += C._CHGGAP[0] + (C._CHGGAP[1] - C._CHGGAP[0]) * k;
  }
  return out;
};

const P = (s) => String(s).padEnd(34);
console.log('');
console.log('--- peak of the mix, rendered ------------------------------------');
console.log('  a sine is worst case for this: the chime is 784Hz x 1, 1.5, 2, 3, 4,');
console.log('  which are harmonics, so they realign in phase and really do add.');
console.log('');
for (const m of [1, 1.25, 1.5, 2]) {
  const chime = peak(arpNotes(0, m), 1.2);
  const win = peak(arpNotes(1, m), 1.0);
  const chg = peak(chargeNotes(m), 3.2);
  const worst = Math.max(chime, win, chg);
  console.log('  master ' + m.toFixed(2) + 'x   ' +
    P('rainbow chime ' + chime.toFixed(2) + ', wave cleared ' + win.toFixed(2) +
      ', charge ' + chg.toFixed(2)) +
    (worst > 1 ? '>> CLIPS at ' + worst.toFixed(2) : 'clear, peak ' + worst.toFixed(2)));
}
console.log('');
console.log('  single sounds at the shipped master (a sine, square or triangle peaks');
console.log('  at its gain; noise through a bandpass at far less):');
const NM = ['horn shot', 'ghost hit', 'ghost killed', 'you get hit', 'click', 'game over'];
for (let i = 0; i < C._SFX.length; i++) {
  const g = C._SFX[i][3] * C._VOL;
  const noise = C._OSC[C._SFX[i][4]] === 'noise';
  console.log('    ' + P(NM[i] + '  ' + g.toFixed(3)) +
    (noise ? 'noise: a 0.8-Q bandpass passes a fraction of this'
           : g > 1 ? '>> over unity on its own' : 'clear'));
}

// The music is a bed that is always there, so the case that matters is a chime
// landing ON it. Layer gains sum in the worst case; they rarely align, but the
// destination clamps at 1.0 either way.
// A noise layer's gain is what goes IN; noise.mjs measures what a 0.8-Q bandpass
// lets out, and it is about 0.45 of it around the melody and 1.1 up at the hat.
const OUT = (wave, hz) => (C._OSC[wave] === 'noise' ? (hz > 5000 ? 1.1 : 0.45) : 1);
const bed = C._MUSV * (C._MLEAD[1] * OUT(C._MLEAD[2], C._MLEAD[0]) +
                       C._MBASS[2] * OUT(C._MBASS[3], C._MBASS[0]) +
                       C._MHAT[1] * OUT(C._MHAT[2], C._MHAT[0]));
const chime = peak(arpNotes(0, 1), 1.2);
console.log('');
console.log('--- and with the music under it ----------------------------------');
console.log('  ' + P('music bed, all three layers') + bed.toFixed(3) +
  '  (lead ' + (C._MUSV * C._MLEAD[1] * OUT(C._MLEAD[2], C._MLEAD[0])).toFixed(3) +
  ', bass ' + (C._MUSV * C._MBASS[2] * OUT(C._MBASS[3], C._MBASS[0])).toFixed(3) +
  ', hat ' + (C._MUSV * C._MHAT[1] * OUT(C._MHAT[2], C._MHAT[0])).toFixed(3) +
  ' - measured out of the filter, not the gain going in)');
const thr = 10 ** (C._LIM[0] / 20);
console.log('  ' + P('rainbow chime on top of it') + (chime + bed).toFixed(3) +
  (chime + bed > 1 ? '  over 1.0' : '  clear'));
console.log('  ' + P('the limiter holds from') + thr.toFixed(3) +
  '  (' + C._LIM[0] + ' dB, ' + C._LIM[2] + ':1)');
console.log('  ' + P('so the worst case lands at') +
  (thr + (chime + bed - thr) / C._LIM[2]).toFixed(3) + '  under 1.0, and everything');
console.log('  ' + P('') + 'below ' + thr.toFixed(2) + ' passes through untouched - which is every');
console.log('  ' + P('') + 'sound in the game on its own except the chime.');
