// D · Neon – just the gear inside a glowing RPM ring, and the speed.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, clamp, blinkOn } from '../lib/util.js';

const C = { bg: '#08070d', track: '#1a1726', fg: '#f3f0ff', muted: '#8a84a6', cyan: '#38e8ff', violet: '#8b5cff', pink: '#ff3da8', blue: '#3b86ff' };

const CSS = `
.t-neon { position: absolute; inset: 0; background: ${C.bg}; color: ${C.fg}; font-family: 'Unbounded', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums; }
.t-neon .ring { position: absolute; left: 480px; top: 40px; filter: drop-shadow(0 0 22px rgba(255, 61, 168, .55)); }
.t-neon .gear { position: absolute; left: 480px; top: 150px; width: 640px; text-align: center; font-size: 380px; font-weight: 800; line-height: 1; letter-spacing: -0.04em; }
.t-neon .spd { position: absolute; left: 480px; top: 610px; width: 640px; display: flex; justify-content: center; align-items: baseline; gap: 18px; }
.t-neon .spd b { font-size: 96px; font-weight: 500; }
.t-neon .spd span { font-size: 28px; font-weight: 300; color: ${C.muted}; }
.t-neon .rail { position: absolute; top: 120px; bottom: 120px; width: 6px; background: ${C.track}; border-radius: 3px; }
.t-neon .rail i { position: absolute; left: 0; right: 0; bottom: 0; border-radius: 3px; }
.t-neon .side { position: absolute; top: 120px; font-size: 26px; font-weight: 300; color: ${C.muted}; line-height: 1.7; }
.t-neon .side b { display: block; font-size: 54px; font-weight: 500; color: ${C.fg}; }
.t-neon .status { position: absolute; left: 0; right: 0; bottom: 40px; text-align: center; font-size: 26px; font-weight: 300; color: ${C.muted}; }
`;

const R = 280;
const CIRC = 2 * Math.PI * R;
const ARC = CIRC * 0.75;

export default {
  id: 'neon',
  name: 'Neon',
  description: 'The gear in a glowing RPM ring, nothing else',
  create(stage) {
    useFont('Unbounded:wght@300;500;800');
    useStyle('neon', CSS);

    const fill = s('circle', { cx: 320, cy: 320, r: R, fill: 'none', stroke: 'url(#neon-ring)', 'stroke-width': 26, 'stroke-linecap': 'round',
      'stroke-dasharray': `0 ${CIRC}`, transform: 'rotate(135 320 320)' });
    const ring = s('svg', { class: 'ring', width: 640, height: 640, viewBox: '0 0 640 640', 'aria-hidden': 'true' },
      s('defs', {}, s('linearGradient', { id: 'neon-ring', x1: 0, y1: 1, x2: 1, y2: 0 },
        s('stop', { offset: 0, 'stop-color': C.cyan }), s('stop', { offset: 0.65, 'stop-color': C.violet }), s('stop', { offset: 1, 'stop-color': C.pink }))),
      s('circle', { cx: 320, cy: 320, r: R, fill: 'none', stroke: C.track, 'stroke-width': 26, 'stroke-linecap': 'round',
        'stroke-dasharray': `${ARC} ${CIRC}`, transform: 'rotate(135 320 320)' }),
      fill);

    const gear = h('div', { class: 'gear' }, '–');
    const spd = h('b', {}, '0');
    const brk = h('i', { style: `background:${C.pink};height:0` });
    const thr = h('i', { style: `background:${C.cyan};height:0;box-shadow:0 0 16px ${C.cyan}` });
    const lt = h('b', {}, '0:00.0');
    const rpm = h('b', {}, '0');
    const status = h('div', { class: 'status' });

    const root = h('div', { class: 't-neon' },
      ring, gear,
      h('div', { class: 'spd' }, spd, h('span', {}, 'km/h')),
      h('div', { class: 'rail', style: 'left:90px' }, brk),
      h('div', { class: 'rail', style: 'right:90px' }, thr),
      h('div', { class: 'side', style: 'left:160px' }, 'time', lt),
      h('div', { class: 'side', style: 'right:160px;text-align:right' }, 'rpm', rpm),
      status);
    stage.append(root);

    return {
      update(f) {
        status.textContent = '';
        const { frac, atLimit } = rpmInfo(f);
        fill.setAttribute('stroke-dasharray', `${(ARC * frac).toFixed(1)} ${CIRC}`);
        fill.setAttribute('stroke', atLimit ? C.blue : 'url(#neon-ring)');
        fill.style.opacity = atLimit && !blinkOn() ? 0.25 : 1;
        gear.textContent = gearText(f.gear);
        spd.textContent = Math.round(f.speedKmh);
        rpm.textContent = Math.round(f.rpm / 50) * 50;
        lt.textContent = fmtTime(f.lapTime);
        thr.style.height = `${clamp(f.throttle) * 100}%`;
        brk.style.height = `${clamp(f.brake) * 100}%`;
      },
      idle(text) {
        status.textContent = text;
        fill.setAttribute('stroke-dasharray', `0 ${CIRC}`);
        gear.textContent = '–';
        spd.textContent = '0';
      },
    };
  },
};
