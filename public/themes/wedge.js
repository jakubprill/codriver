// Q · Wedge – a wide angular GT display: a grey RPM ramp lit blue from underneath, gear and speed
// at its foot, two small pedal dials on the left, the stage data boxed on the right.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, fmtG, clamp, blinkOn, ZONES } from '../lib/util.js';
import { arc, fillPath, ticks } from '../lib/gauge.js';
import { createStats } from '../lib/stats.js';

const C = { bg: '#000', fg: '#f4f6fa', muted: '#7b8190', frame: '#d8dce4', ramp: '#3a3d45', rampHi: '#a9adb6', blue: '#2f6bff', red: '#ff3030', green: '#3ad66b', orange: '#ff7a1f' };

const CSS = `
.t-wedge { position: absolute; inset: 0; background: ${C.bg}; color: ${C.fg}; font-family: 'Oxanium', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums; }
.t-wedge svg { position: absolute; inset: 0; overflow: visible; }
.t-wedge .gear { position: absolute; left: 560px; top: 380px; width: 200px; text-align: center; font-size: 130px; font-weight: 700; line-height: 1; }
.t-wedge .gear.shift { color: ${C.red}; }
.t-wedge .gl { position: absolute; left: 560px; top: 510px; width: 200px; text-align: center; font-size: 22px; color: ${C.muted}; }
.t-wedge .spd { position: absolute; left: 500px; top: 560px; width: 320px; text-align: center; font-size: 76px; font-weight: 600; }
.t-wedge .spd small { font-size: 22px; color: ${C.muted}; margin-left: 6px; }
.t-wedge .mode { position: absolute; left: 190px; top: 190px; font-size: 28px; font-weight: 700; font-style: italic; letter-spacing: .08em; }
.t-wedge .dv { position: absolute; width: 140px; text-align: center; font-size: 40px; font-weight: 600; top: 302px; }
.t-wedge .dv small { display: block; font-size: 18px; color: ${C.muted}; }
.t-wedge .box { position: absolute; top: 600px; width: 180px; white-space: nowrap; padding: 8px 14px; border: 1px solid #3a3e48; font-size: 20px; color: ${C.muted}; }
.t-wedge .box b { display: block; font-size: 32px; color: ${C.fg}; font-weight: 600; }
.t-wedge .status { position: absolute; left: 0; right: 0; bottom: 30px; text-align: center; font-size: 24px; color: ${C.muted}; }
`;

// the ramp: an outer curve from the gear up to the top right
const ramp = (t) => [760 + 660 * t, 600 - 400 * Math.sqrt(t)];
const N = 40;

export default {
  id: 'wedge',
  name: 'Wedge',
  description: 'Wide angular GT display: a grey ramp lit blue, small pedal dials, boxed stage data',
  create(stage) {
    useFont('Oxanium:wght@400;600;700');
    useStyle('wedge', CSS);
    const stats = createStats();

    const svg = s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, 'aria-hidden': 'true' });
    // frame: a wide wedge, narrower at the bottom
    svg.append(s('path', { d: 'M60 120 L1540 90 L1490 720 L110 700 Z', fill: 'none', stroke: C.frame, 'stroke-width': 4 }),
      s('path', { d: 'M170 240 L560 240 L620 280 M170 540 L520 540', fill: 'none', stroke: '#4a4e58', 'stroke-width': 3 }));

    // ramp band: quads along the curve, the lit (blue) part underneath
    const quads = [];
    for (let i = 0; i < N; i++) {
      const [ax, ay] = ramp(i / N);
      const [bx, by] = ramp((i + 1) / N);
      const w0 = 30 + 60 * (i / N), w1 = 30 + 60 * ((i + 1) / N);
      const q = s('polygon', { points: `${ax},${ay} ${bx},${by} ${bx},${by - w1} ${ax},${ay - w0}`, fill: `url(#wedge-ramp)` });
      const base = s('line', { x1: ax, y1: ay, x2: bx, y2: by, stroke: '#1a1c22', 'stroke-width': 12, 'stroke-linecap': 'butt' });
      quads.push(base);
      svg.append(q, base);
    }
    svg.prepend(s('defs', {}, s('linearGradient', { id: 'wedge-ramp', x1: 0, y1: 1, x2: 0, y2: 0 },
      s('stop', { offset: 0, 'stop-color': C.rampHi }), s('stop', { offset: 1, 'stop-color': C.ramp }))));
    const scale = s('g', { 'font-size': 38, 'font-weight': 700, fill: C.fg, 'text-anchor': 'middle' });
    svg.append(scale);
    let scaleMax = 0;
    const drawScale = (max) => {
      scaleMax = max;
      scale.replaceChildren();
      for (let k = 1; k * 1000 <= max; k++) {
        const t = (k * 1000) / max;
        const [x, y] = ramp(t);
        scale.append(s('text', { x: x - 6, y: y - (30 + 60 * t) - 14, fill: t >= ZONES.red ? C.red : C.fg }, String(k)));
      }
    };

    // pedal dials
    const dial = (cx, color) => {
      svg.append(ticks({ cx, cy: 340, r: 70, len: 6, from: 225, to: 495, step: 27, stroke: '#565b66' }),
        s('path', { d: arc(cx, 340, 80, 225, 495), fill: 'none', stroke: '#1d2027', 'stroke-width': 6 }));
      const p = fillPath(arc(cx, 340, 80, 225, 495), { stroke: color, 'stroke-width': 6 });
      svg.append(p);
      return p;
    };
    const thrDial = dial(260, C.green);
    const brkDial = dial(460, C.red);
    // g-force: a segmented bar bottom left
    const gCells = Array.from({ length: 16 }, (_, i) => s('rect', { x: 190 + i * 22, y: 470, width: 16, height: 14, fill: '#22252c' }));
    svg.append(...gCells);

    const gear = h('div', { class: 'gear' }, 'N');
    const spdVal = h('span', {}, '0');
    const thr = h('div', { class: 'dv', style: 'left:190px' }, '0', h('small', {}, 'throttle %'));
    const brk = h('div', { class: 'dv', style: 'left:390px' }, '0', h('small', {}, 'brake %'));
    const box = (x, label) => {
      const v = h('b', {}, '–');
      root.append(h('div', { class: 'box', style: `left:${x}px` }, label, v));
      return v;
    };
    const gLabel = h('div', { class: 'gl', style: 'left:190px;top:494px;width:auto;text-align:left' }, 'g-force 0.0 g');
    const status = h('div', { class: 'status' });
    const root = h('div', { class: 't-wedge' }, svg, h('div', { class: 'mode' }, 'STAGE ▸'), thr, brk, gLabel, gear, h('div', { class: 'gl' }, 'gear'),
      h('div', { class: 'spd' }, spdVal, h('small', {}, 'km/h')), status);
    stage.append(root);
    const time = box(900, 'stage time');
    const top = box(1110, 'top speed');
    const dist = box(1320, 'distance');

    let lit = -1;
    return {
      update(f) {
        status.textContent = '';
        const st = stats.update(f);
        const { max, frac, atLimit } = rpmInfo(f);
        if (max && max !== scaleMax) drawScale(max);
        const n = atLimit && !blinkOn() ? 0 : Math.round(frac * N);
        if (n !== lit) {
          lit = n;
          quads.forEach((q, i) => q.setAttribute('stroke', i < n ? (i / N >= ZONES.red ? C.red : C.blue) : '#1a1c22'));
        }
        gear.classList.toggle('shift', frac >= ZONES.red);
        gear.textContent = gearText(f.gear);
        spdVal.textContent = Math.round(f.speedKmh);
        thrDial.set(f.throttle);
        brkDial.set(f.brake);
        thr.firstChild.textContent = Math.round(clamp(f.throttle) * 100);
        brk.firstChild.textContent = Math.round(clamp(f.brake) * 100);
        const g = Math.hypot(f.gLat, f.gLon);
        const ng = Math.round(clamp(g / 2) * gCells.length);
        gCells.forEach((c, i) => c.setAttribute('fill', i < ng ? (i > 11 ? C.red : C.orange) : '#22252c'));
        gLabel.textContent = `g-force ${fmtG(f)}`;
        time.textContent = fmtTime(f.lapTime);
        top.textContent = `${Math.round(st.top)} km/h`;
        dist.textContent = `${fmtInt(f.lapDistance)} m`;
      },
      idle(text) {
        status.textContent = text;
        lit = -1;
        quads.forEach((q) => q.setAttribute('stroke', '#1a1c22'));
        thrDial.set(0);
        brkDial.set(0);
        gear.classList.remove('shift');
        gear.textContent = 'N';
        spdVal.textContent = '0';
      },
    };
  },
};
