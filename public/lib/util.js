// Shared helpers for themes.

export const SVG_NS = 'http://www.w3.org/2000/svg';
export const STAGE_W = 1600;
export const STAGE_H = 800;

function build(el, attrs, kids) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

/** HTML element: h('div', {class: 'x', style: '...'}, 'text', h(...)) */
export const h = (tag, attrs, ...kids) => build(document.createElement(tag), attrs, kids);
/** SVG element */
export const s = (tag, attrs, ...kids) => build(document.createElementNS(SVG_NS, tag), attrs, kids);

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/** 0 = N, negative or >= 10 (DiRT Rally) = R */
export const gearText = (g) => (g === 0 ? 'N' : g < 0 || g >= 10 ? 'R' : String(g));

export function fmtTime(sec) {
  const v = Math.max(0, sec || 0);
  const m = Math.floor(v / 60);
  const r = v - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}

export const fmtInt = (v) => Math.round(v).toLocaleString('en-US');
export const fmtG = (f) => `${Math.hypot(f.gLat, f.gLon).toFixed(1)} g`;

/**
 * RPM relative to the maximum. Zones are shared by all themes so shift lights
 * come on at the same moment whatever the look.
 */
export const ZONES = { amber: 0.8, red: 0.92, limit: 0.965 };

export function rpmInfo(f) {
  const max = f.maxRpm || 0;
  const frac = max ? clamp(f.rpm / max) : 0;
  return { max, frac, atLimit: max > 0 && f.rpm / max >= ZONES.limit };
}

/** Blinking at the limiter: ~6 Hz, off with prefers-reduced-motion. */
const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const blinkOn = () => reduceMotion || Math.floor(performance.now() / 85) % 2 === 0;

const loadedFonts = new Set();
/** Adds a Google Fonts font (once). Offline, the fallback from font-family is used. */
export function useFont(family) {
  if (loadedFonts.has(family)) return;
  loadedFonts.add(family);
  document.head.append(h('link', { rel: 'stylesheet', href: `https://fonts.googleapis.com/css2?family=${family}&display=swap` }));
}

const loadedStyles = new Set();
export function useStyle(id, css) {
  if (loadedStyles.has(id)) return;
  loadedStyles.add(id);
  document.head.append(h('style', { 'data-theme': id }, css));
}

/** A point on a circle; angle in degrees, 0 = top, clockwise. */
export function polar(cx, cy, r, deg) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
