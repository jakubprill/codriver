// T · Drop – a glowing blue drop of nested layers with a fine mesh; layers light up from the centre
// out as the RPM climbs, the gear sits in a ring in the middle.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, fmtG, blinkOn, ZONES } from '../lib/util.js';

const C = { bg: '#000', fg: '#e8f3ff', muted: '#5f7a99', blue: '#2a8cff', cyan: '#4fd8ff', off: '#0a1a2c', red: '#ff4a5a' };

const CSS = `
.t-drop { position: absolute; inset: 0; background: ${C.bg}; color: ${C.fg}; font-family: 'Quantico', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums; }
.t-drop svg { position: absolute; inset: 0; overflow: visible; }
.t-drop .gear { position: absolute; left: 700px; top: 404px; width: 200px; text-align: center; font-size: 90px; line-height: 1; }
.t-drop .gear.shift { color: ${C.red}; }
.t-drop .rpm { display: block; font-size: 56px; color: ${C.cyan}; letter-spacing: 0; line-height: 1.2; }
.t-drop .side { position: absolute; top: 300px; font-size: 24px; color: ${C.muted}; letter-spacing: .1em; line-height: 1.5; }
.t-drop .side b { display: block; font-size: 120px; color: ${C.fg}; font-weight: 400; letter-spacing: 0; line-height: 1; }
.t-drop .side i { display: block; font-style: normal; font-size: 40px; color: ${C.fg}; letter-spacing: 0; margin-bottom: 18px; }
.t-drop .status { position: absolute; left: 0; right: 0; bottom: 30px; text-align: center; font-size: 24px; color: ${C.muted}; }
`;

const CX = 800, CY = 450;
const LAYERS = 10;
/** A drop pointing up: a circle of radius r at the bottom, a point at the top (absolute coordinates,
 * so the mesh pattern keeps its size on every layer). */
const drop = (r) => {
  const p = (x, y) => `${(CX + x * r).toFixed(1)} ${(CY + y * r).toFixed(1)}`;
  return `M${p(0, -1.45)}C${p(0.45, -0.95)} ${p(1, -0.55)} ${p(1, 0)}A${r} ${r} 0 0 1 ${p(-1, 0)}C${p(-1, -0.55)} ${p(-0.45, -0.95)} ${p(0, -1.45)}Z`;
};

export default {
  id: 'drop',
  name: 'Drop',
  description: 'A glowing blue drop of mesh layers that light up from the centre with the RPM',
  create(stage) {
    useFont('Quantico');
    useStyle('drop', CSS);

    const defs = s('defs', {},
      s('pattern', { id: 'drop-mesh', width: 14, height: 14, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
        s('path', { d: 'M0 0H14M0 0V14', stroke: C.cyan, 'stroke-width': 1.2, opacity: 0.55 })),
      s('filter', { id: 'drop-glow', x: '-30%', y: '-30%', width: '160%', height: '160%' },
        s('feGaussianBlur', { stdDeviation: 10, result: 'b' }), s('feMerge', {}, s('feMergeNode', { in: 'b' }), s('feMergeNode', { in: 'SourceGraphic' }))));

    // outer layers first, so the inner ones sit on top
    const layers = [];
    const group = s('g', { filter: 'url(#drop-glow)' });
    for (let k = LAYERS - 1; k >= 0; k--) {
      const r = 72 + k * 22;
      const layer = s('path', { d: drop(r), fill: 'url(#drop-mesh)', stroke: C.blue, 'stroke-width': 3, opacity: 0.08 });
      layers[k] = layer;
      group.append(layer);
    }
    const core = s('circle', { cx: CX, cy: CY, r: 68, fill: '#020814', stroke: C.blue, 'stroke-width': 3 });
    const floor = s('ellipse', { cx: CX, cy: CY + 72 + LAYERS * 22, rx: 260, ry: 14, fill: C.cyan, opacity: 0.15, filter: 'url(#drop-glow)' });

    const gear = h('div', { class: 'gear' }, 'N');
    const rpm = h('span', { class: 'rpm' }, '0');
    const spd = h('b', {}, '0');
    const time = h('i', {}, '0:00.0');
    const dist = h('i', {}, '0 m');
    const g = h('i', {}, '0.0 g');
    const status = h('div', { class: 'status' });
    stage.append(h('div', { class: 't-drop' },
      s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, 'aria-hidden': 'true' }, defs, floor, group, core),
      gear,
      h('div', { class: 'side', style: 'left:110px;top:240px' }, 'speed', spd, 'km/h', h('br'), h('br'), 'rpm ×1000', rpm),
      h('div', { class: 'side', style: 'right:110px;top:240px;text-align:right' }, 'stage time', time, 'distance', dist, 'g-force', g),
      status));

    return {
      update(f) {
        status.textContent = '';
        const { frac, atLimit } = rpmInfo(f);
        const lit = frac * LAYERS;
        const off = atLimit && !blinkOn();
        layers.forEach((p, k) => {
          const on = Math.max(0, Math.min(1, lit - k)); // partly lit at the edge of the glow
          p.setAttribute('opacity', off ? 0.08 : (0.08 + 0.92 * on).toFixed(2));
          p.setAttribute('stroke', frac >= ZONES.red && on > 0 ? C.red : C.blue);
        });
        core.setAttribute('stroke', frac >= ZONES.red ? C.red : C.blue);
        floor.setAttribute('opacity', (0.1 + 0.5 * frac).toFixed(2));
        gear.classList.toggle('shift', frac >= ZONES.red);
        gear.textContent = gearText(f.gear);
        rpm.firstChild.textContent = (f.rpm / 1000).toFixed(1);
        spd.textContent = Math.round(f.speedKmh);
        time.textContent = fmtTime(f.lapTime);
        dist.textContent = `${fmtInt(f.lapDistance)} m`;
        g.textContent = fmtG(f);
      },
      idle(text) {
        status.textContent = text;
        layers.forEach((p) => { p.setAttribute('opacity', 0.08); p.setAttribute('stroke', C.blue); });
        floor.setAttribute('opacity', 0.1);
        gear.classList.remove('shift');
        gear.textContent = 'N';
        spd.textContent = '0';
      },
    };
  },
};
