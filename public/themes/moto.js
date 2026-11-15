// O · Moto – a motorcycle TFT: the RPM climbs a rising S-curve of cyan hatching, the speed huge
// top left, the gear in a box bottom right, a status strip along the top.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, fmtG, clamp, blinkOn, ZONES } from '../lib/util.js';

const C = { bg: '#000', fg: '#fff', muted: '#8a8f99', cyan: '#4fd2ff', off: '#2a2d33', red: '#ff3b1f', rail: '#d9dde4', blue: '#2a8cff' };

const CSS = `
.t-moto { position: absolute; inset: 0; background: ${C.bg}; color: ${C.fg}; font-family: 'Titillium Web', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums; }
.t-moto svg { position: absolute; inset: 0; overflow: visible; }
.t-moto .strip { position: absolute; left: 0; right: 0; top: 0; height: 64px; border-bottom: 3px solid ${C.blue}; display: flex; justify-content: space-between; align-items: center; padding: 0 60px; font-size: 32px; }
.t-moto .strip b { color: ${C.blue}; font-weight: 700; letter-spacing: .06em; }
.t-moto .spd { position: absolute; left: 50px; top: 80px; font-size: 230px; font-weight: 900; font-style: italic; line-height: 1; letter-spacing: -0.03em; }
.t-moto .unit { position: absolute; left: 60px; top: 320px; font-size: 34px; color: ${C.muted}; }
.t-moto .gear { position: absolute; right: 60px; bottom: 80px; width: 190px; height: 210px; border-radius: 18px; background: #12161d; display: grid; place-items: center;
  font-size: 200px; font-weight: 900; font-style: italic; color: ${C.blue}; line-height: 1; }
.t-moto .gear.shift { background: ${C.red}; color: #000; }
.t-moto .foot { position: absolute; left: 60px; bottom: 30px; font-size: 32px; color: ${C.muted}; display: flex; gap: 60px; }
.t-moto .foot b { color: ${C.fg}; font-weight: 600; margin-left: 10px; }
.t-moto .status { position: absolute; left: 0; right: 0; bottom: 120px; text-align: center; font-size: 28px; color: ${C.muted}; }
`;

const N = 90;
const X0 = 60, X1 = 1380;
/** The rail: low and flat on the left, rising steeply in the middle, flattening at the top. */
const railY = (t) => 640 - 380 / (1 + Math.exp(-9 * (t - 0.5)));

export default {
  id: 'moto',
  name: 'Moto',
  description: 'Motorcycle display: RPM climbs a rising S-curve, huge speed, gear in a box',
  create(stage) {
    useFont('Titillium+Web:ital,wght@0,400;0,600;0,700;1,900');
    useStyle('moto', CSS);

    const svg = s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, 'aria-hidden': 'true' });
    const hatch = [];
    const step = (X1 - X0) / N;
    let rail = '';
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const x = X0 + i * step;
      const y = railY(t);
      rail += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      // hatching below the rail, a little slanted
      const line = s('line', { x1: x, y1: y + 10, x2: x - 10, y2: y + 70, stroke: C.off, 'stroke-width': 6 });
      hatch.push(line);
      svg.append(line);
    }
    svg.append(s('path', { d: rail, fill: 'none', stroke: C.rail, 'stroke-width': 6 }));
    const scale = s('g', { 'font-size': 64, 'font-weight': 900, 'font-style': 'italic', fill: C.fg, 'text-anchor': 'middle' });
    svg.append(scale);
    let scaleMax = 0;
    const drawScale = (max) => {
      scaleMax = max;
      scale.replaceChildren();
      for (let k = 0; k * 1000 <= max; k++) {
        const t = (k * 1000) / max;
        const x = X0 + t * (X1 - X0);
        scale.append(s('text', { x, y: railY(t) - 24, fill: t >= ZONES.red ? C.red : C.fg }, String(k)));
      }
    };

    const spd = h('div', { class: 'spd' }, '0');
    const gear = h('div', { class: 'gear' }, 'N');
    const dist = h('b', {}, '0 m');
    const time = h('b', {}, '0:00.0');
    const g = h('b', {}, '0.0 g');
    const thr = h('b', {}, '0%');
    const status = h('div', { class: 'status' });
    stage.append(h('div', { class: 't-moto' },
      svg,
      h('div', { class: 'strip' }, h('span', {}, 'distance ', dist), h('span', {}, 'stage ', time), h('b', {}, 'RALLY')),
      spd, h('div', { class: 'unit' }, 'km/h'), gear,
      h('div', { class: 'foot' }, h('span', {}, 'g-force', g), h('span', {}, 'throttle', thr)),
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
          hatch.forEach((l, i) => {
            const red = i / N >= ZONES.red;
            l.setAttribute('stroke', i < n && !off ? (red ? C.red : C.cyan) : red ? '#4a160c' : C.off);
          });
        }
        gear.classList.toggle('shift', frac >= ZONES.red);
        spd.textContent = Math.round(f.speedKmh);
        gear.textContent = gearText(f.gear);
        dist.textContent = `${fmtInt(f.lapDistance)} m`;
        time.textContent = fmtTime(f.lapTime);
        g.textContent = fmtG(f);
        thr.textContent = `${Math.round(clamp(f.throttle) * 100)}%`;
      },
      idle(text) {
        status.textContent = text;
        lit = -1;
        hatch.forEach((l, i) => l.setAttribute('stroke', i / N >= ZONES.red ? '#4a160c' : C.off));
        gear.classList.remove('shift');
        spd.textContent = '0';
        gear.textContent = 'N';
      },
    };
  },
};
