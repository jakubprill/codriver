// K · Teal – a calm electric-car look: a thin teal ring with a light sweep that follows the RPM,
// the speed in the middle, glowing lines out to the sides with throttle and brake.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, fmtG, clamp, blinkOn, polar, ZONES } from '../lib/util.js';
import { sector, ticks } from '../lib/gauge.js';

const C = { bg: '#0b0c0f', fg: '#eef6f4', muted: '#6c7a78', teal: '#1fd1b2', deep: '#0c5f55', red: '#ff5a5f' };

const CSS = `
.t-teal { position: absolute; inset: 0; color: ${C.fg}; font-family: 'Michroma', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums;
  background: radial-gradient(ellipse at 50% 48%, #11201e 0, ${C.bg} 55%); }
.t-teal svg { position: absolute; inset: 0; overflow: visible; }
.t-teal .spd { position: absolute; left: 600px; top: 300px; width: 400px; text-align: center; font-size: 130px; line-height: 1; }
.t-teal .unit { position: absolute; left: 600px; top: 440px; width: 400px; text-align: center; font-size: 20px; color: ${C.muted}; }
.t-teal .gear { position: absolute; left: 600px; top: 630px; width: 400px; text-align: center; font-size: 56px; }
.t-teal .gear.shift { color: ${C.red}; }
.t-teal .corner { position: absolute; top: 90px; font-size: 24px; color: ${C.muted}; }
.t-teal .pill { position: absolute; top: 560px; width: 380px; font-size: 26px; color: ${C.fg}; }
.t-teal .pill small { color: ${C.muted}; font-size: 18px; margin-left: 10px; }
.t-teal .pill .bar { height: 8px; margin-top: 14px; background: #1a2422; border-radius: 4px; overflow: hidden; }
.t-teal .pill .bar i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, ${C.deep}, var(--c)); box-shadow: 0 0 10px var(--c); }
.t-teal .status { position: absolute; left: 0; right: 0; bottom: 40px; text-align: center; font-size: 22px; color: ${C.muted}; }
`;

const CX = 800, CY = 400, R = 210, START = 225, SWEEP = 270;

export default {
  id: 'teal',
  name: 'Teal',
  description: 'Calm EV look: a teal ring with a light sweep, glowing lines to the sides',
  create(stage) {
    useFont('Michroma');
    useStyle('teal', CSS);

    const sweep = s('path', { d: '', fill: 'url(#teal-sweep)' });
    const edge = s('line', { stroke: C.teal, 'stroke-width': 4, 'stroke-linecap': 'round', style: `filter: drop-shadow(0 0 8px ${C.teal})` });

    stage.append(h('div', { class: 't-teal' },
      s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, 'aria-hidden': 'true' },
        s('defs', {},
          s('radialGradient', { id: 'teal-sweep', gradientUnits: 'userSpaceOnUse', cx: CX, cy: CY, r: R },
            s('stop', { offset: 0.35, 'stop-color': C.teal, 'stop-opacity': 0 }), s('stop', { offset: 1, 'stop-color': C.teal, 'stop-opacity': 0.55 })),
          s('linearGradient', { id: 'teal-line-l', x1: 0, x2: 1 }, s('stop', { offset: 0, 'stop-color': C.teal, 'stop-opacity': 0 }), s('stop', { offset: 1, 'stop-color': C.teal })),
          s('linearGradient', { id: 'teal-line-r', x1: 1, x2: 0 }, s('stop', { offset: 0, 'stop-color': C.teal, 'stop-opacity': 0 }), s('stop', { offset: 1, 'stop-color': C.teal }))),
        s('rect', { x: 120, y: CY - 1, width: CX - R - 120, height: 2, fill: 'url(#teal-line-l)' }),
        s('rect', { x: CX + R, y: CY - 1, width: 1480 - CX - R, height: 2, fill: 'url(#teal-line-r)' }),
        sweep,
        s('circle', { cx: CX, cy: CY, r: R, fill: 'none', stroke: C.teal, 'stroke-width': 3, style: `filter: drop-shadow(0 0 6px ${C.teal})` }),
        ticks({ cx: CX, cy: CY, r: R + 30, len: 6, longLen: 14, from: START, to: START + SWEEP, step: 6.75, long: (i) => i % 5 === 0, stroke: C.muted }),
        edge)));
    const root = stage.lastChild;

    const spd = h('div', { class: 'spd' }, '0');
    const gear = h('div', { class: 'gear' }, 'N');
    const time = h('span', {}, '0:00.0');
    const rpm = h('span', {}, '0 rpm');
    const pill = (side, label) => {
      const val = h('span', {}, '0');
      const unit = h('small', {}, '');
      const fill = h('i', { style: `--c:${side === 'left' ? C.teal : C.red}` });
      root.append(h('div', { class: 'pill', style: `${side}:160px${side === 'right' ? ';text-align:right' : ''}` }, label, ' ', val, unit, h('div', { class: 'bar' }, fill)));
      return { val, unit, fill };
    };
    const status = h('div', { class: 'status' });
    root.append(spd, h('div', { class: 'unit' }, 'km/h'), gear,
      h('div', { class: 'corner', style: 'left:160px' }, time),
      h('div', { class: 'corner', style: 'right:160px' }, rpm),
      status);
    const left = pill('left', 'distance');
    const right = pill('right', 'g-force');

    return {
      update(f) {
        status.textContent = '';
        const { frac, atLimit } = rpmInfo(f);
        const a = START + SWEEP * Math.max(frac, 0.005);
        sweep.setAttribute('d', sector(CX, CY, 0, R, START, a));
        const [x0, y0] = polar(CX, CY, R * 0.35, a);
        const [x1, y1] = polar(CX, CY, R, a);
        Object.entries({ x1: x0, y1: y0, x2: x1, y2: y1 }).forEach(([k, v]) => edge.setAttribute(k, v.toFixed(1)));
        edge.setAttribute('stroke', frac >= ZONES.red ? C.red : C.teal);
        edge.style.opacity = atLimit && !blinkOn() ? 0.2 : 1;
        gear.classList.toggle('shift', frac >= ZONES.red);
        spd.textContent = Math.round(f.speedKmh);
        gear.textContent = gearText(f.gear);
        time.textContent = fmtTime(f.lapTime);
        rpm.textContent = `${fmtInt(Math.round(f.rpm / 50) * 50)} rpm`;
        left.val.textContent = `${fmtInt(f.lapDistance)} m`;
        left.fill.style.width = `${clamp(f.throttle) * 100}%`;
        right.val.textContent = fmtG(f);
        right.fill.style.width = `${clamp(f.brake) * 100}%`;
      },
      idle(text) {
        status.textContent = text;
        sweep.setAttribute('d', '');
        edge.style.opacity = 0;
        gear.classList.remove('shift');
        spd.textContent = '0';
        gear.textContent = 'N';
        left.fill.style.width = '0';
        right.fill.style.width = '0';
      },
    };
  },
};
