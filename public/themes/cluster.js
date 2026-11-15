// I · Cluster – a modern digital instrument cluster: a blue RPM arc that turns red at the top,
// the speed and gear in the middle, throttle and brake as curved side bars, warning lights below.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, fmtG, blinkOn, polar, ZONES } from '../lib/util.js';
import { arc, fillPath, thousands } from '../lib/gauge.js';
import { createStats } from '../lib/stats.js';

const C = { bg0: '#0b1a2b', bg1: '#03070d', fg: '#e9f1fb', muted: '#6f8297', track: '#13243a', blue: '#3aa0ff', ice: '#9fe0ff', red: '#ff3b55', amber: '#ffb020', green: '#3de08a' };

const CSS = `
.t-cluster { position: absolute; inset: 0; color: ${C.fg}; font-family: 'Exo 2', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums;
  background: radial-gradient(ellipse at 50% 30%, ${C.bg0}, ${C.bg1} 70%); }
.t-cluster svg { position: absolute; inset: 0; overflow: visible; }
.t-cluster .c { position: absolute; left: 550px; width: 500px; text-align: center; }
.t-cluster .mode { top: 200px; font-size: 26px; color: ${C.muted}; }
.t-cluster .mode b { display: block; font-size: 30px; color: ${C.amber}; font-weight: 600; }
.t-cluster .spd { top: 278px; font-size: 190px; font-weight: 700; line-height: 1; letter-spacing: -0.02em; }
.t-cluster .unit { top: 478px; font-size: 26px; color: ${C.muted}; }
.t-cluster .gear { top: 520px; font-size: 76px; font-weight: 600; }
.t-cluster .gear i { font-style: normal; color: ${C.muted}; opacity: .55; margin-right: 18px; font-size: 56px; }
.t-cluster .blk { position: absolute; top: 160px; font-size: 24px; color: ${C.muted}; line-height: 1.5; }
.t-cluster .blk b { font-size: 52px; color: ${C.fg}; font-weight: 600; }
.t-cluster .blk .row { display: flex; justify-content: space-between; gap: 40px; font-size: 26px; margin-top: 6px; padding: 4px 10px; background: rgba(255,255,255,.04); }
.t-cluster .blk .row span:last-child { color: ${C.fg}; }
.t-cluster .lights { position: absolute; left: 0; right: 0; top: 690px; display: flex; justify-content: center; gap: 40px; font-size: 22px; font-weight: 600; letter-spacing: .08em; }
.t-cluster .lights span { padding: 6px 14px; border-radius: 6px; color: #26384c; border: 2px solid #1a2a3c; }
.t-cluster .lights span.on { color: var(--c); border-color: var(--c); box-shadow: 0 0 14px var(--c); }
.t-cluster .status { position: absolute; left: 0; right: 0; bottom: 20px; text-align: center; font-size: 24px; color: ${C.muted}; }
`;

const CX = 800, CY = 400, R = 280, START = 225, SWEEP = 270;

export default {
  id: 'cluster',
  name: 'Cluster',
  description: 'Modern digital cluster: blue RPM arc, speed and gear in the middle, side bars',
  create(stage) {
    useFont('Exo+2:wght@400;600;700');
    useStyle('cluster', CSS);
    const stats = createStats();

    const fill = fillPath(arc(CX, CY, R, START, START + SWEEP), { stroke: 'url(#cluster-arc)', 'stroke-width': 30 });
    const labels = s('g', { 'font-size': 26, fill: C.muted, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    const spokes = s('g', { stroke: '#1d3550', 'stroke-width': 2 });
    const redZone = s('path', { fill: 'none', stroke: C.red, 'stroke-width': 30, opacity: 0.22 });
    let scaleMax = 0;
    const drawScale = (max) => {
      scaleMax = max;
      labels.replaceChildren();
      spokes.replaceChildren();
      for (let k = 0; k <= thousands(max); k++) {
        const a = START + (SWEEP * k * 1000) / max;
        const [x, y] = polar(CX, CY, R + 52, a);
        labels.append(s('text', { x, y }, String(k)));
        const [x0, y0] = polar(CX, CY, R + 20, a);
        const [x1, y1] = polar(CX, CY, R + 34, a);
        spokes.append(s('line', { x1: x0, y1: y0, x2: x1, y2: y1 }));
      }
      redZone.setAttribute('d', arc(CX, CY, R, START + SWEEP * ZONES.red, START + SWEEP));
    };

    // throttle (left) and brake (right): bracket-shaped bars
    const bar = (x, dir, color) => {
      const d = `M${x + dir * 40} 520 L${x} 500 L${x} 260 L${x + dir * 40} 240`;
      return { track: s('path', { d, fill: 'none', stroke: C.track, 'stroke-width': 16 }),
        fill: fillPath(d, { stroke: color, 'stroke-width': 16, style: `filter: drop-shadow(0 0 6px ${color})` }) };
    };
    const thr = bar(130, 1, C.blue);
    const brk = bar(1470, -1, C.red);

    stage.append(h('div', { class: 't-cluster' },
      s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, 'aria-hidden': 'true' },
        s('defs', {}, s('linearGradient', { id: 'cluster-arc', gradientUnits: 'userSpaceOnUse', x1: 520, y1: 600, x2: 1080, y2: 600 },
          s('stop', { offset: 0, 'stop-color': '#1f5fd0' }), s('stop', { offset: 0.6, 'stop-color': C.blue }), s('stop', { offset: 1, 'stop-color': C.ice }))),
        s('path', { d: arc(CX, CY, R, START, START + SWEEP), fill: 'none', stroke: C.track, 'stroke-width': 30 }),
        redZone, fill, spokes, labels,
        s('path', { d: arc(CX, CY, R - 46, START - 4, START + SWEEP + 4), fill: 'none', stroke: '#24405f', 'stroke-width': 3 }),
        thr.track, thr.fill, brk.track, brk.fill)));
    const root = stage.lastChild;

    const time = h('b', {}, '0:00.0');
    const spd = h('div', { class: 'c spd' }, '0');
    const gear = h('span', {}, 'N');
    const dist = h('span', {}, '0 m');
    const avg = h('span', {}, '0 km/h');
    const g = h('b', {}, '0.0 g');
    const top = h('span', {}, '0 km/h');
    const rpm = h('span', {}, '0');
    const light = (label, color) => h('span', { style: `--c:${color}` }, label);
    const L = { thr: light('throttle', C.green), brk: light('brake', C.red), shift: light('shift', C.amber), lim: light('limiter', C.red) };
    const status = h('div', { class: 'status' });
    root.append(
      h('div', { class: 'c mode' }, 'stage time', time),
      spd, h('div', { class: 'c unit' }, 'km/h'),
      h('div', { class: 'c gear' }, h('i', {}, 'gear'), gear),
      h('div', { class: 'blk', style: 'left:200px' }, 'distance', h('div', { class: 'row' }, h('span', {}, 'stage'), dist), h('div', { class: 'row' }, h('span', {}, 'average'), avg)),
      h('div', { class: 'blk', style: 'right:200px;text-align:right' }, 'g-force', h('br'), g, h('div', { class: 'row' }, h('span', {}, 'top'), top), h('div', { class: 'row' }, h('span', {}, 'rpm'), rpm)),
      h('div', { class: 'lights' }, ...Object.values(L)),
      status);

    return {
      update(f) {
        status.textContent = '';
        const st = stats.update(f);
        const { max, frac, atLimit } = rpmInfo(f);
        if (max && max !== scaleMax) drawScale(max);
        fill.set(frac);
        fill.style.opacity = atLimit && !blinkOn() ? '0.3' : fill.style.opacity;
        spd.textContent = Math.round(f.speedKmh);
        gear.textContent = gearText(f.gear);
        time.textContent = fmtTime(f.lapTime);
        dist.textContent = `${fmtInt(f.lapDistance)} m`;
        avg.textContent = `${Math.round(st.avg)} km/h`;
        top.textContent = `${Math.round(st.top)} km/h`;
        rpm.textContent = fmtInt(Math.round(f.rpm / 50) * 50);
        g.textContent = fmtG(f);
        thr.fill.set(f.throttle);
        brk.fill.set(f.brake);
        L.thr.classList.toggle('on', f.throttle > 0.9);
        L.brk.classList.toggle('on', f.brake > 0.1);
        L.shift.classList.toggle('on', frac >= ZONES.amber);
        L.lim.classList.toggle('on', atLimit && blinkOn());
      },
      idle(text) {
        status.textContent = text;
        fill.set(0);
        thr.fill.set(0);
        brk.fill.set(0);
        spd.textContent = '0';
        gear.textContent = 'N';
        Object.values(L).forEach((el) => el.classList.remove('on'));
      },
    };
  },
};
