// F · LCD – a greenish liquid-crystal display with seven-segment digits,
// like a 1990s car. Unlit segments show faintly, as on a real LCD.
import { h, s, useFont, useStyle, rpmInfo, fmtTime, clamp, blinkOn, ZONES } from '../lib/util.js';
import { sevenSeg as makeSevenSeg } from '../lib/seg7.js';

const C = { bezel: '#1c1f1a', glass: '#b9c6a5', glass2: '#a9b794', on: '#1c2617', ghost: 'rgba(28, 38, 23, 0.08)', label: '#4c5a43' };

const CSS = `
.t-lcd { position: absolute; inset: 0; background: ${C.bezel}; font-family: 'Share Tech Mono', 'Consolas', monospace; }
.t-lcd .glass { position: absolute; inset: 36px; border-radius: 28px; background: radial-gradient(ellipse at 50% 40%, ${C.glass}, ${C.glass2});
  box-shadow: inset 0 0 0 3px #0e100c, inset 0 10px 40px rgba(0,0,0,.25); color: ${C.on}; }
.t-lcd svg { position: absolute; overflow: visible; }
.t-lcd .lab { position: absolute; font-size: 30px; color: ${C.label}; }
.t-lcd .status { position: absolute; left: 0; right: 0; bottom: 34px; text-align: center; font-size: 30px; color: ${C.label}; }
`;

const sevenSeg = (o) => makeSevenSeg({ ...o, on: C.on, ghost: C.ghost });

const N_BARS = 32;

export default {
  id: 'lcd',
  name: 'LCD',
  description: 'Greenish LCD with calculator-style digits',
  create(stage) {
    useFont('Share+Tech+Mono');
    useStyle('lcd', CSS);

    // bar tachometer: narrow rectangles growing to the right
    const barsSvg = s('svg', { width: 1400, height: 130, style: 'left:64px;top:56px', 'aria-hidden': 'true' });
    const bars = [];
    for (let i = 0; i < N_BARS; i++) {
      const hgt = 40 + (90 * (i + 1)) / N_BARS;
      const r = s('rect', { x: i * 43.75, y: 130 - hgt, width: 34, height: hgt, fill: C.ghost });
      bars.push(r);
      barsSvg.append(r);
    }
    const redMark = s('rect', { x: 0, y: 0, width: 0, height: 6, fill: C.on });
    barsSvg.append(redMark);

    // "shift up" arrow
    const arrow = s('svg', { width: 90, height: 110, style: 'left:1238px;top:250px', 'aria-hidden': 'true' },
      s('polygon', { points: '45,0 90,55 62,55 62,110 28,110 28,55 0,55', fill: C.ghost }));
    const arrowPoly = arrow.firstChild;

    const speed = sevenSeg({ count: 3, w: 110, h: 220, gap: 24, x: 70, y: 280 });
    const gear = sevenSeg({ count: 1, w: 190, h: 380, gap: 0, x: 640, y: 220 });
    const rpm = sevenSeg({ count: 4, w: 62, h: 120, gap: 14, x: 1180, y: 420 });
    const time = sevenSeg({ count: 4, w: 40, h: 76, gap: 22, x: 70, y: 580 });
    // colon between minutes and seconds
    time.svg.append(s('rect', { x: 112, y: 22, width: 8, height: 8, fill: C.on }), s('rect', { x: 109, y: 48, width: 8, height: 8, fill: C.on }));
    const status = h('div', { class: 'status' });

    const glass = h('div', { class: 'glass' },
      barsSvg,
      h('div', { class: 'lab', style: 'left:64px;top:196px' }, 'rpm ×1000'),
      speed.svg, h('div', { class: 'lab', style: 'left:70px;top:516px' }, 'km/h'),
      gear.svg, h('div', { class: 'lab', style: 'left:640px;top:612px' }, 'gear'),
      arrow, h('div', { class: 'lab', style: 'left:1214px;top:366px' }, 'shift'),
      rpm.svg, h('div', { class: 'lab', style: 'left:1180px;top:548px' }, 'rpm'),
      time.svg, h('div', { class: 'lab', style: 'left:70px;top:666px' }, 'time  min:s'),
      status);
    stage.append(h('div', { class: 't-lcd' }, glass));

    return {
      update(f) {
        status.textContent = '';
        const { max, atLimit } = rpmInfo(f);
        const scaleMax = max || 7000;
        const lit = Math.round(clamp(f.rpm / scaleMax) * N_BARS);
        bars.forEach((b, i) => b.setAttribute('fill', i < lit ? C.on : C.ghost));
        if (max) {
          const from = Math.floor(ZONES.red * N_BARS);
          redMark.setAttribute('x', from * 43.75);
          redMark.setAttribute('width', (N_BARS - from) * 43.75 - 10);
        }
        arrowPoly.setAttribute('fill', atLimit && blinkOn() ? C.on : C.ghost);
        speed.set(Math.min(999, Math.round(f.speedKmh)));
        gear.set(f.gear === 0 ? 'n' : f.gear < 0 || f.gear >= 10 ? 'r' : f.gear);
        rpm.set(Math.min(9999, Math.round(f.rpm / 10) * 10));
        const [m, sec] = fmtTime(f.lapTime).split(':');
        time.set(`${m.slice(-2).padStart(2, ' ')}${sec.slice(0, 2)}`);
      },
      idle(text) {
        status.textContent = text;
        bars.forEach((b) => b.setAttribute('fill', C.ghost));
        arrowPoly.setAttribute('fill', C.ghost);
        speed.set('  0'); gear.set('-'); rpm.set('   0'); time.set('    ');
      },
    };
  },
};
