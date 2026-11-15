// Z · Stack – a car-tablet look: columns of stacked blocks on both sides (pedals in red, speed and
// g-force in blue), a segmented RPM ring round a chrome bezel in the middle.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, fmtG, clamp, blinkOn, ZONES } from '../lib/util.js';
import { sector } from '../lib/gauge.js';
import { createStats } from '../lib/stats.js';

const C = { bg: '#04060a', fg: '#eef2f8', muted: '#7a8496', red: '#ff2a2a', redOff: '#2a0a0a', blue: '#1e8fff', blueOff: '#071a30', chrome: '#c8ced8' };

const CSS = `
.t-stack { position: absolute; inset: 0; color: ${C.fg}; font-family: 'Exo 2', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums;
  background: radial-gradient(ellipse at 50% 40%, #0d1626 0, ${C.bg} 65%); }
.t-stack svg { position: absolute; inset: 0; overflow: visible; }
.t-stack .c { position: absolute; left: 650px; width: 300px; text-align: center; }
.t-stack .top { top: 250px; font-size: 30px; color: ${C.muted}; }
.t-stack .spd { top: 285px; font-size: 120px; font-weight: 700; line-height: 1; }
.t-stack .unit { top: 410px; font-size: 24px; color: ${C.muted}; }
.t-stack .gear { top: 560px; font-size: 52px; font-weight: 600; }
.t-stack .gear.shift { color: ${C.red}; }
.t-stack .lab { position: absolute; top: 470px; width: 100px; text-align: center; font-size: 20px; color: ${C.muted}; }
.t-stack .clock { position: absolute; left: 70px; top: 560px; font-size: 22px; color: ${C.muted}; }
.t-stack .clock b { display: block; font-size: 64px; color: ${C.fg}; font-weight: 600; }
.t-stack .trip { position: absolute; right: 70px; top: 560px; display: grid; grid-template-columns: auto auto; gap: 6px 30px; font-size: 22px; color: ${C.muted}; font-style: italic; }
.t-stack .trip b { color: ${C.fg}; font-style: normal; text-align: right; font-weight: 600; font-size: 28px; }
.t-stack .status { position: absolute; left: 0; right: 0; bottom: 20px; text-align: center; font-size: 22px; color: ${C.muted}; }
`;

const CX = 800, CY = 380, N = 40, A0 = 225, SWEEP = 270;
const ROWS = 14;

export default {
  id: 'stack',
  name: 'Stack',
  description: 'Car-tablet look: stacked block columns on both sides, a segmented RPM ring',
  create(stage) {
    useFont('Exo+2:wght@400;600;700');
    useStyle('stack', CSS);
    const stats = createStats();

    const svg = s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, 'aria-hidden': 'true' });
    // block columns: rows of rounded blocks filling from the bottom
    const column = (x, on, off) => {
      const cells = Array.from({ length: ROWS }, (_, i) => s('rect', { x, y: 440 - i * 26, width: 90, height: 18, rx: 3, fill: off }));
      svg.append(...cells);
      return (v) => cells.forEach((c, i) => c.setAttribute('fill', i < Math.round(clamp(v) * ROWS) ? on : off));
    };
    const cols = { thr: column(70, C.red, C.redOff), brk: column(190, C.red, C.redOff), spd: column(1320, C.blue, C.blueOff), g: column(1440, C.blue, C.blueOff) };
    svg.append(s('path', { d: 'M60 120 H330 L420 200 M1540 120 H1270 L1180 200', fill: 'none', stroke: '#2a3446', 'stroke-width': 3 }));

    const segs = Array.from({ length: N }, (_, i) => {
      const a = A0 + (SWEEP * i) / N;
      const p = s('path', { d: sector(CX, CY, 180, 250, a + 0.6, a + SWEEP / N - 0.6), fill: C.redOff });
      svg.append(p);
      return p;
    });
    svg.append(
      s('circle', { cx: CX, cy: CY, r: 268, fill: 'none', stroke: 'url(#stack-chrome)', 'stroke-width': 18 }),
      s('circle', { cx: CX, cy: CY, r: 168, fill: '#070b12', stroke: C.blue, 'stroke-width': 4, style: `filter: drop-shadow(0 0 10px ${C.blue})` }),
      s('defs', {}, s('linearGradient', { id: 'stack-chrome', x1: 0, y1: 0, x2: 0, y2: 1 },
        s('stop', { offset: 0, 'stop-color': '#f2f4f8' }), s('stop', { offset: 0.5, 'stop-color': '#6b7484' }), s('stop', { offset: 1, 'stop-color': C.chrome }))));

    const top = h('div', { class: 'c top' }, '0');
    const spd = h('div', { class: 'c spd' }, '0');
    const gear = h('div', { class: 'c gear' }, 'N');
    const time = h('b', {}, '0:00.0');
    const trip = { dist: h('b', {}, '0 m'), avg: h('b', {}, '0'), g: h('b', {}, '0.0 g') };
    const status = h('div', { class: 'status' });
    stage.append(h('div', { class: 't-stack' }, svg, top, spd, h('div', { class: 'c unit' }, 'km/h'), gear,
      ...[['throttle', 70], ['brake', 190], ['speed', 1320], ['g-force', 1440]].map(([t, x]) => h('div', { class: 'lab', style: `left:${x - 5}px` }, t)),
      h('div', { class: 'clock' }, 'stage time', time),
      h('div', { class: 'trip' }, 'distance', trip.dist, 'average', trip.avg, 'g-force', trip.g),
      status));

    let lit = -1;
    let hot = false;
    return {
      update(f) {
        status.textContent = '';
        const st = stats.update(f);
        const { frac, atLimit } = rpmInfo(f);
        const n = atLimit && !blinkOn() ? 0 : Math.round(frac * N);
        const red = frac >= ZONES.red;
        if (n !== lit || red !== hot) {
          lit = n;
          hot = red;
          segs.forEach((p, i) => p.setAttribute('fill', i < n ? (i / N >= ZONES.red ? C.red : i / N >= ZONES.amber ? '#ff6a3a' : C.red) : i / N >= 0.75 ? C.blueOff : C.redOff));
        }
        cols.thr(f.throttle);
        cols.brk(f.brake);
        cols.spd(f.speedKmh / 200);
        cols.g(Math.hypot(f.gLat, f.gLon) / 2);
        top.textContent = Math.round(st.top);
        spd.textContent = Math.round(f.speedKmh);
        gear.textContent = gearText(f.gear);
        gear.classList.toggle('shift', red);
        time.textContent = fmtTime(f.lapTime);
        trip.dist.textContent = `${fmtInt(f.lapDistance)} m`;
        trip.avg.textContent = `${Math.round(st.avg)} km/h`;
        trip.g.textContent = fmtG(f);
      },
      idle(text) {
        status.textContent = text;
        lit = -1;
        segs.forEach((p, i) => p.setAttribute('fill', i / N >= 0.75 ? C.blueOff : C.redOff));
        Object.values(cols).forEach((c) => c(0));
        spd.textContent = '0';
        gear.textContent = 'N';
        gear.classList.remove('shift');
      },
    };
  },
};
