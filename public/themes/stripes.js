// AH · Stripes – neon orange stripes sweep round a rounded corner and light up one by one with the
// RPM; the stage clock is the hero, big in the middle, with speed and gear beneath.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtInt, fmtG, blinkOn, ZONES } from '../lib/util.js';

const C = { bg: '#050302', fg: '#f7f2ec', muted: '#7a6a5a', orange: '#ff6a10', amber: '#ffa21a', off: '#2a1206', red: '#ff2a1a', dot: '#1a120c' };

const CSS = `
.t-stripes { position: absolute; inset: 0; background: ${C.bg}; color: ${C.fg}; font-family: 'Rajdhani', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums; }
.t-stripes svg { position: absolute; inset: 0; overflow: visible; }
.t-stripes .clock { position: absolute; left: 110px; top: 510px; font-size: 150px; font-weight: 500; line-height: 1; letter-spacing: .02em; }
.t-stripes .row { position: absolute; left: 120px; top: 670px; display: flex; gap: 70px; font-size: 24px; color: ${C.muted}; letter-spacing: .12em; }
.t-stripes .row b { display: block; font-size: 44px; color: ${C.fg}; letter-spacing: 0; font-weight: 600; line-height: 1.1; }
.t-stripes .row .shift b { color: ${C.red}; }
.t-stripes .status { position: absolute; left: 0; right: 0; top: 30px; text-align: center; font-size: 22px; color: ${C.muted}; }
`;

const N = 12;
// stripe k: comes in flat from the left, turns up through a rounded corner on the right
const stripe = (k) => {
  const off = k * 26;
  const y = 190 + off, x = 1100 + off, r = 140 + off * 0.4;
  return `M${700 - off * 2} ${y} H${x - r} Q${x} ${y} ${x} ${y - r} V${30 - off * 0.3}`;
};

export default {
  id: 'stripes',
  name: 'Stripes',
  description: 'Neon orange stripes light up one by one round a corner; the stage clock is the hero',
  create(stage) {
    useFont('Rajdhani:wght@500;600');
    useStyle('stripes', CSS);

    const svg = s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, 'aria-hidden': 'true' },
      s('defs', {}, s('pattern', { id: 'stripes-dots', width: 18, height: 18, patternUnits: 'userSpaceOnUse' }, s('circle', { cx: 9, cy: 9, r: 2, fill: C.dot }))),
      s('rect', { x: 0, y: 0, width: 1600, height: 800, fill: 'url(#stripes-dots)' }));
    const lines = Array.from({ length: N }, (_, k) => {
      const p = s('path', { d: stripe(k), fill: 'none', stroke: C.off, 'stroke-width': 14, 'stroke-linecap': 'round' });
      svg.append(p);
      return p;
    });
    // the base line under the clock, glowing

    const clock = h('div', { class: 'clock' }, '00:00.00');
    const spd = h('b', {}, '0');
    const gear = h('b', {}, 'N');
    const gearBox = h('span', {}, 'gear', gear);
    const dist = h('b', {}, '0');
    const g = h('b', {}, '0.0');
    const status = h('div', { class: 'status' });
    stage.append(h('div', { class: 't-stripes' }, svg, clock,
      h('div', { class: 'row' }, h('span', {}, 'km/h', spd), gearBox, h('span', {}, 'metres', dist), h('span', {}, 'g', g)),
      status));

    const fmtClock = (t) => {
      const m = Math.floor(t / 60);
      const sec = t - m * 60;
      return `${String(m).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}`;
    };

    let lit = -1;
    return {
      update(f) {
        status.textContent = '';
        const { frac, atLimit } = rpmInfo(f);
        const n = atLimit && !blinkOn() ? 0 : Math.round(frac * N);
        if (n !== lit) {
          lit = n;
          lines.forEach((p, k) => {
            const on = k < n;
            p.setAttribute('stroke', on ? (k / N >= ZONES.red ? C.red : k % 2 ? C.amber : C.orange) : C.off);
            p.style.filter = on ? `drop-shadow(0 0 10px ${C.orange})` : '';
          });
        }
        clock.textContent = fmtClock(f.lapTime);
        spd.textContent = Math.round(f.speedKmh);
        gear.textContent = gearText(f.gear);
        gearBox.classList.toggle('shift', frac >= ZONES.red);
        dist.textContent = fmtInt(f.lapDistance);
        g.textContent = fmtG(f).replace(' g', '');
      },
      idle(text) {
        status.textContent = text;
        lit = -1;
        lines.forEach((p) => { p.setAttribute('stroke', C.off); p.style.filter = ''; });
        clock.textContent = '00:00.00';
        spd.textContent = '0';
        gear.textContent = 'N';
      },
    };
  },
};
