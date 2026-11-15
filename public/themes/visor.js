// AC · Visor – a red sci-fi helmet HUD: angled side panels, a steering bar along the top, the speed in
// a glowing capsule with a gear tag, a speed ladder scrolling behind it, throttle cells at the bottom.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, fmtG, clamp, blinkOn, ZONES } from '../lib/util.js';

const C = { bg: '#0b0202', fg: '#ffe9d6', muted: '#a8553a', red: '#ff3a1a', orange: '#ff7a1a', amber: '#ffc04a', dim: '#3a0d06', panel: '#2a0805' };

const CSS = `
.t-visor { position: absolute; inset: 0; color: ${C.fg}; font-family: 'Share Tech', 'Consolas', monospace; font-variant-numeric: tabular-nums;
  background: radial-gradient(ellipse at 50% 50%, #3a0b04 0, ${C.bg} 70%); }
.t-visor svg { position: absolute; inset: 0; overflow: visible; }
.t-visor .spd { position: absolute; left: 650px; top: 330px; width: 300px; text-align: center; font-size: 120px; line-height: 1; color: ${C.fg}; text-shadow: 0 0 20px ${C.orange}; }
.t-visor .unit { position: absolute; left: 650px; top: 455px; width: 300px; text-align: center; font-size: 22px; color: ${C.amber}; letter-spacing: .2em; }
.t-visor .gear { position: absolute; left: 1045px; top: 352px; font-size: 22px; color: ${C.amber}; }
.t-visor .gear b { font-size: 60px; color: ${C.fg}; margin-left: 8px; }
.t-visor .gear.shift b { color: ${C.red}; }
.t-visor .menu { position: absolute; top: 330px; display: flex; flex-direction: column; gap: 14px; font-size: 22px; letter-spacing: .12em; }
.t-visor .menu span { padding: 8px 16px; background: ${C.panel}; border-left: 4px solid ${C.muted}; color: ${C.muted}; }
.t-visor .menu span b { color: ${C.fg}; font-weight: 400; margin-left: 12px; }
.t-visor .menu span.on { border-color: ${C.amber}; color: ${C.amber}; }
.t-visor .k { position: absolute; font-size: 18px; color: ${C.muted}; letter-spacing: .14em; }
.t-visor .status { position: absolute; left: 0; right: 0; bottom: 14px; text-align: center; font-size: 22px; color: ${C.muted}; }
`;

export default {
  id: 'visor',
  name: 'Visor',
  description: 'Red sci-fi helmet HUD: angled panels, steering bar, speed in a glowing capsule',
  create(stage) {
    useFont('Share+Tech');
    useStyle('visor', CSS);

    const svg = s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, 'aria-hidden': 'true' });
    // angled side frames
    svg.append(
      s('path', { d: 'M40 120 H300 L560 640 H470 L250 210 H40 Z', fill: '#1d0603', stroke: C.red, 'stroke-width': 3 }),
      s('path', { d: 'M1560 120 H1300 L1040 640 H1130 L1350 210 H1560 Z', fill: '#1d0603', stroke: C.red, 'stroke-width': 3 }));
    // steering scale on top
    const scale = s('g', { stroke: C.fg, 'stroke-width': 2 });
    for (let i = -20; i <= 20; i++) scale.append(s('line', { x1: 800 + i * 12, y1: 80, x2: 800 + i * 12, y2: i % 5 === 0 ? 104 : 94 }));
    const steerBar = s('rect', { x: 800, y: 108, width: 0, height: 10, fill: C.orange });
    svg.append(s('rect', { x: 540, y: 60, width: 520, height: 70, fill: 'none', stroke: C.red, 'stroke-width': 2 }), scale, steerBar,
      s('line', { x1: 800, y1: 72, x2: 800, y2: 124, stroke: C.amber, 'stroke-width': 3 }));
    // speed ladder behind the capsule: numbers scroll with the speed
    const ladder = s('g', { 'font-size': 46, fill: C.red, opacity: 0.45, 'text-anchor': 'middle', 'clip-path': 'url(#visor-clip)' });
    const ladderText = Array.from({ length: 7 }, () => {
      const t = s('text', { x: 800 });
      ladder.append(t);
      return t;
    });
    svg.append(
      s('defs', {}, s('clipPath', { id: 'visor-clip' }, s('circle', { cx: 800, cy: 400, r: 180 }))),
      s('circle', { cx: 800, cy: 400, r: 230, fill: 'none', stroke: C.red, 'stroke-width': 2, 'stroke-dasharray': '4 8' }),
      s('circle', { cx: 800, cy: 400, r: 200, fill: 'none', stroke: C.dim, 'stroke-width': 30 }),
      ladder);
    const rpmArc = s('circle', { cx: 800, cy: 400, r: 200, fill: 'none', stroke: C.orange, 'stroke-width': 30, pathLength: 100, transform: 'rotate(135 800 400)', 'stroke-dasharray': '0 100' });
    svg.append(rpmArc,
      s('rect', { x: 660, y: 310, width: 280, height: 180, rx: 50, fill: '#2a0a04', stroke: C.amber, 'stroke-width': 6, style: `filter: drop-shadow(0 0 18px ${C.orange})` }));
    // throttle cells at the bottom
    const cells = Array.from({ length: 16 }, (_, i) => s('rect', { x: 660 + i * 18, y: 660, width: 12, height: 50, fill: C.dim }));
    svg.append(...cells, s('rect', { x: 650, y: 650, width: 300, height: 70, fill: 'none', stroke: C.red, 'stroke-width': 2 }));

    const spd = h('div', { class: 'spd' }, '0');
    const gear = h('b', {}, 'N');
    const gearTag = h('div', { class: 'gear' }, 'GEAR', gear);
    const item = (label) => {
      const v = h('b', {}, '–');
      return { el: h('span', {}, label, v), v };
    };
    const L = { g: item('G-FORCE'), brk: item('BRAKE'), clu: item('CLUTCH') };
    const R = { time: item('TIME'), dist: item('DIST'), rpm: item('RPM') };
    const status = h('div', { class: 'status' });
    stage.append(h('div', { class: 't-visor' }, svg, spd, h('div', { class: 'unit' }, 'KM/H'), gearTag,
      h('div', { class: 'menu', style: 'left:40px' }, ...Object.values(L).map((x) => x.el)),
      h('div', { class: 'menu', style: 'right:40px;align-items:flex-end' }, ...Object.values(R).map((x) => x.el)),
      h('div', { class: 'k', style: 'left:540px;top:136px' }, 'STEER'),
      h('div', { class: 'k', style: 'left:650px;top:726px' }, 'THROTTLE'),
      status));

    return {
      update(f) {
        status.textContent = '';
        const { frac, atLimit } = rpmInfo(f);
        rpmArc.setAttribute('stroke-dasharray', `${(75 * (atLimit && !blinkOn() ? 0 : frac)).toFixed(1)} 100`);
        rpmArc.setAttribute('stroke', frac >= ZONES.red ? C.red : C.orange);
        const st = clamp(f.steer, -1, 1);
        steerBar.setAttribute('x', (st < 0 ? 800 + st * 240 : 800).toFixed(0));
        steerBar.setAttribute('width', (Math.abs(st) * 240).toFixed(0));
        // ladder: values every 5 km/h around the current speed, scrolling smoothly
        const v = f.speedKmh;
        const base = Math.round(v / 5) * 5;
        ladderText.forEach((t, i) => {
          const val = base + (3 - i) * 5;
          t.textContent = val >= 0 ? val : '';
          t.setAttribute('y', (400 + (i - 3) * 56 + (v - base) * 11.2 + 16).toFixed(0));
          t.setAttribute('opacity', Math.abs(i - 3) < 2 ? 0.15 : 1);
        });
        spd.textContent = Math.round(v);
        gear.textContent = gearText(f.gear);
        gearTag.classList.toggle('shift', frac >= ZONES.red);
        cells.forEach((c, i) => c.setAttribute('fill', i < Math.round(clamp(f.throttle) * cells.length) ? C.amber : C.dim));
        L.g.v.textContent = fmtG(f);
        L.brk.v.textContent = `${Math.round(clamp(f.brake) * 100)}%`;
        L.clu.v.textContent = `${Math.round(clamp(f.clutch) * 100)}%`;
        L.brk.el.classList.toggle('on', f.brake > 0.1);
        R.time.v.textContent = fmtTime(f.lapTime);
        R.dist.v.textContent = `${fmtInt(f.lapDistance)} m`;
        R.rpm.v.textContent = fmtInt(Math.round(f.rpm / 50) * 50);
      },
      idle(text) {
        status.textContent = text;
        rpmArc.setAttribute('stroke-dasharray', '0 100');
        steerBar.setAttribute('width', 0);
        cells.forEach((c) => c.setAttribute('fill', C.dim));
        spd.textContent = '0';
        gear.textContent = 'N';
      },
    };
  },
};
