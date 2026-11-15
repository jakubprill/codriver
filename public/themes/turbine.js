// V · Turbine – a ring of slanted blue blades that light up with the RPM, like a turbine spinning up;
// speed and gear in the middle, a small analogue speedometer beside it, pedal bars on the left.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, fmtG, clamp, blinkOn, polar, ZONES } from '../lib/util.js';
import { arc, ticks } from '../lib/gauge.js';

const C = { bg: '#05070b', fg: '#eef4fb', muted: '#6d7d92', blade: '#3fc4ff', bladeOff: '#0d1b2a', red: '#ff4058', rim: '#9aa6b8', needle: '#ffffff' };

const CSS = `
.t-turbine { position: absolute; inset: 0; color: ${C.fg}; font-family: 'Sarpanch', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums;
  background: radial-gradient(ellipse at 45% 50%, #0e1622 0, ${C.bg} 60%); }
.t-turbine svg { position: absolute; inset: 0; overflow: visible; }
.t-turbine .spd { position: absolute; left: 520px; top: 270px; width: 360px; text-align: center; font-size: 140px; font-weight: 600; line-height: 1; }
.t-turbine .unit { position: absolute; left: 520px; width: 360px; text-align: center; top: 236px; font-size: 26px; color: ${C.muted}; }
.t-turbine .gear { position: absolute; left: 520px; top: 420px; width: 360px; text-align: center; font-size: 120px; font-weight: 600; line-height: 1; }
.t-turbine .gear.shift { color: ${C.red}; }
.t-turbine .pan { position: absolute; left: 90px; top: 200px; width: 250px; font-size: 22px; color: ${C.muted}; line-height: 1.4; }
.t-turbine .pan .row { display: flex; align-items: center; gap: 12px; margin: 8px 0; }
.t-turbine .pan .bar { flex: 1; height: 8px; background: #152233; position: relative; }
.t-turbine .pan .bar i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: var(--c); }
.t-turbine .pan .box { margin-top: 26px; padding: 14px 16px; border: 2px solid #2a3646; border-radius: 6px; }
.t-turbine .pan .box b { display: block; font-size: 40px; color: ${C.fg}; font-weight: 500; }
.t-turbine .status { position: absolute; left: 0; right: 0; bottom: 30px; text-align: center; font-size: 22px; color: ${C.muted}; }
`;

const CX = 700, CY = 400, R0 = 220, R1 = 320;
const BLADES = 30, A0 = 200, A1 = 520; // 320°, a gap at the bottom right
const SX = 1290, SY = 470, SR = 200, S0 = 225, S1 = 495, SPEED_MAX = 240;

/** A slanted blade between two radii: a parallelogram leaning into the direction of travel. */
function blade(a) {
  const p = (r, d) => polar(CX, CY, r, a + d).map((v) => v.toFixed(1)).join(',');
  return `${p(R0, 0)} ${p(R0, 5)} ${p(R1, 16)} ${p(R1, 11)}`;
}

export default {
  id: 'turbine',
  name: 'Turbine',
  description: 'A ring of slanted blue blades that light up like a spinning turbine',
  create(stage) {
    useFont('Sarpanch:wght@500;600');
    useStyle('turbine', CSS);

    const svg = s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, 'aria-hidden': 'true' });
    svg.append(
      s('circle', { cx: CX, cy: CY, r: R1 + 26, fill: 'none', stroke: 'url(#turbine-rim)', 'stroke-width': 14 }),
      s('circle', { cx: CX, cy: CY, r: R0 - 12, fill: '#05080d', stroke: '#1d2a3a', 'stroke-width': 3 }),
      s('defs', {}, s('linearGradient', { id: 'turbine-rim', x1: 0, y1: 0, x2: 1, y2: 1 },
        s('stop', { offset: 0, 'stop-color': '#3a4454' }), s('stop', { offset: 0.5, 'stop-color': C.rim }), s('stop', { offset: 1, 'stop-color': '#1a202a' }))));
    const blades = Array.from({ length: BLADES }, (_, i) => {
      const b = s('polygon', { points: blade(A0 + ((A1 - A0) * i) / BLADES), fill: C.bladeOff });
      svg.append(b);
      return b;
    });
    // small analogue speedometer
    svg.append(
      s('circle', { cx: SX, cy: SY, r: SR + 14, fill: '#06090e', stroke: '#2a3646', 'stroke-width': 3 }),
      ticks({ cx: SX, cy: SY, r: SR, len: 12, longLen: 26, from: S0, to: S1, step: 270 / 24, long: (i) => i % 2 === 0, stroke: C.fg }));
    const lab = s('g', { 'font-size': 26, fill: C.fg, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    for (let v = 0; v <= SPEED_MAX; v += 40) {
      const [x, y] = polar(SX, SY, SR - 50, S0 + ((S1 - S0) * v) / SPEED_MAX);
      lab.append(s('text', { x, y }, String(v)));
    }
    const needle = s('line', { stroke: C.needle, 'stroke-width': 5, 'stroke-linecap': 'round' });
    svg.append(lab, needle, s('circle', { cx: SX, cy: SY, r: 12, fill: '#2a3646' }),
      s('text', { x: SX, y: SY + 60, 'font-size': 22, fill: C.muted, 'text-anchor': 'middle' }, 'km/h'),
      s('path', { d: arc(CX, CY, R0 - 30, 120, 165), fill: 'none', stroke: C.muted, 'stroke-width': 2 }));

    const spd = h('div', { class: 'spd' }, '0');
    const gear = h('div', { class: 'gear' }, 'N');
    const bar = (label, color) => {
      const i = h('i', { style: `--c:${color}` });
      return { el: h('div', { class: 'row' }, h('span', { style: 'width:70px' }, label), h('div', { class: 'bar' }, i)), i };
    };
    const thr = bar('thr.', C.blade);
    const brk = bar('brk.', C.red);
    const clu = bar('clu.', C.rim);
    const time = h('b', {}, '0:00.0');
    const dist = h('b', {}, '0 m');
    const gf = h('b', {}, '0.0 g');
    const status = h('div', { class: 'status' });
    stage.append(h('div', { class: 't-turbine' }, svg, spd, h('div', { class: 'unit' }, 'km/h'), gear,
      h('div', { class: 'pan' }, thr.el, brk.el, clu.el,
        h('div', { class: 'box' }, 'stage time', time, 'distance', dist, 'g-force', gf)),
      status));

    let lit = -1;
    let hot = false;
    return {
      update(f) {
        status.textContent = '';
        const { frac, atLimit } = rpmInfo(f);
        const n = atLimit && !blinkOn() ? 0 : Math.round(frac * BLADES);
        const red = frac >= ZONES.red;
        if (n !== lit || red !== hot) {
          lit = n;
          hot = red;
          blades.forEach((b, i) => b.setAttribute('fill', i < n ? (red ? C.red : C.blade) : C.bladeOff));
        }
        const a = S0 + (S1 - S0) * clamp(f.speedKmh / SPEED_MAX);
        const [x0, y0] = polar(SX, SY, -20, a);
        const [x1, y1] = polar(SX, SY, SR - 14, a);
        Object.entries({ x1: x0, y1: y0, x2: x1, y2: y1 }).forEach(([k, v]) => needle.setAttribute(k, v.toFixed(1)));
        spd.textContent = Math.round(f.speedKmh);
        gear.textContent = gearText(f.gear);
        gear.classList.toggle('shift', red);
        thr.i.style.width = `${clamp(f.throttle) * 100}%`;
        brk.i.style.width = `${clamp(f.brake) * 100}%`;
        clu.i.style.width = `${clamp(f.clutch) * 100}%`;
        time.textContent = fmtTime(f.lapTime);
        dist.textContent = `${fmtInt(f.lapDistance)} m`;
        gf.textContent = fmtG(f);
      },
      idle(text) {
        status.textContent = text;
        lit = -1;
        blades.forEach((b) => b.setAttribute('fill', C.bladeOff));
        spd.textContent = '0';
        gear.textContent = 'N';
        gear.classList.remove('shift');
        [thr, brk, clu].forEach((b) => { b.i.style.width = '0'; });
      },
    };
  },
};
