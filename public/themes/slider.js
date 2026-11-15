// W · Slider – a minimal vertical scale: the RPM is a glowing bulge riding up a fine line,
// with a knob at the current value; the speed sits huge beside it, the gear below.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, fmtG, clamp, blinkOn, ZONES } from '../lib/util.js';

const C = { bg: '#151515', fg: '#f0ece2', muted: '#5f5c56', gold: '#ffd23a', red: '#ff4b3a', knob: '#262626' };

const CSS = `
.t-slider { position: absolute; inset: 0; color: ${C.fg}; font-family: 'Lexend', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums; font-weight: 200;
  background: radial-gradient(ellipse at 40% 50%, #1d1d1d 0, ${C.bg} 70%); }
.t-slider svg { position: absolute; inset: 0; overflow: visible; }
.t-slider .spd { position: absolute; left: 720px; top: 210px; font-size: 300px; line-height: 1; color: ${C.gold}; letter-spacing: -0.02em; }
.t-slider .spd.shift { color: ${C.red}; }
.t-slider .unit { position: absolute; left: 730px; top: 520px; font-size: 32px; color: ${C.muted}; }
.t-slider .gear { position: absolute; left: 1330px; top: 230px; font-size: 32px; color: ${C.muted}; }
.t-slider .gear b { display: block; font-size: 200px; font-weight: 300; color: ${C.fg}; line-height: 1; }
.t-slider .foot { position: absolute; left: 730px; top: 610px; display: flex; gap: 70px; font-size: 24px; color: ${C.muted}; }
.t-slider .foot b { display: block; font-size: 40px; font-weight: 300; color: ${C.fg}; }
.t-slider .status { position: absolute; left: 0; right: 0; bottom: 30px; text-align: center; font-size: 24px; color: ${C.muted}; }
`;

const X = 560, TOP = 90, BOTTOM = 710; // the scale line
const BULGE = 70; // how far the glow pushes the line out
const yOf = (frac) => BOTTOM - (BOTTOM - TOP) * frac;

export default {
  id: 'slider',
  name: 'Slider',
  description: 'Minimal vertical scale: the RPM a glowing bulge riding up a fine line',
  create(stage) {
    useFont('Lexend:wght@200;300');
    useStyle('slider', CSS);

    const svg = s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, 'aria-hidden': 'true' });
    // fine ticks to the left of the line
    const ticks = s('g', { stroke: C.muted, 'stroke-width': 2 });
    for (let i = 0; i <= 60; i++) {
      const y = BOTTOM - ((BOTTOM - TOP) * i) / 60;
      ticks.append(s('line', { x1: X - (i % 10 === 0 ? 50 : 22), y1: y, x2: X - 8, y2: y }));
    }
    const labels = s('g', { 'font-size': 44, fill: C.muted, 'text-anchor': 'end', 'dominant-baseline': 'central', 'font-weight': 200 });
    let scaleMax = 0;
    const drawScale = (max) => {
      scaleMax = max;
      labels.replaceChildren();
      for (let k = 0; k * 1000 <= max; k++) labels.append(s('text', { x: X - 70, y: yOf((k * 1000) / max) }, String(k)));
      labels.append(s('text', { x: X - 70, y: BOTTOM + 50, 'font-size': 30 }, 'rpm ×1000'));
    };
    const line = s('path', { d: '', fill: 'none', stroke: C.gold, 'stroke-width': 4, style: `filter: drop-shadow(0 0 6px ${C.gold})` });
    const glow = s('ellipse', { rx: 60, ry: 120, fill: 'url(#slider-glow)' });
    const knob = s('g', {},
      s('circle', { r: 56, fill: C.knob, style: 'filter: drop-shadow(0 8px 16px rgba(0,0,0,.7))' }),
      s('circle', { r: 40, fill: 'none', stroke: '#333', 'stroke-width': 3 }),
      s('path', { d: 'M-9 -6 L0 -18 L9 -6 Z M-9 6 L0 18 L9 6 Z', fill: '#8a8780' }));
    svg.append(
      s('defs', {}, s('radialGradient', { id: 'slider-glow' }, s('stop', { offset: 0, 'stop-color': C.gold, 'stop-opacity': 0.55 }), s('stop', { offset: 1, 'stop-color': C.gold, 'stop-opacity': 0 }))),
      ticks, labels, glow, line, knob);

    const spd = h('div', { class: 'spd' }, '0');
    const gear = h('b', {}, 'N');
    const time = h('b', {}, '0:00.0');
    const dist = h('b', {}, '0 m');
    const gf = h('b', {}, '0.0 g');
    const status = h('div', { class: 'status' });
    stage.append(h('div', { class: 't-slider' }, svg, spd, h('div', { class: 'unit' }, 'km/h'),
      h('div', { class: 'gear' }, 'gear', gear),
      h('div', { class: 'foot' }, h('span', {}, 'stage', time), h('span', {}, 'distance', dist), h('span', {}, 'g-force', gf)),
      status));

    // the line bulges out around the current value, smoothly
    const shape = (y) => {
      const k = 95;
      return `M${X} ${TOP}L${X} ${y - k * 1.6}C${X} ${y - k * 0.7} ${X - BULGE} ${y - k * 0.6} ${X - BULGE} ${y}`
        + `C${X - BULGE} ${y + k * 0.6} ${X} ${y + k * 0.7} ${X} ${y + k * 1.6}L${X} ${BOTTOM}`;
    };
    let shown = 0;
    const place = (frac, color) => {
      shown += (frac - shown) * 0.35; // ease, like a physical slider
      const y = yOf(shown);
      line.setAttribute('d', shape(y));
      line.setAttribute('stroke', color);
      glow.setAttribute('cx', X - 10);
      glow.setAttribute('cy', y);
      knob.setAttribute('transform', `translate(${X + 8 - BULGE} ${y})`);
    };
    place(0, C.gold);

    return {
      update(f) {
        status.textContent = '';
        const { max, frac, atLimit } = rpmInfo(f);
        if (max && max !== scaleMax) drawScale(max);
        const red = frac >= ZONES.red;
        place(clamp(frac), red ? C.red : C.gold);
        glow.style.opacity = atLimit && !blinkOn() ? 0 : 1;
        spd.classList.toggle('shift', red);
        spd.textContent = Math.round(f.speedKmh);
        gear.textContent = gearText(f.gear);
        time.textContent = fmtTime(f.lapTime);
        dist.textContent = `${fmtInt(f.lapDistance)} m`;
        gf.textContent = fmtG(f);
      },
      idle(text) {
        status.textContent = text;
        shown = 0;
        place(0, C.gold);
        spd.classList.remove('shift');
        spd.textContent = '0';
        gear.textContent = 'N';
      },
    };
  },
};
