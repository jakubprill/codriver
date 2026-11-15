// AF · Reactor – an orange reactor ring: the speed rolls like a drum counter between the next value
// up and down, the inner tick ring lights with the RPM, side wings carry throttle and brake.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, fmtG, clamp, blinkOn, polar, ZONES } from '../lib/util.js';
import { arc, sector } from '../lib/gauge.js';

const C = { bg: '#020100', fg: '#fff3e6', muted: '#a86a3a', orange: '#ff6a10', amber: '#ffb02a', yellow: '#ffd23a', dim: '#2a1004', red: '#ff2a10' };

const CSS = `
.t-reactor { position: absolute; inset: 0; color: ${C.fg}; font-family: 'Saira Semi Condensed', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums;
  background: radial-gradient(ellipse at 50% 50%, #1e0a02 0, ${C.bg} 60%); }
.t-reactor svg { position: absolute; inset: 0; overflow: visible; }
.t-reactor .drum { position: absolute; left: 670px; top: 260px; width: 260px; height: 220px; overflow: hidden; text-align: center;
  mask-image: linear-gradient(transparent, #000 25%, #000 75%, transparent); -webkit-mask-image: linear-gradient(transparent, #000 25%, #000 75%, transparent); }
.t-reactor .drum div { position: absolute; left: 0; right: 0; height: 80px; line-height: 80px; }
.t-reactor .drum .now { font-size: 96px; font-weight: 600; }
.t-reactor .drum .near { font-size: 40px; color: ${C.muted}; }
.t-reactor .gear { position: absolute; left: 700px; top: 496px; width: 200px; text-align: center; font-size: 26px; color: ${C.muted}; letter-spacing: .2em; }
.t-reactor .gear b { font-size: 46px; color: ${C.fg}; letter-spacing: 0; margin-left: 8px; }
.t-reactor .gear.shift b { color: ${C.red}; }
.t-reactor .side { position: absolute; top: 640px; font-size: 22px; color: ${C.muted}; letter-spacing: .1em; }
.t-reactor .side b { font-size: 34px; color: ${C.fg}; letter-spacing: 0; margin-left: 10px; }
.t-reactor .status { position: absolute; left: 0; right: 0; top: 24px; text-align: center; font-size: 22px; color: ${C.muted}; }
`;

const CX = 800, CY = 400, N = 60;

export default {
  id: 'reactor',
  name: 'Reactor',
  description: 'Orange reactor ring: the speed rolls like a drum counter, the tick ring lights with RPM',
  create(stage) {
    useFont('Saira+Semi+Condensed:wght@400;600');
    useStyle('reactor', CSS);

    const svg = s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, 'aria-hidden': 'true' });
    // outer ring with glowing arcs, notched like armour plates
    svg.append(
      s('circle', { cx: CX, cy: CY, r: 300, fill: 'none', stroke: C.dim, 'stroke-width': 40 }),
      ...[[200, 250], [290, 340], [20, 70], [110, 160]].map(([a, b]) => s('path', { d: sector(CX, CY, 282, 318, a, b), fill: C.orange, style: `filter: drop-shadow(0 0 16px ${C.orange})` })),
      s('circle', { cx: CX, cy: CY, r: 250, fill: 'none', stroke: C.orange, 'stroke-width': 3 }),
      s('circle', { cx: CX, cy: CY, r: 160, fill: '#0a0401', stroke: C.orange, 'stroke-width': 2 }));
    const ticks = Array.from({ length: N }, (_, i) => {
      const a = (360 * i) / N;
      const [x0, y0] = polar(CX, CY, 200, a);
      const [x1, y1] = polar(CX, CY, 236, a);
      const l = s('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: C.dim, 'stroke-width': 4 });
      svg.append(l);
      return l;
    });
    // wings: arrow shapes with a stack of bars (throttle left, brake right)
    const wing = (dir) => {
      const x = CX + dir * 300;
      svg.append(s('path', { d: `M${x} 300 L${x + dir * 200} 360 L${x + dir * 200} 440 L${x} 500`, fill: '#1a0802', stroke: C.orange, 'stroke-width': 3 }),
        s('path', { d: arc(CX, CY, 360, dir > 0 ? 50 : 230, dir > 0 ? 130 : 310), fill: 'none', stroke: C.orange, 'stroke-width': 4, opacity: 0.6 }));
      const bars = Array.from({ length: 6 }, (_, i) => s('rect', { x: dir > 0 ? x + 30 : x - 150, y: 370 + i * 12, width: 120, height: 8, fill: C.dim }));
      svg.append(...bars);
      return (v) => bars.forEach((b, i) => b.setAttribute('fill', 5 - i < Math.round(clamp(v) * 6) ? (i < 2 ? C.amber : C.yellow) : C.dim));
    };
    const thr = wing(-1);
    const brk = wing(1);

    // the drum: five rows, rolled by the fractional part of the speed
    const rows = Array.from({ length: 5 }, (_, i) => h('div', { class: i === 2 ? 'now' : 'near' }));
    const drum = h('div', { class: 'drum' }, ...rows);
    const gear = h('b', {}, 'N');
    const gearBox = h('div', { class: 'gear' }, 'GEAR', gear);
    const time = h('b', {}, '0:00.0');
    const dist = h('b', {}, '0 m');
    const g = h('b', {}, '0.0 g');
    const status = h('div', { class: 'status' });
    stage.append(h('div', { class: 't-reactor' }, svg, drum, gearBox,
      h('div', { class: 'side', style: 'left:110px' }, 'TIME', time),
      h('div', { class: 'side', style: 'left:0;right:0;top:730px;text-align:center' }, 'G', g),
      h('div', { class: 'side', style: 'right:110px' }, 'DIST', dist),
      h('div', { class: 'side', style: 'left:330px;top:250px' }, 'THROTTLE'),
      h('div', { class: 'side', style: 'right:330px;top:250px' }, 'BRAKE'),
      status));

    const roll = (v) => {
      const n = Math.floor(v);
      const off = (v - n) * 80; // px: the drum turns smoothly between whole numbers
      rows.forEach((r, i) => {
        const val = n + (2 - i);
        r.textContent = val >= 0 ? val : '';
        r.style.top = `${70 + (i - 2) * 80 + off}px`;
      });
    };
    roll(0);

    let lit = -1;
    return {
      update(f) {
        status.textContent = '';
        const { frac, atLimit } = rpmInfo(f);
        const n = atLimit && !blinkOn() ? 0 : Math.round(frac * N);
        if (n !== lit) {
          lit = n;
          ticks.forEach((t, i) => t.setAttribute('stroke', i < n ? (i / N >= ZONES.red ? C.red : C.amber) : C.dim));
        }
        roll(f.speedKmh);
        gear.textContent = gearText(f.gear);
        gearBox.classList.toggle('shift', frac >= ZONES.red);
        thr(f.throttle);
        brk(f.brake);
        time.textContent = fmtTime(f.lapTime);
        dist.textContent = `${fmtInt(f.lapDistance)} m`;
        g.textContent = fmtG(f);
      },
      idle(text) {
        status.textContent = text;
        lit = -1;
        ticks.forEach((t) => t.setAttribute('stroke', C.dim));
        roll(0);
        thr(0);
        brk(0);
        gear.textContent = 'N';
      },
    };
  },
};
