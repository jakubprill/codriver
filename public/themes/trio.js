// L · Trio – three round gauges like a phone-mounted bike display: throttle on the left, a big
// speedometer in the middle, RPM on the right; brake, g-force and clutch as bars along the bottom.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, clamp, blinkOn, polar, ZONES } from '../lib/util.js';
import { arc, fillPath, ticks } from '../lib/gauge.js';

const C = { bg: '#050506', card: '#0f0f12', fg: '#f5f5f7', muted: '#7d7d86', track: '#24242a', blue: '#7cc3ff', green: '#64e3a1', red: '#ff7a7a', amber: '#ffbf5a' };

const CSS = `
.t-trio { position: absolute; inset: 0; color: ${C.fg}; font-family: 'Inter', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums; background: ${C.bg}; }
.t-trio .card { position: absolute; inset: 30px; border-radius: 60px; background: ${C.card}; box-shadow: inset 0 0 0 2px #1d1d22; }
.t-trio svg { position: absolute; inset: 0; overflow: visible; }
.t-trio .num { position: absolute; text-align: center; line-height: 1; }
.t-trio .num small { display: block; font-size: 22px; color: ${C.muted}; margin: 6px 0; }
.t-trio .top { position: absolute; top: 60px; font-size: 24px; color: ${C.muted}; }
.t-trio .top b { color: ${C.fg}; font-weight: 600; }
.t-trio .bars { position: absolute; left: 110px; right: 110px; top: 640px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 70px; }
.t-trio .bars div { font-size: 22px; color: ${C.muted}; display: flex; justify-content: space-between; flex-wrap: wrap; }
.t-trio .bars b { color: ${C.fg}; font-weight: 600; }
.t-trio .bars .bar { flex-basis: 100%; height: 8px; border-radius: 4px; background: ${C.track}; margin-bottom: 10px; order: -1; overflow: hidden; }
.t-trio .bars .bar i { display: block; height: 100%; width: 0; background: var(--c); border-radius: 4px; }
.t-trio .shift { color: ${C.red}; }
.t-trio .status { position: absolute; left: 0; right: 0; bottom: 70px; text-align: center; font-size: 22px; color: ${C.muted}; }
`;

const SPEED_MAX = 200;

/** A round gauge: ticks over 240°, a fill arc on its inner edge. Returns { el, set(0..1) }. */
function dial(cx, cy, r, { color, labels = [] }) {
  const A0 = 240, A1 = 480; // from bottom-left over the top to bottom-right
  const g = s('g', {},
    ticks({ cx, cy, r, len: 10, longLen: 22, from: A0, to: A1, step: 12, long: (i) => i % 5 === 0, stroke: '#5a5a63' }));
  labels.forEach((t, i) => {
    const [x, y] = polar(cx, cy, r - 50, A0 + ((A1 - A0) * i) / (labels.length - 1));
    g.append(s('text', { x, y, 'font-size': 26, fill: C.muted, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, t));
  });
  const fill = fillPath(arc(cx, cy, r + 14, A0, A1), { stroke: color, 'stroke-width': 8, 'stroke-linecap': 'round' });
  g.append(s('path', { d: arc(cx, cy, r + 14, A0, A1), fill: 'none', stroke: C.track, 'stroke-width': 8, 'stroke-linecap': 'round' }), fill);
  return { el: g, set: fill.set, fill };
}

export default {
  id: 'trio',
  name: 'Trio',
  description: 'Three round gauges: throttle, a big speedometer, RPM; bars along the bottom',
  create(stage) {
    useFont('Inter:wght@400;600;700');
    useStyle('trio', CSS);

    const left = dial(330, 340, 130, { color: C.green });
    const mid = dial(800, 360, 250, { color: C.blue, labels: ['0', '40', '80', '120', '160', '200'] });
    const right = dial(1270, 340, 130, { color: C.amber });

    const thr = h('div', { class: 'num', style: 'left:230px;top:300px;width:200px;font-size:64px;font-weight:600' }, '0', h('small', {}, 'throttle %'));
    const spd = h('div', { class: 'num', style: 'left:600px;top:290px;width:400px;font-size:150px;font-weight:700' });
    const spdVal = h('span', {}, '0');
    spd.append(h('small', {}, 'speed'), spdVal, h('small', {}, 'km/h'));
    const rpm = h('div', { class: 'num', style: 'left:1170px;top:300px;width:200px;font-size:64px;font-weight:600' }, '0', h('small', {}, 'rpm ×1000'));
    const gear = h('b', {}, 'N');
    const time = h('b', {}, '0:00.0');
    const bar = (label, color) => {
      const val = h('b', {}, '0');
      const fill = h('i', { style: `--c:${color}` });
      return { el: h('div', {}, h('div', { class: 'bar' }, fill), h('span', {}, label), val), val, fill };
    };
    const brk = bar('brake', C.red);
    const gf = bar('g-force', C.green);
    const clu = bar('clutch', C.fg);
    const status = h('div', { class: 'status' });

    stage.append(h('div', { class: 't-trio' },
      h('div', { class: 'card' }),
      s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, 'aria-hidden': 'true' }, left.el, mid.el, right.el),
      h('div', { class: 'top', style: 'left:110px' }, 'gear ', gear),
      h('div', { class: 'top', style: 'right:110px' }, 'stage ', time),
      thr, spd, rpm,
      h('div', { class: 'bars' }, brk.el, gf.el, clu.el),
      status));

    return {
      update(f) {
        status.textContent = '';
        const { frac, atLimit } = rpmInfo(f);
        left.set(f.throttle);
        mid.set(f.speedKmh / SPEED_MAX);
        right.set(frac);
        right.fill.setAttribute('stroke', frac >= ZONES.red ? C.red : C.amber);
        if (atLimit && !blinkOn()) right.fill.style.opacity = '0.25';
        thr.firstChild.textContent = Math.round(clamp(f.throttle) * 100);
        spdVal.textContent = Math.round(f.speedKmh);
        rpm.firstChild.textContent = (f.rpm / 1000).toFixed(1);
        rpm.classList.toggle('shift', frac >= ZONES.red);
        gear.textContent = gearText(f.gear);
        time.textContent = fmtTime(f.lapTime);
        brk.val.textContent = `${Math.round(clamp(f.brake) * 100)}%`;
        brk.fill.style.width = `${clamp(f.brake) * 100}%`;
        const g = Math.hypot(f.gLat, f.gLon);
        gf.val.textContent = `${g.toFixed(1)} g`;
        gf.fill.style.width = `${clamp(g / 2) * 100}%`;
        clu.val.textContent = `${Math.round(clamp(f.clutch) * 100)}%`;
        clu.fill.style.width = `${clamp(f.clutch) * 100}%`;
      },
      idle(text) {
        status.textContent = text;
        left.set(0);
        mid.set(0);
        right.set(0);
        spdVal.textContent = '0';
        gear.textContent = 'N';
        [brk, gf, clu].forEach((b) => { b.fill.style.width = '0'; });
      },
    };
  },
};
