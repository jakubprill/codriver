// H · Orbit – a HUD ring seen at an angle: glowing orange segments for the RPM, a fine tick ring
// and the speed in the middle; gear and stage data flat on the sides, where they read best.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, fmtG, clamp, blinkOn, polar, ZONES } from '../lib/util.js';

const C = {
  bg: '#030304', ring: '#c9cfe0', dim: '#1c1712', dot: '#3a3f52', tick: '#e9ecf5', fg: '#f6f3ee', muted: '#8d8a86',
  hot0: '#ffcf7a', hot1: '#ff8a1f', hot2: '#ff3b1a', thr: '#ffb547', brk: '#7fa8ff',
};

const CSS = `
.t-orbit { position: absolute; inset: 0; color: ${C.fg}; font-family: 'Rajdhani', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums;
  background: radial-gradient(ellipse at 50% 55%, #14100c 0, ${C.bg} 60%); overflow: hidden; }
.t-orbit .tilt { position: absolute; left: 420px; top: 20px; width: 760px; height: 760px;
  transform: perspective(1600px) rotateX(24deg) rotateY(-22deg) rotateZ(-6deg); transform-origin: 50% 50%; }
.t-orbit .tilt svg { position: absolute; inset: 0; overflow: visible; }
.t-orbit .seg { transition: fill .08s; }
.t-orbit .label { position: absolute; left: 0; right: 0; top: 270px; text-align: center; font-size: 30px; font-weight: 600; letter-spacing: .3em; color: ${C.muted}; }
.t-orbit .spd { position: absolute; left: 0; right: 0; top: 310px; text-align: center; font-size: 150px; font-weight: 700; line-height: 1; }
.t-orbit .unit { position: absolute; left: 0; right: 0; top: 465px; text-align: center; font-size: 30px; font-weight: 600; letter-spacing: .2em; color: ${C.muted}; }
.t-orbit .side { position: absolute; top: 140px; font-size: 26px; font-weight: 600; letter-spacing: .18em; color: ${C.muted}; line-height: 1.4; }
.t-orbit .side b { display: block; font-size: 52px; font-weight: 600; letter-spacing: 0; color: ${C.fg}; margin-bottom: 26px; }
.t-orbit .gear { position: absolute; right: 90px; top: 250px; text-align: right; font-size: 26px; font-weight: 600; letter-spacing: .18em; color: ${C.muted}; }
.t-orbit .gear b { display: block; font-size: 240px; font-weight: 700; line-height: .9; letter-spacing: 0; color: ${C.fg}; }
.t-orbit .gear.shift b { color: ${C.hot1}; text-shadow: 0 0 30px ${C.hot2}; }
.t-orbit .status { position: absolute; left: 0; right: 0; bottom: 30px; text-align: center; font-size: 26px; font-weight: 600; letter-spacing: .1em; color: ${C.muted}; }
`;

const CX = 380;
const CY = 380;
const SEGMENTS = 22;
const SWEEP = 270;
const START = 225; // polar(): 0 = top, clockwise
const R_IN = 250;
const R_OUT = 330;
const GAP = 2.2; // degrees between segments

/** An annular sector between two angles (polar degrees). */
function sector(r0, r1, a0, a1) {
  const p = (r, a) => polar(CX, CY, r, a).map((v) => v.toFixed(1)).join(' ');
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${p(r1, a0)}A${r1} ${r1} 0 ${large} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 ${large} 0 ${p(r0, a0)}Z`;
}

const arcPath = (r, a0, a1) => {
  const [x0, y0] = polar(CX, CY, r, a0);
  const [x1, y1] = polar(CX, CY, r, a1);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${a1 > a0 ? 1 : 0} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
};

export default {
  id: 'orbit',
  name: 'Orbit',
  description: 'A tilted HUD ring of glowing orange segments around the speed',
  create(stage) {
    useFont('Rajdhani:wght@500;600;700');
    useStyle('orbit', CSS);

    // RPM: segments light up from the bottom left; colour warms towards the red zone
    const step = SWEEP / SEGMENTS;
    const segs = Array.from({ length: SEGMENTS }, (_, i) => {
      const a0 = START + i * step + GAP / 2;
      const outer = R_OUT + (i / SEGMENTS) * 22; // the band widens towards the top of the range
      return s('path', { class: 'seg', d: sector(R_IN, outer, a0, a0 + step - GAP), fill: C.dim });
    });
    const segColor = (i) => {
      const at = (i + 1) / SEGMENTS;
      return at >= ZONES.red ? C.hot2 : at >= ZONES.amber ? C.hot1 : C.hot0;
    };

    // fine tick ring inside the band, a dotted ring outside
    const ticks = s('g', { stroke: C.tick, 'stroke-linecap': 'round' });
    for (let a = 0; a < 360; a += 4) {
      const long = a % 20 === 0;
      const [x0, y0] = polar(CX, CY, 200, a);
      const [x1, y1] = polar(CX, CY, long ? 228 : 216, a);
      ticks.append(s('line', { x1: x0, y1: y0, x2: x1, y2: y1, 'stroke-width': long ? 3 : 1.5, opacity: long ? 0.9 : 0.5 }));
    }
    const dots = s('g', { fill: C.dot });
    for (let a = 0; a < 360; a += 3) {
      const [x, y] = polar(CX, CY, 372, a);
      dots.append(s('circle', { cx: x, cy: y, r: a % 15 === 0 ? 3 : 1.6 }));
    }

    // throttle and brake: thin inner arcs, left and right, filling upwards
    const inner = (a0, a1, color) => s('path', { d: arcPath(176, a0, a1), fill: 'none', stroke: color, 'stroke-width': 5, 'stroke-linecap': 'round',
      pathLength: 100, 'stroke-dasharray': '0 100', style: `filter: drop-shadow(0 0 6px ${color})` });
    // a round cap would still draw a dot at 0 %, so an empty arc is hidden
    const fillTo = (path, v) => {
      path.setAttribute('stroke-dasharray', `${(clamp(v) * 100).toFixed(1)} 100`);
      path.style.opacity = v > 0.005 ? 1 : 0;
    };
    const thr = inner(215, 325, C.thr);
    const brk = inner(145, 35, C.brk);

    const svg = s('svg', { width: 760, height: 760, viewBox: '0 0 760 760', 'aria-hidden': 'true' },
      s('defs', {},
        s('filter', { id: 'orbit-glow', x: '-20%', y: '-20%', width: '140%', height: '140%' },
          s('feGaussianBlur', { stdDeviation: 9, result: 'b' }),
          s('feMerge', {}, s('feMergeNode', { in: 'b' }), s('feMergeNode', { in: 'SourceGraphic' }))),
        s('linearGradient', { id: 'orbit-rim', x1: 0, y1: 0, x2: 1, y2: 1 },
          s('stop', { offset: 0, 'stop-color': '#3b4256' }), s('stop', { offset: 0.45, 'stop-color': C.ring }), s('stop', { offset: 0.6, 'stop-color': '#ffffff' }),
          s('stop', { offset: 1, 'stop-color': '#2a2f40' }))),
      s('circle', { cx: CX, cy: CY, r: 390, fill: 'none', stroke: 'url(#orbit-rim)', 'stroke-width': 4 }),
      dots,
      s('circle', { cx: CX, cy: CY, r: 244, fill: '#08070a', stroke: '#24202a', 'stroke-width': 2 }),
      s('g', { filter: 'url(#orbit-glow)' }, ...segs),
      ticks,
      s('path', { d: arcPath(176, 215, 325), fill: 'none', stroke: '#2a2620', 'stroke-width': 5, 'stroke-linecap': 'round' }),
      s('path', { d: arcPath(176, 145, 35), fill: 'none', stroke: '#2a2620', 'stroke-width': 5, 'stroke-linecap': 'round' }),
      thr, brk);

    const spd = h('span', {}, '0');
    const gear = h('b', {}, 'N');
    const gearBox = h('div', { class: 'gear' }, 'gear', gear);
    const time = h('b', {}, '0:00.0');
    const dist = h('b', {}, '0 m');
    const g = h('b', {}, '0.0 g');
    const status = h('div', { class: 'status' });

    stage.append(h('div', { class: 't-orbit' },
      h('div', { class: 'tilt' }, svg,
        h('div', { class: 'label' }, 'speed'),
        h('div', { class: 'spd' }, spd),
        h('div', { class: 'unit' }, 'km/h')),
      h('div', { class: 'side', style: 'left:90px' }, 'time', time, 'distance', dist, 'g-force', g),
      gearBox,
      status));

    let lit = -1;
    let blinkOff = false;
    const light = (n, off) => {
      if (n === lit && off === blinkOff) return;
      lit = n;
      blinkOff = off;
      segs.forEach((p, i) => p.setAttribute('fill', i < n && !off ? segColor(i) : C.dim));
    };

    return {
      update(f) {
        status.textContent = '';
        const { frac, atLimit } = rpmInfo(f);
        light(Math.round(frac * SEGMENTS), atLimit && !blinkOn());
        gearBox.classList.toggle('shift', frac >= ZONES.red);
        gear.textContent = gearText(f.gear);
        spd.textContent = Math.round(f.speedKmh);
        time.textContent = fmtTime(f.lapTime);
        dist.textContent = `${fmtInt(f.lapDistance)} m`;
        g.textContent = fmtG(f);
        fillTo(thr, f.throttle);
        fillTo(brk, f.brake);
      },
      idle(text) {
        status.textContent = text;
        light(0, false);
        fillTo(thr, 0);
        fillTo(brk, 0);
        gearBox.classList.remove('shift');
        gear.textContent = 'N';
        spd.textContent = '0';
      },
    };
  },
};
