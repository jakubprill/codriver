// B · Zegary – klasyczne tarcze z wskazówkami.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, polar, blinkOn } from '../lib/util.js';

const C = { ground: '#15120f', face: '#1d1915', rim: '#2c2620', ivory: '#efe6d2', muted: '#8f8473', minor: '#6d6356', needle: '#ff6a1a', red: '#c8321f', green: '#4cc38a', amber: '#f4a81d', blue: '#3b86ff' };

const CSS = `
.t-zegary { position: absolute; inset: 0; background: ${C.ground}; color: ${C.ivory};
  font-family: 'Archivo Narrow', 'Arial Narrow', sans-serif; font-variant-numeric: tabular-nums; }
.t-zegary svg.dial { position: absolute; top: 70px; }
.t-zegary .mid { position: absolute; left: 710px; top: 150px; width: 180px; display: flex; flex-direction: column; align-items: center; gap: 28px; }
.t-zegary .leds { display: flex; gap: 10px; }
.t-zegary .leds span { width: 22px; height: 22px; border-radius: 50%; background: ${C.rim}; }
.t-zegary .gearbox { width: 170px; height: 220px; border: 4px solid ${C.rim}; border-radius: 18px; background: #0f0d0b;
  display: flex; align-items: center; justify-content: center; font-size: 190px; font-weight: 700; line-height: 1; }
.t-zegary .cap { font-size: 26px; color: ${C.muted}; }
.t-zegary .strip { position: absolute; left: 0; right: 0; bottom: 34px; display: flex; justify-content: center; gap: 64px; font-size: 30px; color: ${C.muted}; }
.t-zegary .strip b { color: ${C.ivory}; margin-left: 8px; }
.t-zegary .status { position: absolute; left: 0; right: 0; bottom: 90px; text-align: center; font-size: 34px; color: ${C.muted}; }
`;

const START = -135, END = 135, CX = 320;
const ang = (v, max) => START + (END - START) * Math.min(1, v / max);

function dial({ max, step, major, label, redFrom, div = 1 }) {
  const svg = s('svg', { class: 'dial', width: 640, height: 640, viewBox: '0 0 640 640', role: 'img', 'aria-label': label });
  svg.append(s('circle', { cx: CX, cy: CX, r: 306, fill: C.face, stroke: C.rim, 'stroke-width': 4 }));
  if (redFrom != null) {
    const [x0, y0] = polar(CX, CX, 290, ang(redFrom, max));
    const [x1, y1] = polar(CX, CX, 290, ang(max, max));
    svg.append(s('path', { d: `M${x0},${y0} A290,290 0 0 1 ${x1},${y1}`, fill: 'none', stroke: C.red, 'stroke-width': 22 }));
  }
  for (let v = 0; v <= max + 1e-9; v += step) {
    const big = Math.abs(v / major - Math.round(v / major)) < 1e-6;
    const a = ang(v, max);
    const [x1, y1] = polar(CX, CX, big ? 252 : 268, a);
    const [x2, y2] = polar(CX, CX, 290, a);
    svg.append(s('line', { x1, y1, x2, y2, stroke: redFrom != null && v >= redFrom ? C.red : big ? C.ivory : C.minor, 'stroke-width': big ? 6 : 3, 'stroke-linecap': 'round' }));
    if (big) {
      const [tx, ty] = polar(CX, CX, 212, a);
      svg.append(s('text', { x: tx, y: ty, fill: redFrom != null && v >= redFrom ? '#e0553f' : C.ivory, 'font-size': 36, 'font-weight': 600, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, Math.round(v / div)));
    }
  }
  const needle = s('line', { x1: CX, y1: CX, x2: CX, y2: CX - 250, stroke: C.needle, 'stroke-width': 9, 'stroke-linecap': 'round' });
  svg.append(needle, s('circle', { cx: CX, cy: CX, r: 26, fill: C.rim }));
  const set = (v) => needle.setAttribute('transform', `rotate(${ang(Math.max(0, v), max)} ${CX} ${CX})`);
  set(0);
  return { svg, set };
}

export default {
  id: 'zegary',
  name: 'Zegary',
  description: 'Analogowe tarcze z wskazówkami, jak w starym rajdówce',
  create(stage) {
    useFont('Archivo+Narrow:wght@400;600;700');
    useStyle('zegary', CSS);

    const spd = dial({ max: 200, step: 5, major: 20, label: 'Prędkościomierz' });
    spd.svg.style.left = '70px';
    const spdNum = s('text', { x: 320, y: 470, fill: C.ivory, 'font-size': 88, 'font-weight': 700, 'text-anchor': 'middle' }, '0');
    spd.svg.append(spdNum, s('text', { x: 320, y: 512, fill: C.muted, 'font-size': 28, 'text-anchor': 'middle' }, 'km/h'));

    let tach = null;
    let tachMax = 0;
    const tachWrap = h('div');
    const buildTach = (maxRpm) => {
      const max = Math.max(7, Math.ceil(maxRpm / 1000)); // skala w tysiącach
      if (tach && max === tachMax) return;
      tachMax = max;
      tach = dial({ max, step: 0.25, major: 1, label: 'Obrotomierz', redFrom: maxRpm ? (maxRpm * 0.92) / 1000 : max - 1 });
      tach.svg.style.right = '70px';
      tach.svg.append(s('text', { x: 320, y: 470, fill: C.muted, 'font-size': 28, 'text-anchor': 'middle' }, '×1000 obr/min'));
      tachWrap.replaceChildren(tach.svg);
    };
    buildTach(0);

    const leds = [C.green, C.green, C.amber, C.amber, C.red].map((c) => Object.assign(h('span'), { _c: c }));
    const gear = h('div', { class: 'gearbox' }, '–');
    const lt = h('b', {}, '0:00,0');
    const dist = h('b', {}, '0 m');
    const status = h('div', { class: 'status' });

    const root = h('div', { class: 't-zegary' },
      spd.svg, tachWrap,
      h('div', { class: 'mid' }, h('div', { class: 'leds' }, leds), gear, h('div', { class: 'cap' }, 'bieg')),
      status,
      h('div', { class: 'strip' }, h('span', {}, 'czas odcinka', lt), h('span', {}, 'dystans', dist)),
    );
    stage.append(root);

    return {
      update(f) {
        status.textContent = '';
        const { max, frac, atLimit } = rpmInfo(f);
        buildTach(max);
        spd.set(f.speedKmh);
        spdNum.textContent = Math.round(f.speedKmh);
        tach.set(f.rpm / 1000);
        gear.textContent = gearText(f.gear);
        const lit = max ? Math.round(((frac - 0.75) / 0.215) * 5) : 0;
        const flash = atLimit && !blinkOn();
        leds.forEach((l, i) => { l.style.background = atLimit ? (flash ? C.rim : C.blue) : i < lit ? l._c : C.rim; });
        lt.textContent = fmtTime(f.lapTime);
        dist.textContent = `${fmtInt(Math.max(0, f.lapDistance))} m`;
      },
      idle(text) {
        status.textContent = text;
        spd.set(0); tach.set(0);
        spdNum.textContent = '0';
        gear.textContent = '–';
        leds.forEach((l) => { l.style.background = C.rim; });
      },
    };
  },
};
