// N · Eighties – a 1980s electronic dashboard: a green ramp of bars that climbs with the RPM,
// a lit seven-segment speed window, a row of coloured indicator lamps and LCD boxes below.
import { h, s, useFont, useStyle, rpmInfo, gearText, clamp, blinkOn, ZONES } from '../lib/util.js';
import { sevenSeg } from '../lib/seg7.js';

const C = { bezel: '#0b100d', glass: '#08130e', off: '#13261c', green: '#43e0a0', mint: '#b9f7d8', amber: '#ffb347', red: '#ff4a3a', box: '#1b4a36', muted: '#3f7a60' };

const CSS = `
.t-eighties { position: absolute; inset: 0; background: ${C.bezel}; font-family: 'VT323', 'Consolas', monospace; color: ${C.green}; }
.t-eighties .glass { position: absolute; inset: 40px; border-radius: 26px; background: ${C.glass}; box-shadow: inset 0 0 0 3px #1c2a22, inset 0 0 80px rgba(0,0,0,.6); }
.t-eighties svg { position: absolute; overflow: visible; }
.t-eighties .k { position: absolute; font-size: 30px; color: ${C.muted}; }
.t-eighties .win { position: absolute; border-radius: 10px; background: ${C.box}; box-shadow: 0 0 30px rgba(67, 224, 160, .15); }
.t-eighties .lamps { position: absolute; left: 110px; right: 110px; top: 520px; display: flex; justify-content: space-between; }
.t-eighties .lamps span { width: 92px; height: 46px; border-radius: 6px; background: #142019; color: #22352b; font-size: 26px; display: grid; place-items: center; }
.t-eighties .lamps span.on { background: var(--c); color: #0b100d; box-shadow: 0 0 18px var(--c); }
.t-eighties .status { position: absolute; left: 0; right: 0; bottom: 56px; text-align: center; font-size: 32px; color: ${C.muted}; }
`;

const N = 64;
const X0 = 130, X1 = 980, BASE = 400;

export default {
  id: 'eighties',
  name: 'Eighties',
  description: '1980s electronic dash: a green ramp of bars, lit digital speed, indicator lamps',
  create(stage) {
    useFont('VT323');
    useStyle('eighties', CSS);

    // the ramp: bars rise along a curve, low on the left, flattening out at the top of the range
    const ramp = s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, style: 'left:0;top:0', 'aria-hidden': 'true' });
    const bars = [];
    const w = (X1 - X0) / N;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const top = BASE - 40 - 250 * Math.sin((t * Math.PI) / 2); // concave ramp
      const rect = s('rect', { x: X0 + i * w, y: top, width: w * 0.62, height: 26 + 40 * t, fill: C.off });
      bars.push(rect);
      ramp.append(rect);
    }
    const scale = s('g', { 'font-size': 34, fill: C.green, 'text-anchor': 'middle' });
    ramp.append(scale);
    let scaleMax = 0;
    const drawScale = (max) => {
      scaleMax = max;
      scale.replaceChildren();
      for (let k = 1; k * 1000 <= max; k++) {
        const i = Math.min(N - 1, Math.round(((k * 1000) / max) * (N - 1)));
        const b = bars[i];
        scale.append(s('text', { x: Number(b.getAttribute('x')) + 4, y: Number(b.getAttribute('y')) + Number(b.getAttribute('height')) + 36 }, String(k)));
      }
    };
    // brake: a vertical column, like a temperature gauge
    const col = Array.from({ length: 14 }, (_, i) => s('rect', { x: 1420, y: 400 - i * 22, width: 40, height: 16, fill: C.off }));
    ramp.append(...col);

    const speed = sevenSeg({ count: 3, w: 96, h: 170, gap: 22, x: 1000, y: 150, on: C.mint, ghost: 'rgba(185, 247, 216, 0.05)', skew: 0 });
    const dist = sevenSeg({ count: 5, w: 30, h: 56, gap: 10, x: 150, y: 625, on: C.mint, ghost: 'rgba(185, 247, 216, 0.05)', skew: 0 });
    const time = sevenSeg({ count: 5, w: 30, h: 56, gap: 10, x: 560, y: 625, on: C.mint, ghost: 'rgba(185, 247, 216, 0.05)', skew: 0 });
    const gear = sevenSeg({ count: 1, w: 30, h: 56, gap: 10, x: 1200, y: 625, on: C.mint, ghost: 'rgba(185, 247, 216, 0.05)', skew: 0 });
    const colon = h('div', { class: 'k', style: 'left:648px;top:628px;color:#b9f7d8;font-size:56px' }, ':');

    const lamp = (label, color) => h('span', { style: `--c:${color}` }, label);
    const L = { thr: lamp('THR', C.green), brk: lamp('BRK', C.red), clu: lamp('CLU', C.amber), up: lamp('UP', C.amber), lim: lamp('LIM', C.red), g: lamp('G', C.green) };
    const status = h('div', { class: 'status' });

    stage.append(h('div', { class: 't-eighties' },
      h('div', { class: 'glass' }),
      h('div', { class: 'win', style: 'left:985px;top:135px;width:410px;height:200px' }),
      h('div', { class: 'win', style: 'left:135px;top:610px;width:240px;height:86px' }),
      h('div', { class: 'win', style: 'left:545px;top:610px;width:240px;height:86px' }),
      h('div', { class: 'win', style: 'left:1185px;top:610px;width:60px;height:86px' }),
      ramp, speed.svg, dist.svg, time.svg, gear.svg, colon,
      h('div', { class: 'k', style: 'left:130px;top:450px' }, '1/MIN × 1000'),
      h('div', { class: 'k', style: 'left:1320px;top:340px' }, 'KM/H'),
      h('div', { class: 'k', style: 'left:1405px;top:410px' }, 'BRK'),
      h('div', { class: 'k', style: 'left:385px;top:650px' }, 'M'),
      h('div', { class: 'k', style: 'left:1100px;top:650px' }, 'GEAR'),
      h('div', { class: 'lamps' }, ...Object.values(L)),
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
            b.setAttribute('fill', i < n && !off ? (at >= ZONES.red ? C.red : at >= ZONES.amber ? C.amber : C.green) : at >= ZONES.red ? '#2c1210' : C.off);
          });
        }
        const nb = Math.round(clamp(f.brake) * col.length);
        col.forEach((c, i) => c.setAttribute('fill', i < nb ? (i > 10 ? C.red : i > 7 ? C.amber : C.green) : C.off));
        speed.set(String(Math.round(f.speedKmh)));
        dist.set(String(Math.round(f.lapDistance) % 1e5));
        const t = Math.floor(f.lapTime);
        time.set(`${String(Math.floor(t / 60) % 100).padStart(2, '0')} ${String(t % 60).padStart(2, '0')}`);
        const gt = gearText(f.gear);
        gear.set(gt === 'N' ? 'n' : gt === 'R' ? 'r' : gt);
        L.thr.classList.toggle('on', f.throttle > 0.9);
        L.brk.classList.toggle('on', f.brake > 0.1);
        L.clu.classList.toggle('on', f.clutch > 0.1);
        L.up.classList.toggle('on', frac >= ZONES.red);
        L.lim.classList.toggle('on', atLimit && blinkOn());
        L.g.classList.toggle('on', Math.hypot(f.gLat, f.gLon) > 1);
      },
      idle(text) {
        status.textContent = text;
        lit = -1;
        bars.forEach((b, i) => b.setAttribute('fill', i / N >= ZONES.red ? '#2c1210' : C.off));
        col.forEach((c) => c.setAttribute('fill', C.off));
        speed.set('0');
        gear.set('n');
        Object.values(L).forEach((el) => el.classList.remove('on'));
      },
    };
  },
};
