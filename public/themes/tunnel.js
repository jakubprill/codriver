// AD · Tunnel – an orange wireframe tunnel rushing towards you: rings and rays converge on a
// vanishing point, a white RPM arc runs round the inner rings; pedal levels on the left, speed on the right.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, fmtG, clamp, blinkOn, polar, ZONES } from '../lib/util.js';
import { arc, fillPath } from '../lib/gauge.js';

const C = { bg: '#120502', fg: '#fff4ea', muted: '#ffb08a', orange: '#ff5a14', glow: '#ff7a2a', white: '#f2f2f2', red: '#ff2010' };

const CSS = `
.t-tunnel { position: absolute; inset: 0; color: ${C.fg}; font-family: 'Michroma', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums;
  background: radial-gradient(ellipse at 50% 45%, #5a1606 0, #2a0803 40%, ${C.bg} 75%); overflow: hidden; }
.t-tunnel svg { position: absolute; inset: 0; overflow: visible; }
.t-tunnel .spd { position: absolute; right: 90px; top: 300px; font-size: 140px; line-height: 1; transform: skewX(-8deg); text-shadow: 0 0 20px ${C.orange}; }
.t-tunnel .unit { position: absolute; right: 100px; top: 440px; font-size: 26px; color: ${C.muted}; }
.t-tunnel .gear { position: absolute; left: 680px; top: 330px; width: 240px; text-align: center; font-size: 120px; line-height: 1; }
.t-tunnel .gear.shift { color: ${C.red}; }
.t-tunnel .lv { position: absolute; left: 90px; top: 150px; font-size: 26px; letter-spacing: .3em; color: ${C.muted}; }
.t-tunnel .row { position: absolute; left: 90px; top: 640px; font-size: 22px; color: ${C.muted}; display: flex; gap: 50px; }
.t-tunnel .row b { display: block; font-size: 34px; color: ${C.fg}; font-weight: 400; }
.t-tunnel .status { position: absolute; left: 0; right: 0; bottom: 20px; text-align: center; font-size: 22px; color: ${C.muted}; }
`;

const VX = 800, VY = 390; // vanishing point
const A0 = 200, A1 = 470;

export default {
  id: 'tunnel',
  name: 'Tunnel',
  description: 'Orange wireframe tunnel rushing towards you, a white RPM arc round the inner rings',
  create(stage) {
    useFont('Michroma');
    useStyle('tunnel', CSS);

    const svg = s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, 'aria-hidden': 'true' });
    const rays = s('g', { stroke: C.orange, 'stroke-width': 1.5, opacity: 0.35 });
    for (let a = 0; a < 360; a += 10) {
      const [x0, y0] = polar(VX, VY, 160, a);
      const [x1, y1] = polar(VX, VY, 1100, a);
      rays.append(s('line', { x1: x0, y1: y0, x2: x1, y2: y1 }));
    }
    // rings move outwards to make the tunnel rush past; speed sets the pace
    const rings = Array.from({ length: 7 }, () => {
      const c = s('circle', { cx: VX, cy: VY, r: 100, fill: 'none', stroke: C.orange, 'stroke-width': 2 });
      svg.append(c);
      return c;
    });
    svg.prepend(rays);
    svg.append(s('path', { d: arc(VX, VY, 230, A0, A1), fill: 'none', stroke: '#4a1a10', 'stroke-width': 26 }));
    const rpmArc = fillPath(arc(VX, VY, 230, A0, A1), { stroke: C.white, 'stroke-width': 26, style: 'filter: drop-shadow(0 0 12px #fff)' });
    const labels = s('g', { 'font-size': 34, fill: C.fg, 'text-anchor': 'middle', 'dominant-baseline': 'central', stroke: C.bg, 'stroke-width': 8, 'paint-order': 'stroke' });
    svg.append(rpmArc, labels);
    let scaleMax = 0;
    const drawScale = (max) => {
      scaleMax = max;
      labels.replaceChildren();
      for (let k = 0; k * 1000 <= max; k++) {
        const [x, y] = polar(VX, VY, 290, A0 + ((A1 - A0) * k * 1000) / max);
        labels.append(s('text', { x, y }, String(k)));
      }
    };
    // level bars: throttle, brake, clutch
    const bars = ['thr', 'brk', 'clu'].map((k, j) => {
      const cells = Array.from({ length: 16 }, (_, i) => s('rect', { x: 100 + j * 60, y: 560 - i * 22, width: 36, height: 14, fill: '#3a1208' }));
      svg.append(...cells, s('text', { x: 118 + j * 60, y: 600, 'font-size': 20, fill: C.muted, 'text-anchor': 'middle' }, k));
      return (v) => cells.forEach((c, i) => c.setAttribute('fill', i < Math.round(clamp(v) * cells.length) ? C.white : '#3a1208'));
    });

    const spd = h('div', { class: 'spd' }, '0');
    const gear = h('div', { class: 'gear' }, 'N');
    const time = h('b', {}, '0:00.0');
    const dist = h('b', {}, '0 m');
    const g = h('b', {}, '0.0 g');
    const status = h('div', { class: 'status' });
    stage.append(h('div', { class: 't-tunnel' }, svg, spd, h('div', { class: 'unit' }, 'KM/H'), gear,
      h('div', { class: 'lv' }, 'LEVELS'),
      h('div', { class: 'row' }, h('span', {}, 'time', time), h('span', {}, 'distance', dist), h('span', {}, 'g', g)),
      status));

    let phase = 0;
    let last = performance.now();
    const rush = (kmh) => {
      const now = performance.now();
      phase = (phase + ((now - last) / 1000) * (0.15 + kmh / 120)) % 1;
      last = now;
      rings.forEach((c, i) => {
        const t = (i / rings.length + phase) % 1;
        c.setAttribute('r', (160 + 900 * t * t).toFixed(0));
        c.setAttribute('opacity', (0.7 * (1 - t)).toFixed(2));
      });
    };
    rush(0);

    return {
      update(f) {
        status.textContent = '';
        const { max, frac, atLimit } = rpmInfo(f);
        if (max && max !== scaleMax) drawScale(max);
        rush(f.speedKmh);
        rpmArc.set(atLimit && !blinkOn() ? 0 : frac);
        rpmArc.setAttribute('stroke', frac >= ZONES.red ? C.red : C.white);
        spd.textContent = Math.round(f.speedKmh);
        gear.textContent = gearText(f.gear);
        gear.classList.toggle('shift', frac >= ZONES.red);
        bars[0](f.throttle);
        bars[1](f.brake);
        bars[2](f.clutch);
        time.textContent = fmtTime(f.lapTime);
        dist.textContent = `${fmtInt(f.lapDistance)} m`;
        g.textContent = fmtG(f);
      },
      idle(text) {
        status.textContent = text;
        rush(0);
        rpmArc.set(0);
        bars.forEach((b) => b(0));
        spd.textContent = '0';
        gear.textContent = 'N';
      },
    };
  },
};
