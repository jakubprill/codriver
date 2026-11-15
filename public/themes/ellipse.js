// AA · Ellipse – an EV-style view: a flat glowing ellipse of segments that fills with the RPM,
// the speed floating above it, pedals as one glowing line along the bottom.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, fmtG, clamp, blinkOn, ZONES } from '../lib/util.js';

const C = { bg: '#000', fg: '#f2f8fb', muted: '#6f8b98', cyan: '#2bd4ff', deep: '#0b3a4a', off: '#0c1a20', red: '#ff4a5a' };

const CSS = `
.t-ellipse { position: absolute; inset: 0; color: ${C.fg}; font-family: 'Exo 2', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums;
  background: radial-gradient(ellipse at 50% 55%, #071a22 0, ${C.bg} 60%); }
.t-ellipse svg { position: absolute; inset: 0; overflow: visible; }
.t-ellipse .spd { position: absolute; left: 500px; top: 120px; width: 600px; text-align: center; font-size: 210px; font-weight: 700; line-height: 1; }
.t-ellipse .unit { position: absolute; left: 1060px; top: 270px; font-size: 30px; color: ${C.muted}; }
.t-ellipse .mode { position: absolute; left: 500px; top: 340px; width: 600px; text-align: center; font-size: 34px; color: ${C.cyan}; letter-spacing: .08em; }
.t-ellipse .mode.shift { color: ${C.red}; }
.t-ellipse .side { position: absolute; top: 250px; font-size: 26px; color: ${C.muted}; }
.t-ellipse .side b { display: block; font-size: 46px; color: ${C.fg}; font-weight: 500; }
.t-ellipse .foot { position: absolute; top: 560px; font-size: 22px; color: ${C.muted}; letter-spacing: .3em; font-style: italic; }
.t-ellipse .status { position: absolute; left: 0; right: 0; bottom: 30px; text-align: center; font-size: 22px; color: ${C.muted}; }
`;

const CX = 800, CY = 420, RX = 330, RY = 120, N = 48;
// segments run along the front half of the ellipse, from the left round to the right
const pt = (t, k = 1) => {
  const a = Math.PI * (1 - t); // 180° → 0°, along the near (lower) side
  return [CX + RX * k * Math.cos(a), CY + RY * k * Math.sin(a)];
};

export default {
  id: 'ellipse',
  name: 'Ellipse',
  description: 'EV look: a flat glowing ellipse of segments fills with the RPM, speed above it',
  create(stage) {
    useFont('Exo+2:wght@500;700');
    useStyle('ellipse', CSS);

    const svg = s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, 'aria-hidden': 'true' });
    svg.append(
      s('ellipse', { cx: CX, cy: CY, rx: RX + 60, ry: RY + 26, fill: 'none', stroke: C.deep, 'stroke-width': 3 }),
      s('ellipse', { cx: CX, cy: CY, rx: RX - 30, ry: RY - 14, fill: 'none', stroke: C.cyan, 'stroke-width': 2, opacity: 0.6 }));
    const segs = Array.from({ length: N }, (_, i) => {
      const [ax, ay] = pt(i / N);
      const [bx, by] = pt((i + 0.8) / N);
      const [cx2, cy2] = pt((i + 0.8) / N, 1.16);
      const [dx, dy] = pt(i / N, 1.16);
      const p = s('polygon', { points: `${ax},${ay} ${bx},${by} ${cx2},${cy2} ${dx},${dy}`, fill: C.off });
      svg.append(p);
      return p;
    });
    // the bottom line: brake fills left from the middle, throttle right
    const LINE_Y = 640;
    svg.append(s('line', { x1: 200, y1: LINE_Y, x2: 1400, y2: LINE_Y, stroke: C.off, 'stroke-width': 10, 'stroke-linecap': 'round' }));
    const brk = s('line', { x1: 800, y1: LINE_Y, x2: 800, y2: LINE_Y, stroke: C.red, 'stroke-width': 10, 'stroke-linecap': 'round', style: `filter: drop-shadow(0 0 8px ${C.red})` });
    const thr = s('line', { x1: 800, y1: LINE_Y, x2: 800, y2: LINE_Y, stroke: C.cyan, 'stroke-width': 10, 'stroke-linecap': 'round', style: `filter: drop-shadow(0 0 8px ${C.cyan})` });
    svg.append(brk, thr, s('rect', { x: 792, y: LINE_Y - 18, width: 16, height: 36, fill: C.fg }));

    const spd = h('div', { class: 'spd' }, '0');
    const mode = h('div', { class: 'mode' }, 'gear N');
    const g = h('b', {}, '0.0 g');
    const dist = h('b', {}, '0 m');
    const time = h('b', {}, '0:00.0');
    const status = h('div', { class: 'status' });
    stage.append(h('div', { class: 't-ellipse' }, svg, spd, h('div', { class: 'unit' }, 'km/h'), mode,
      h('div', { class: 'side', style: 'left:90px' }, 'g-force', g, h('br'), 'stage time', time),
      h('div', { class: 'side', style: 'right:90px;text-align:right' }, 'distance', dist),
      h('div', { class: 'foot', style: 'left:560px' }, 'BRAKE'), h('div', { class: 'foot', style: 'left:850px' }, 'THROTTLE'),
      status));

    let lit = -1;
    return {
      update(f) {
        status.textContent = '';
        const { frac, atLimit } = rpmInfo(f);
        const n = atLimit && !blinkOn() ? 0 : Math.round(frac * N);
        if (n !== lit) {
          lit = n;
          segs.forEach((p, i) => p.setAttribute('fill', i < n ? (i / N >= ZONES.red ? C.red : C.cyan) : C.off));
        }
        spd.textContent = Math.round(f.speedKmh);
        mode.textContent = `gear ${gearText(f.gear)}`;
        mode.classList.toggle('shift', frac >= ZONES.red);
        g.textContent = fmtG(f);
        dist.textContent = `${fmtInt(f.lapDistance)} m`;
        time.textContent = fmtTime(f.lapTime);
        brk.setAttribute('x2', (800 - 590 * clamp(f.brake)).toFixed(0));
        thr.setAttribute('x2', (800 + 590 * clamp(f.throttle)).toFixed(0));
      },
      idle(text) {
        status.textContent = text;
        lit = -1;
        segs.forEach((p) => p.setAttribute('fill', C.off));
        brk.setAttribute('x2', 800);
        thr.setAttribute('x2', 800);
        spd.textContent = '0';
        mode.textContent = 'gear N';
      },
    };
  },
};
