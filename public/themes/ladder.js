// M · Ladder – a 2000s Japanese sports-car look: a wide arc of thin amber bars for the RPM,
// red seven-segment speed below, bar gauges for throttle and brake, an amber LCD for the stage.
import { h, s, useFont, useStyle, rpmInfo, gearText, clamp, blinkOn, polar, ZONES } from '../lib/util.js';
import { sevenSeg } from '../lib/seg7.js';

const C = { bg: '#030202', off: '#2a1606', amber: '#ffb21e', orange: '#ff7a12', red: '#ff2a12', fg: '#f3e6d6', muted: '#8a7a6a', lcd: '#ffb84a' };

const CSS = `
.t-ladder { position: absolute; inset: 0; color: ${C.fg}; font-family: 'Saira Condensed', 'Arial Narrow', sans-serif; font-variant-numeric: tabular-nums;
  background: radial-gradient(ellipse at 50% 60%, #120a05 0, ${C.bg} 65%); }
.t-ladder svg { position: absolute; overflow: visible; }
.t-ladder .k { position: absolute; font-size: 26px; color: ${C.muted}; letter-spacing: .06em; }
.t-ladder .gear { position: absolute; left: 1062px; top: 606px; font-size: 110px; font-weight: 700; color: ${C.amber}; line-height: 1; }
.t-ladder .gear.shift { color: ${C.red}; }
.t-ladder .lcd { position: absolute; left: 560px; top: 620px; width: 480px; height: 90px; border-radius: 8px; background: #140b03; box-shadow: inset 0 0 0 2px #2a1a08; }
.t-ladder .status { position: absolute; left: 0; right: 0; bottom: 30px; text-align: center; font-size: 26px; color: ${C.muted}; }
`;

const CX = 800, CY = 780; // the bars radiate from a point near the bottom edge
const R0 = 540, R1 = 660;
const A0 = -62, A1 = 58;
const N = 96;

export default {
  id: 'ladder',
  name: 'Ladder',
  description: '2000s sports car: a wide arc of thin amber bars, red digital speed',
  create(stage) {
    useFont('Saira+Condensed:wght@500;700');
    useStyle('ladder', CSS);

    const bars = [];
    const scale = s('g', { 'font-size': 44, 'font-weight': 700, fill: C.fg, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-style': 'italic' });
    const svg = s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, style: 'left:0;top:0', 'aria-hidden': 'true' });
    for (let i = 0; i < N; i++) {
      const a = A0 + ((A1 - A0) * i) / (N - 1);
      const len = (R1 - R0) * (0.55 + 0.45 * (i / (N - 1))); // the bars grow longer towards the top of the range
      const [x0, y0] = polar(CX, CY, R0, a);
      const [x1, y1] = polar(CX, CY, R0 + len, a);
      const line = s('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: C.off, 'stroke-width': 7 });
      bars.push(line);
      svg.append(line);
    }
    svg.append(scale);
    let scaleMax = 0;
    const drawScale = (max) => {
      scaleMax = max;
      scale.replaceChildren();
      for (let k = 0; k * 1000 <= max; k++) {
        const [x, y] = polar(CX, CY, R0 - 50, A0 + ((A1 - A0) * k * 1000) / max);
        scale.append(s('text', { x, y }, String(k)));
      }
    };

    const spd = sevenSeg({ count: 3, w: 92, h: 170, gap: 22, x: 640, y: 330, on: C.red, ghost: 'rgba(255, 42, 18, 0.06)', skew: -8 });
    const dist = sevenSeg({ count: 6, w: 30, h: 54, gap: 10, x: 590, y: 638, on: C.lcd, ghost: 'rgba(255, 184, 74, 0.06)' });
    const time = sevenSeg({ count: 5, w: 30, h: 54, gap: 10, x: 830, y: 638, on: C.lcd, ghost: 'rgba(255, 184, 74, 0.06)' });

    // throttle and brake: rows of short segments, like coolant and fuel gauges
    const segBar = (x, y) => {
      const cells = Array.from({ length: 12 }, (_, i) => s('rect', { x: x + i * 26, y, width: 20, height: 34, fill: C.off }));
      svg.append(...cells);
      return (v, color) => cells.forEach((c, i) => c.setAttribute('fill', i < Math.round(clamp(v) * cells.length) ? color : C.off));
    };
    const thr = segBar(140, 620);
    const brk = segBar(1170, 620);
    const gear = h('div', { class: 'gear' }, 'N');
    const status = h('div', { class: 'status' });

    stage.append(h('div', { class: 't-ladder' }, svg, h('div', { class: 'lcd' }), spd.svg, dist.svg, time.svg, gear,
      h('div', { class: 'k', style: 'left:990px;top:470px' }, 'km/h'),
      h('div', { class: 'k', style: 'left:140px;top:580px' }, 'throttle'),
      h('div', { class: 'k', style: 'left:1170px;top:580px' }, 'brake'),
      h('div', { class: 'k', style: 'left:1062px;top:720px' }, 'gear'),
      h('div', { class: 'k', style: 'left:590px;top:720px' }, 'distance, m'),
      h('div', { class: 'k', style: 'left:830px;top:720px' }, 'stage time'),
      status));

    let lit = -1;
    let hidden = false;
    return {
      update(f) {
        status.textContent = '';
        const { max, frac, atLimit } = rpmInfo(f);
        if (max && max !== scaleMax) drawScale(max);
        const n = Math.round(frac * N);
        const off = atLimit && !blinkOn();
        if (n !== lit || off !== hidden) {
          lit = n;
          hidden = off;
          bars.forEach((b, i) => {
            const at = i / N;
            const color = at >= ZONES.red ? C.red : at >= ZONES.amber ? C.orange : C.amber;
            b.setAttribute('stroke', i < n && !off ? color : at >= ZONES.red ? '#3a0c06' : C.off);
          });
        }
        spd.set(String(Math.round(f.speedKmh)));
        dist.set(String(Math.round(f.lapDistance) % 1e6));
        const t = Math.floor(f.lapTime);
        time.set(`${Math.floor(t / 60)}${String(t % 60).padStart(2, '0')}`.padStart(3, ' '));
        thr(f.throttle, C.amber);
        brk(f.brake, C.red);
        gear.textContent = gearText(f.gear);
        gear.classList.toggle('shift', frac >= ZONES.red);
      },
      idle(text) {
        status.textContent = text;
        lit = -1;
        bars.forEach((b, i) => b.setAttribute('stroke', i / N >= ZONES.red ? '#3a0c06' : C.off));
        spd.set('0');
        thr(0, C.amber);
        brk(0, C.red);
        gear.textContent = 'N';
      },
    };
  },
};
