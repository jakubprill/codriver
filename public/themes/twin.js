// U · Twin – two big dials with a violet fill: speed on the left, RPM on the right, the gear and
// stage clock between them, throttle and brake as scaled bars underneath.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, fmtG, clamp, blinkOn, polar, ZONES } from '../lib/util.js';
import { sector, ticks } from '../lib/gauge.js';

const C = { bg0: '#0d0b24', bg1: '#030309', fg: '#eef0ff', muted: '#7b7fa8', violet: '#8a5cff', blue: '#4a7dff', track: '#1a1a3a', red: '#ff4d6d', amber: '#ff9f43' };

const CSS = `
.t-twin { position: absolute; inset: 0; color: ${C.fg}; font-family: 'Jura', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums;
  background: radial-gradient(ellipse at 50% 70%, ${C.bg0} 0, ${C.bg1} 70%); }
.t-twin svg { position: absolute; inset: 0; overflow: visible; }
.t-twin .val { position: absolute; width: 220px; text-align: center; top: 345px; font-size: 76px; font-weight: 700; line-height: 1; }
.t-twin .val small { display: block; font-size: 20px; color: ${C.muted}; font-weight: 400; margin-top: 6px; }
.t-twin .mid { position: absolute; left: 650px; width: 300px; text-align: center; }
.t-twin .gear { top: 230px; font-size: 120px; font-weight: 700; color: ${C.blue}; line-height: 1; border-left: 2px solid #2a2a50; border-right: 2px solid #2a2a50; }
.t-twin .gear.shift { color: ${C.red}; }
.t-twin .lab { font-size: 20px; color: ${C.muted}; letter-spacing: .14em; }
.t-twin .lab b { display: block; font-size: 40px; color: ${C.fg}; letter-spacing: 0; margin-top: 4px; }
.t-twin .warn { position: absolute; left: 520px; right: 520px; top: 120px; display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; }
.t-twin .warn span { color: #3a2a20; }
.t-twin .warn span.on { color: ${C.amber}; text-shadow: 0 0 10px ${C.amber}; }
.t-twin .foot { position: absolute; left: 0; right: 0; top: 700px; display: flex; justify-content: center; gap: 120px; font-size: 26px; }
.t-twin .status { position: absolute; left: 0; right: 0; bottom: 14px; text-align: center; font-size: 22px; color: ${C.muted}; }
`;

const R = 250, A0 = 220, A1 = 500; // 280° from the bottom left, over the top
const SPEED_MAX = 200;
const LX = 340, RX = 1260, CY = 380;

function dial(cx, labels) {
  const g = s('g', {},
    s('circle', { cx, cy: CY, r: R + 6, fill: 'none', stroke: '#2a2a55', 'stroke-width': 3 }),
    ticks({ cx, cy: CY, r: R, len: 10, longLen: 24, from: A0, to: A1, step: 7, long: (i) => i % 4 === 0, stroke: '#a8abd6' }));
  const text = s('g', { 'font-size': 32, fill: C.fg, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
  g.append(text);
  const setLabels = (list) => {
    text.replaceChildren();
    list.forEach((t, i) => {
      const [x, y] = polar(cx, CY, R - 50, A0 + ((A1 - A0) * i) / Math.max(1, list.length - 1));
      text.append(s('text', { x, y }, t));
    });
  };
  setLabels(labels);
  const wedge = s('path', { d: '', fill: 'url(#twin-fill)', opacity: 0.85 });
  const hub = s('circle', { cx, cy: CY, r: 120, fill: '#0b0a20', stroke: '#3a3a7a', 'stroke-width': 3, style: `filter: drop-shadow(0 0 18px ${C.violet})` });
  g.prepend(wedge);
  g.append(hub);
  return { g, wedge, setLabels, set(v) { wedge.setAttribute('d', v > 0.003 ? sector(cx, CY, 120, R - 2, A0, A0 + (A1 - A0) * clamp(v)) : ''); } };
}

export default {
  id: 'twin',
  name: 'Twin',
  description: 'Two big dials with a violet fill: speed and RPM, gear and clock between them',
  create(stage) {
    useFont('Jura:wght@400;700');
    useStyle('twin', CSS);

    const left = dial(LX, ['0', '40', '80', '120', '160', '200']);
    const right = dial(RX, ['0']);
    let scaleMax = 0;

    // throttle and brake bars, scaled like fuel and temperature gauges
    const bar = (x, label) => {
      const cells = Array.from({ length: 20 }, (_, i) => s('rect', { x: x + i * 13, y: 620, width: 9, height: 14, fill: C.track }));
      const g = s('g', {}, ...cells,
        s('text', { x, y: 600, 'font-size': 20, fill: C.muted }, label),
        s('text', { x: x + 255, y: 600, 'font-size': 20, fill: C.muted, 'text-anchor': 'end' }, '100'));
      return { g, set: (v) => cells.forEach((c, i) => c.setAttribute('fill', i < Math.round(clamp(v) * cells.length) ? (i > 16 ? C.red : C.blue) : C.track)) };
    };
    const thr = bar(530, 'throttle');
    const brk = bar(820, 'brake');

    stage.append(h('div', { class: 't-twin' },
      s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, 'aria-hidden': 'true' },
        s('defs', {}, s('linearGradient', { id: 'twin-fill', x1: 0, y1: 1, x2: 1, y2: 0 },
          s('stop', { offset: 0, 'stop-color': C.blue }), s('stop', { offset: 1, 'stop-color': C.violet }))),
        s('ellipse', { cx: 800, cy: 540, rx: 240, ry: 40, fill: 'none', stroke: C.violet, 'stroke-width': 3, opacity: 0.6, style: `filter: drop-shadow(0 0 12px ${C.violet})` }),
        s('path', { d: 'M560 560 L640 400 H960 L1040 560', fill: 'rgba(74,125,255,.08)', stroke: '#2a3a8a', 'stroke-width': 2 }),
        left.g, right.g, thr.g, brk.g)));
    const root = stage.lastChild;

    const spd = h('div', { class: 'val', style: `left:${LX - 110}px` }, '0', h('small', {}, 'km/h'));
    const rpm = h('div', { class: 'val', style: `left:${RX - 110}px` }, '0', h('small', {}, 'rpm'));
    const gear = h('div', { class: 'mid gear' }, 'N');
    const time = h('b', {}, '0:00.0');
    const dist = h('span', {}, '0 m');
    const gf = h('span', {}, '0.0 g');
    const W = { shift: h('span', {}, 'SHIFT'), lim: h('span', {}, 'LIMIT'), brk: h('span', {}, 'BRAKE'), g: h('span', {}, 'G') };
    const status = h('div', { class: 'status' });
    root.append(spd, rpm, gear,
      h('div', { class: 'mid lab', style: 'top:425px' }, 'stage time', time),
      h('div', { class: 'warn' }, ...Object.values(W)),
      h('div', { class: 'foot' }, dist, gf),
      status);

    return {
      update(f) {
        status.textContent = '';
        const { max, frac, atLimit } = rpmInfo(f);
        if (max && max !== scaleMax) {
          scaleMax = max;
          right.setLabels(Array.from({ length: Math.floor(max / 1000) + 1 }, (_, k) => String(k)));
        }
        left.set(f.speedKmh / SPEED_MAX);
        right.set(atLimit && !blinkOn() ? 0 : frac);
        right.wedge.setAttribute('fill', frac >= ZONES.red ? C.red : 'url(#twin-fill)');
        spd.firstChild.textContent = Math.round(f.speedKmh);
        rpm.firstChild.textContent = fmtInt(Math.round(f.rpm / 50) * 50);
        gear.textContent = gearText(f.gear);
        gear.classList.toggle('shift', frac >= ZONES.red);
        time.textContent = fmtTime(f.lapTime);
        dist.textContent = `${fmtInt(f.lapDistance)} m`;
        gf.textContent = fmtG(f);
        thr.set(f.throttle);
        brk.set(f.brake);
        W.shift.classList.toggle('on', frac >= ZONES.amber);
        W.lim.classList.toggle('on', atLimit);
        W.brk.classList.toggle('on', f.brake > 0.1);
        W.g.classList.toggle('on', Math.hypot(f.gLat, f.gLon) > 1);
      },
      idle(text) {
        status.textContent = text;
        left.set(0);
        right.set(0);
        thr.set(0);
        brk.set(0);
        spd.firstChild.textContent = '0';
        gear.textContent = 'N';
        Object.values(W).forEach((el) => el.classList.remove('on'));
      },
    };
  },
};
