// Seven-segment digits drawn in SVG (LCD-style displays). Unlit segments show in `ghost`.
import { s } from './util.js';

export const MAP = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
  '-': 'g', n: 'ceg', r: 'eg', ' ': '',
};

function segments(w, ht, t) {
  const g = t * 0.18, m = ht / 2;
  const hz = (x0, x1, y) => `${x0},${y} ${x0 + t / 2},${y - t / 2} ${x1 - t / 2},${y - t / 2} ${x1},${y} ${x1 - t / 2},${y + t / 2} ${x0 + t / 2},${y + t / 2}`;
  const vt = (x, y0, y1) => `${x},${y0} ${x + t / 2},${y0 + t / 2} ${x + t / 2},${y1 - t / 2} ${x},${y1} ${x - t / 2},${y1 - t / 2} ${x - t / 2},${y0 + t / 2}`;
  const L = t / 2, R = w - t / 2, T = t / 2, B = ht - t / 2;
  return {
    a: hz(L + g, R - g, T), g: hz(L + g, R - g, m), d: hz(L + g, R - g, B),
    f: vt(L, T + g, m - g), e: vt(L, m + g, B - g), b: vt(R, T + g, m - g), c: vt(R, m + g, B - g),
  };
}

/**
 * A display of `count` digits; returns {svg, set(text)} – text is right-aligned.
 * Colours: `on` for lit segments, `ghost` for unlit ones; `skew` slants the digits (degrees).
 */
export function sevenSeg({ count, w, h: ht, gap, x, y, on: onColor, ghost, skew = -6 }) {
  const t = w * 0.2;
  const shape = segments(w, ht, t);
  const svg = s('svg', { width: count * (w + gap), height: ht, style: `left:${x}px;top:${y}px`, 'aria-hidden': 'true' });
  const digits = [];
  for (let i = 0; i < count; i++) {
    const gEl = s('g', { transform: `translate(${i * (w + gap) + ht * 0.06} 0) skewX(${skew})` });
    const segs = {};
    for (const [k, pts] of Object.entries(shape)) {
      segs[k] = s('polygon', { points: pts, fill: ghost });
      gEl.append(segs[k]);
    }
    digits.push(segs);
    svg.append(gEl);
  }
  let last = null;
  const set = (text) => {
    const str = String(text).padStart(count, ' ').slice(-count);
    if (str === last) return;
    last = str;
    [...str].forEach((ch, i) => {
      const on = MAP[ch] ?? '';
      for (const [k, p] of Object.entries(digits[i])) p.setAttribute('fill', on.includes(k) ? onColor : ghost);
    });
  };
  return { svg, set };
}
