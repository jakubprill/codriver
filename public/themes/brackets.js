// AG · Brackets – two tall rounded brackets of fine orange ticks fill from the bottom like liquid:
// speed on the left, RPM on the right; a road and the gear down the middle.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, clamp, blinkOn, ZONES } from '../lib/util.js';
import { fillPath } from '../lib/gauge.js';

const C = { bg: '#000', fg: '#f6efe6', muted: '#8a7a68', orange: '#ff7a10', yellow: '#ffbf1a', tick: '#6a3a10', red: '#ff3a1a' };

const CSS = `
.t-brackets { position: absolute; inset: 0; background: ${C.bg}; color: ${C.fg}; font-family: 'Exo 2', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums; }
.t-brackets svg { position: absolute; inset: 0; overflow: visible; }
.t-brackets .val { position: absolute; top: 330px; width: 300px; text-align: center; font-size: 96px; font-weight: 300; line-height: 1; }
.t-brackets .val small { display: block; font-size: 22px; color: ${C.muted}; margin-top: 8px; }
.t-brackets .gear { position: absolute; left: 740px; top: 560px; width: 120px; height: 120px; border: 3px solid ${C.fg}; display: grid; place-items: center; font-size: 90px; line-height: 1; }
.t-brackets .gear.shift { border-color: ${C.red}; color: ${C.red}; }
.t-brackets .top { position: absolute; left: 0; right: 0; top: 60px; text-align: center; font-size: 28px; letter-spacing: .1em; color: ${C.muted}; }
.t-brackets .top b { color: ${C.fg}; font-weight: 400; margin: 0 14px; }
.t-brackets .odo { position: absolute; left: 600px; width: 400px; text-align: center; top: 700px; font-size: 24px; color: ${C.muted}; letter-spacing: .15em; }
.t-brackets .status { position: absolute; left: 0; right: 0; top: 110px; text-align: center; font-size: 22px; color: ${C.muted}; }
`;

/** A U-shaped bracket opening towards the middle: from the bottom inner end round to the top inner end. */
const bracket = (x0, x1, dir) => {
  const y0 = 720, y1 = 110, r = 140;
  const xo = dir < 0 ? Math.min(x0, x1) : Math.max(x0, x1);
  const xi = dir < 0 ? Math.max(x0, x1) : Math.min(x0, x1);
  const sw = dir < 0 ? 1 : 0;
  return `M${xi} ${y0} H${xo - dir * r} A${r} ${r} 0 0 ${sw} ${xo} ${y0 - r} V${y1 + r} A${r} ${r} 0 0 ${sw} ${xo - dir * r} ${y1} H${xi}`;
};

export default {
  id: 'brackets',
  name: 'Brackets',
  description: 'Two tall rounded brackets of orange ticks fill like liquid: speed and RPM',
  create(stage) {
    useFont('Exo+2:wght@300;400');
    useStyle('brackets', CSS);

    const left = bracket(500, 150, -1);
    const right = bracket(1100, 1450, 1);
    const tick = (d) => s('path', { d, fill: 'none', stroke: C.tick, 'stroke-width': 60, 'stroke-dasharray': '2 6' });
    const spdFill = fillPath(left, { stroke: 'url(#brackets-fill)', 'stroke-width': 60, 'stroke-linecap': 'butt' });
    const rpmFill = fillPath(right, { stroke: 'url(#brackets-fill)', 'stroke-width': 60, 'stroke-linecap': 'butt' });
    const thr = fillPath('M560 690 V420', { stroke: C.yellow, 'stroke-width': 10 });
    const brk = fillPath('M1040 690 V420', { stroke: C.red, 'stroke-width': 10 });
    const svg = s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, 'aria-hidden': 'true' },
      s('defs', {}, s('linearGradient', { id: 'brackets-fill', x1: 0, y1: 1, x2: 0, y2: 0 },
        s('stop', { offset: 0, 'stop-color': C.yellow }), s('stop', { offset: 1, 'stop-color': C.orange }))),
      tick(left), tick(right), spdFill, rpmFill,
      s('path', { d: 'M560 690 V420 M1040 690 V420', stroke: '#1a1208', 'stroke-width': 10 }), thr, brk,
      // the road
      s('path', { d: 'M770 140 L700 540 M830 140 L900 540', stroke: '#555', 'stroke-width': 3, fill: 'none' }),
      s('path', { d: 'M800 160 V520', stroke: '#333', 'stroke-width': 3, 'stroke-dasharray': '20 20' }));

    const spd = h('div', { class: 'val', style: 'left:240px' }, '0', h('small', {}, 'km/h'));
    const rpm = h('div', { class: 'val', style: 'right:240px' }, '0', h('small', {}, 'rpm'));
    const gear = h('div', { class: 'gear' }, 'N');
    const time = h('b', {}, '0:00.0');
    const dist = h('div', { class: 'odo' }, 'DIST 000000');
    const status = h('div', { class: 'status' });
    stage.append(h('div', { class: 't-brackets' }, svg, spd, rpm, gear, dist,
      h('div', { class: 'top' }, 'STAGE', time),
      status));

    return {
      update(f) {
        status.textContent = '';
        const { frac, atLimit } = rpmInfo(f);
        spdFill.set(f.speedKmh / 200);
        rpmFill.set(atLimit && !blinkOn() ? 0 : frac);
        rpmFill.setAttribute('stroke', frac >= ZONES.red ? C.red : 'url(#brackets-fill)');
        thr.set(f.throttle);
        brk.set(f.brake);
        spd.firstChild.textContent = Math.round(f.speedKmh);
        rpm.firstChild.textContent = Math.round(f.rpm / 50) * 50;
        gear.textContent = gearText(f.gear);
        gear.classList.toggle('shift', frac >= ZONES.red);
        time.textContent = fmtTime(f.lapTime);
        dist.textContent = `DIST ${String(Math.round(f.lapDistance)).padStart(6, '0')}`;
      },
      idle(text) {
        status.textContent = text;
        spdFill.set(0);
        rpmFill.set(0);
        thr.set(0);
        brk.set(0);
        spd.firstChild.textContent = '0';
        rpm.firstChild.textContent = '0';
        gear.textContent = 'N';
      },
    };
  },
};
