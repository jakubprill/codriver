// E · Papier – jasny wyświetlacz jak trójkolorowy e-papier: czarny tusz, czerwień na odcięciu,
// kreskowanie zamiast poświaty. Bez migania – e-papier nie miga.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, fmtG, clamp, ZONES } from '../lib/util.js';

const C = { paper: '#e6e2d6', ink: '#161616', grey: '#8d887c', faint: '#cdc8ba', red: '#b3261e' };

const CSS = `
.t-papier { position: absolute; inset: 0; background: ${C.paper}; color: ${C.ink};
  font-family: 'IBM Plex Sans Condensed', 'Arial Narrow', sans-serif; font-variant-numeric: tabular-nums; }
.t-papier .tach { position: absolute; left: 80px; top: 60px; }
.t-papier .ro { position: absolute; top: 300px; width: 440px; }
.t-papier .ro .num { font-size: 230px; line-height: .8; font-weight: 600; letter-spacing: -0.02em; }
.t-papier .ro .unit { font-size: 32px; color: ${C.grey}; margin-top: 18px; font-style: italic; }
.t-papier .gearbox { position: absolute; left: 610px; top: 250px; width: 380px; height: 390px; background: ${C.ink}; color: ${C.paper};
  display: flex; align-items: center; justify-content: center; font-size: 400px; font-weight: 600; line-height: 1; border-radius: 6px; }
.t-papier .gearbox.limit { background: ${C.red}; }
.t-papier .strip { position: absolute; left: 80px; right: 80px; bottom: 40px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 40px; }
.t-papier .strip > div { border-top: 3px solid ${C.ink}; padding-top: 10px; font-size: 26px; color: ${C.grey}; font-style: italic; }
.t-papier .strip b { display: block; font-size: 46px; color: ${C.ink}; font-style: normal; font-weight: 600; margin-top: 2px; }
.t-papier .ped { height: 22px; border: 2px solid ${C.ink}; margin-top: 10px; position: relative; }
.t-papier .ped i { position: absolute; left: 0; top: 0; bottom: 0; background: ${C.ink}; }
.t-papier .status { position: absolute; left: 0; right: 0; top: 670px; text-align: center; font-size: 30px; font-style: italic; color: ${C.grey}; }
`;

const W = 1440, BAR_H = 96;

export default {
  id: 'papier',
  name: 'Papier',
  description: 'Jasny jak e-papier: czarny tusz, czerwień na odcięciu',
  create(stage) {
    useFont('IBM+Plex+Sans+Condensed:ital,wght@0,400;0,600;1,400');
    useStyle('papier', CSS);

    const hatch = s('pattern', { id: 'papier-hatch', width: 14, height: 14, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
      s('rect', { width: 14, height: 14, fill: C.paper }), s('rect', { width: 7, height: 14, fill: C.ink }));
    const fill = s('rect', { x: 0, y: 0, width: 0, height: BAR_H, fill: 'url(#papier-hatch)' });
    const solid = s('rect', { x: 0, y: 0, width: 0, height: BAR_H, fill: C.ink });
    const redZone = s('rect', { x: W, y: 0, width: 0, height: BAR_H, fill: 'none', stroke: C.red, 'stroke-width': 6 });
    const ticks = s('g');
    const tach = s('svg', { class: 'tach', width: W, height: 170, viewBox: `0 0 ${W} 170`, 'aria-hidden': 'true' },
      s('defs', {}, hatch),
      s('rect', { x: 0, y: 0, width: W, height: BAR_H, fill: 'none', stroke: C.ink, 'stroke-width': 3 }),
      fill, solid, redZone, ticks);

    let ticksFor = 0;
    const drawTicks = (max) => {
      const top = Math.max(1, Math.ceil(max / 1000));
      if (top === ticksFor) return;
      ticksFor = top;
      ticks.replaceChildren();
      for (let k = 0; k <= top; k++) {
        const x = (k / top) * W;
        const anchor = k === 0 ? 'start' : k === top ? 'end' : 'middle';
        ticks.append(s('line', { x1: x, y1: BAR_H, x2: x, y2: BAR_H + 18, stroke: C.ink, 'stroke-width': 3 }),
          s('text', { x, y: BAR_H + 56, 'font-size': 34, fill: C.ink, 'text-anchor': anchor }, k));
        if (k < top) for (let q = 1; q < 4; q++) {
          const xq = x + (q / 4) * (W / top);
          ticks.append(s('line', { x1: xq, y1: BAR_H, x2: xq, y2: BAR_H + 10, stroke: C.grey, 'stroke-width': 2 }));
        }
      }
      ticks.append(s('text', { x: W, y: BAR_H + 56, dy: 40, 'font-size': 24, fill: C.grey, 'text-anchor': 'end', 'font-style': 'italic' }, '× 1000 obr/min'));
    };
    drawTicks(7000);

    const speed = h('div', { class: 'num' }, '0');
    const rpm = h('div', { class: 'num', style: 'font-size:150px' }, '0');
    const gear = h('div', { class: 'gearbox' }, '–');
    const lt = h('b', {}, '0:00,0');
    const dist = h('b', {}, '0 m');
    const gval = h('b', {}, '0,0 g');
    const thr = h('i', { style: 'width:0' });
    const brk = h('i', { style: `width:0;background:${C.red}` });
    const status = h('div', { class: 'status' });

    const root = h('div', { class: 't-papier' },
      tach,
      h('div', { class: 'ro', style: 'left:80px' }, speed, h('div', { class: 'unit' }, 'km/h')),
      gear,
      h('div', { class: 'ro', style: 'right:80px;text-align:right;top:340px' }, rpm, h('div', { class: 'unit' }, 'obr/min')),
      status,
      h('div', { class: 'strip' },
        h('div', {}, 'czas odcinka', lt),
        h('div', {}, 'dystans', dist),
        h('div', {}, 'przeciążenie', gval),
        h('div', {}, 'gaz i hamulec', h('div', { class: 'ped' }, thr), h('div', { class: 'ped', style: 'margin-top:6px' }, brk))),
    );
    stage.append(root);

    return {
      update(f) {
        status.textContent = '';
        const { max, frac, atLimit } = rpmInfo(f);
        const scaleMax = Math.max(1, Math.ceil(max / 1000)) * 1000 || 7000;
        drawTicks(scaleMax);
        const x = clamp(f.rpm / scaleMax) * W;
        const amberX = max ? (max * ZONES.amber / scaleMax) * W : W;
        fill.setAttribute('width', Math.min(x, amberX).toFixed(1));
        solid.setAttribute('x', amberX.toFixed(1));
        solid.setAttribute('width', Math.max(0, x - amberX).toFixed(1));
        solid.setAttribute('fill', atLimit ? C.red : C.ink);
        if (max) {
          const rx = (max * ZONES.red / scaleMax) * W;
          redZone.setAttribute('x', rx.toFixed(1));
          redZone.setAttribute('width', Math.max(0, (max / scaleMax) * W - rx).toFixed(1));
        }
        gear.textContent = gearText(f.gear);
        gear.classList.toggle('limit', atLimit);
        speed.textContent = Math.round(f.speedKmh);
        rpm.textContent = Math.round(f.rpm / 50) * 50;
        lt.textContent = fmtTime(f.lapTime);
        dist.textContent = `${fmtInt(Math.max(0, f.lapDistance))} m`;
        gval.textContent = fmtG(f);
        thr.style.width = `${clamp(f.throttle) * 100}%`;
        brk.style.width = `${clamp(f.brake) * 100}%`;
        void frac;
      },
      idle(text) {
        status.textContent = text;
        fill.setAttribute('width', 0);
        solid.setAttribute('width', 0);
        gear.textContent = '–';
        gear.classList.remove('limit');
      },
    };
  },
};
