// P · Track – a track-mode display: a wide RPM band sweeping up to the top right in segments,
// a 0–100 km/h timer in the middle, records on the left, a huge gear on the right.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, blinkOn, ZONES } from '../lib/util.js';
import { createStats } from '../lib/stats.js';

const C = { bg: '#000', fg: '#f2efe9', muted: '#7a756c', seg: '#1b1a18', segEdge: '#2e2c28', lit: '#d4a24a', red: '#e8321e', redOff: '#3a120c', amber: '#ffb347' };

const CSS = `
.t-track { position: absolute; inset: 0; color: ${C.fg}; font-family: 'Teko', 'Arial Narrow', sans-serif; font-variant-numeric: tabular-nums;
  background: radial-gradient(ellipse at 50% 110%, #2a2620 0, ${C.bg} 55%); }
.t-track svg { position: absolute; inset: 0; overflow: visible; }
.t-track .rec { position: absolute; font-size: 28px; color: ${C.amber}; line-height: 1; }
.t-track .rec b { display: block; font-size: 46px; color: ${C.muted}; font-weight: 400; letter-spacing: .04em; }
.t-track .timer { position: absolute; left: 600px; top: 450px; width: 400px; height: 190px; text-align: center; }
.t-track .timer b { display: block; font-size: 110px; line-height: 1.1; font-weight: 500; }
.t-track .timer span { font-size: 30px; color: ${C.amber}; }
.t-track .timer .done { color: ${C.amber}; }
.t-track .gear { position: absolute; right: 120px; top: 330px; font-size: 300px; font-weight: 600; font-style: italic; line-height: 1; }
.t-track .gear.shift { color: ${C.red}; }
.t-track .spd { position: absolute; left: 330px; top: 610px; font-size: 140px; font-weight: 600; font-style: italic; line-height: 1; }
.t-track .spd small { font-size: 34px; color: ${C.muted}; font-style: normal; margin-left: 12px; }
.t-track .odo { position: absolute; left: 140px; top: 380px; font-size: 32px; color: ${C.muted}; }
.t-track .status { position: absolute; left: 0; right: 0; bottom: 50px; text-align: center; font-size: 30px; color: ${C.muted}; }
`;

const N = 12;
// the band's lower edge rises from bottom left to top right; segments widen as they go
const P0 = [180, 600], P1 = [700, 230], P2 = [1360, 160];
const quad = (t) => [0, 1].map((k) => (1 - t) ** 2 * P0[k] + 2 * (1 - t) * t * P1[k] + t * t * P2[k]);

export default {
  id: 'track',
  name: 'Track',
  description: 'Track mode: a wide RPM band sweeping up, a 0–100 timer, a huge gear',
  create(stage) {
    useFont('Teko:wght@400;500;600');
    useStyle('track', CSS);
    const stats = createStats();

    const svg = s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, 'aria-hidden': 'true' });
    const segs = [];
    for (let i = 0; i < N; i++) {
      const [ax, ay] = quad(i / N);
      const [bx, by] = quad((i + 1) / N);
      const w0 = 24 + 70 * (i / N), w1 = 24 + 70 * ((i + 1) / N);
      const poly = s('polygon', { points: `${ax},${ay} ${bx},${by} ${bx},${by - w1} ${ax},${ay - w0}`, fill: C.seg, stroke: C.segEdge, 'stroke-width': 3 });
      segs.push(poly);
      svg.append(poly);
    }
    const scale = s('g', { 'font-size': 64, 'font-style': 'italic', fill: C.fg, 'text-anchor': 'middle' });
    svg.append(scale);
    let scaleMax = 0;
    const drawScale = (max) => {
      scaleMax = max;
      scale.replaceChildren();
      for (let k = 0; k * 1000 <= max; k++) {
        const [x, y] = quad((k * 1000) / max);
        scale.append(s('text', { x: x + 6, y: y + 60 }, String(k)));
      }
    };
    // timer brackets
    svg.append(s('path', { d: 'M620 470 v-20 h30 M980 470 v-20 h-30 M620 610 v20 h30 M980 610 v20 h-30', fill: 'none', stroke: C.muted, 'stroke-width': 3 }));

    const root = h('div', { class: 't-track' }, svg);
    stage.append(root);
    const rec = (y, label) => {
      const v = h('b', {}, '–');
      root.append(h('div', { class: 'rec', style: `left:140px;top:${y}px` }, label, v));
      return v;
    };
    const top = rec(100, 'top speed');
    const avg = rec(190, 'average');
    const time = rec(280, 'current');

    const timer = h('b', {}, '00.00');
    const timerBox = h('div', { class: 'timer' }, timer, h('span', {}, '0–100 km/h'));
    const gear = h('div', { class: 'gear' }, 'N');
    const spdVal = h('span', {}, '0');
    const odo = h('div', { class: 'odo' }, '0 m');
    const status = h('div', { class: 'status' });
    root.append(timerBox, gear, h('div', { class: 'spd' }, spdVal, h('small', {}, 'km/h')), odo, status);

    return {
      update(f) {
        status.textContent = '';
        const st = stats.update(f);
        const { max, frac, atLimit } = rpmInfo(f);
        if (max && max !== scaleMax) drawScale(max);
        const off = atLimit && !blinkOn();
        segs.forEach((p, i) => {
          const at = (i + 0.5) / N;
          const red = at >= ZONES.red;
          p.setAttribute('fill', at <= frac && !off ? (red ? C.red : C.lit) : red ? C.redOff : C.seg);
        });
        gear.classList.toggle('shift', frac >= ZONES.red);
        gear.textContent = gearText(f.gear);
        spdVal.textContent = Math.round(f.speedKmh);
        top.textContent = `${Math.round(st.top)} km/h`;
        avg.textContent = `${Math.round(st.avg)} km/h`;
        time.textContent = fmtTime(f.lapTime);
        odo.textContent = `${fmtInt(f.lapDistance)} m`;
        const running = st.sprintFrom !== null && st.armed;
        const t = st.sprint ?? (running ? f.lapTime - st.sprintFrom : 0);
        timer.textContent = t.toFixed(2).padStart(5, '0');
        timer.classList.toggle('done', st.sprint !== null && !running);
      },
      idle(text) {
        status.textContent = text;
        segs.forEach((p, i) => p.setAttribute('fill', (i + 0.5) / N >= ZONES.red ? C.redOff : C.seg));
        gear.classList.remove('shift');
        gear.textContent = 'N';
        spdVal.textContent = '0';
      },
    };
  },
};
