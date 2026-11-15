// Drawing helpers shared by the gauge looks: arcs, ring sectors, tick marks, bars that fill.
// Angles are polar() degrees: 0 = top, clockwise.
import { s, polar, clamp } from './util.js';

const f1 = (v) => v.toFixed(1);

/** SVG path of a circular arc from a0 to a1 (either direction). */
export function arc(cx, cy, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  return `M${f1(x0)} ${f1(y0)}A${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${a1 > a0 ? 1 : 0} ${f1(x1)} ${f1(y1)}`;
}

/** SVG path of a ring sector between radii r0 < r1 and angles a0 < a1. */
export function sector(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => polar(cx, cy, r, a).map(f1).join(' ');
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${p(r1, a0)}A${r1} ${r1} 0 ${large} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 ${large} 0 ${p(r0, a0)}Z`;
}

/** Radial tick lines from angle `from` to `to`, every `step` degrees; `long(i)` picks the long ones. */
export function ticks({ cx, cy, r, len, longLen = len, from, to, step, long = () => false, ...attrs }) {
  const g = s('g', { 'stroke-linecap': 'round', ...attrs });
  const n = Math.round((to - from) / step);
  for (let i = 0; i <= n; i++) {
    const a = from + i * step;
    const l = long(i) ? longLen : len;
    const [x0, y0] = polar(cx, cy, r, a);
    const [x1, y1] = polar(cx, cy, r - l, a);
    g.append(s('line', { x1: f1(x0), y1: f1(y0), x2: f1(x1), y2: f1(y1), 'stroke-width': long(i) ? 3 : 1.5 }));
  }
  return g;
}

/**
 * A stroke that fills along its path (any path; pathLength 100). Returns the element; set(v) fills 0..1.
 * A round cap would still draw a dot at 0 %, so an empty fill is hidden.
 */
export function fillPath(d, attrs = {}) {
  const el = s('path', { d, fill: 'none', pathLength: 100, 'stroke-dasharray': '0 100', ...attrs });
  el.set = (v) => {
    el.setAttribute('stroke-dasharray', `${f1(clamp(v) * 100)} 100`);
    el.style.opacity = v > 0.005 ? '' : '0';
  };
  el.set(0);
  return el;
}

/** RPM ×1000 labels for a scale whose maximum is known only once data arrives. */
export const thousands = (max) => Math.max(1, Math.floor(max / 1000));
