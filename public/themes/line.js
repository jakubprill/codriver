// Y · Line – a supercar track screen: one thin line climbs from bottom left and runs flat along
// the top, the RPM fills under it as a dot grid; huge outlined speed, a gear capsule on the left,
// readouts stacked on the right.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, fmtG, clamp, blinkOn, ZONES } from '../lib/util.js';
import { createStats } from '../lib/stats.js';

const C = { bg: '#000', fg: '#f4f4f4', muted: '#7a7a7a', line: '#d9d9d9', dots: '#bdbdbd', red: '#ff3324', amber: '#e7b440' };

const CSS = `
.t-line { position: absolute; inset: 0; background: ${C.bg}; color: ${C.fg}; font-family: 'Chakra Petch', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums; }
.t-line svg { position: absolute; inset: 0; overflow: visible; }
.t-line .spd { position: absolute; left: 560px; top: 330px; width: 480px; text-align: center; font-size: 230px; font-weight: 700; line-height: 1;
  color: transparent; -webkit-text-stroke: 7px ${C.fg}; letter-spacing: .02em; }
.t-line .unit { position: absolute; left: 560px; top: 290px; width: 480px; text-align: center; font-size: 34px; color: ${C.muted}; letter-spacing: .1em; }
.t-line .cap { position: absolute; left: 330px; top: 520px; width: 92px; height: 112px; border-radius: 16px; display: grid; place-items: center;
  font-size: 80px; font-weight: 700; background: #1d1d1d; border: 3px solid #555; }
.t-line .cap.shift { background: ${C.red}; border-color: ${C.red}; color: #000; }
.t-line .pedals { position: absolute; left: 110px; top: 680px; font-size: 32px; letter-spacing: .3em; color: #444; }
.t-line .pedals b { color: ${C.fg}; }
.t-line .rpm { position: absolute; right: 90px; top: 200px; text-align: right; font-size: 64px; font-weight: 600; line-height: 1; }
.t-line .rpm small { display: block; font-size: 24px; color: ${C.muted}; letter-spacing: .1em; }
.t-line .list { position: absolute; right: 90px; top: 330px; font-size: 36px; text-align: right; line-height: 1.45; }
.t-line .list span { color: ${C.muted}; font-size: 22px; margin-left: 10px; }
.t-line .status { position: absolute; left: 0; right: 0; bottom: 30px; text-align: center; font-size: 24px; color: ${C.muted}; }
`;

// the line: up from bottom left, a smooth knee, then flat along the top to the right
const PATH_PTS = 80;
const lineAt = (t) => {
  const x = 120 + 1220 * t;
  const knee = 1 / (1 + Math.exp(-14 * (t - 0.22))); // rises fast early, then flattens
  return [x, 560 - 400 * knee];
};
const TOP_Y = 120; // the dot grid fills from the line up to here (or down to the line where it is lower)

export default {
  id: 'line',
  name: 'Line',
  description: 'Supercar track screen: one line climbs and runs flat, a dot grid fills under it',
  create(stage) {
    useFont('Chakra+Petch:wght@500;600;700');
    useStyle('line', CSS);
    const stats = createStats();

    const pts = Array.from({ length: PATH_PTS + 1 }, (_, i) => lineAt(i / PATH_PTS));
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
    // the fill: the area between the top edge and the line, clipped to the lit part
    const area = `${d}L${pts[PATH_PTS][0]} ${TOP_Y}L${pts[0][0]} ${TOP_Y}Z`;
    const clip = s('rect', { x: 0, y: 0, width: 0, height: 800 });
    const marker = s('line', { y1: TOP_Y, stroke: C.fg, 'stroke-width': 8 });
    const scale = s('g', { 'font-size': 40, fill: C.fg, 'text-anchor': 'middle' });
    const svg = s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, 'aria-hidden': 'true' },
      s('defs', {},
        s('pattern', { id: 'line-dots', width: 9, height: 9, patternUnits: 'userSpaceOnUse' }, s('rect', { x: 1, y: 1, width: 6, height: 6, fill: C.dots })),
        s('clipPath', { id: 'line-clip' }, clip)),
      s('path', { d: area, fill: 'url(#line-dots)', 'clip-path': 'url(#line-clip)', opacity: 0.85 }),
      s('path', { d, fill: 'none', stroke: C.line, 'stroke-width': 4 }),
      s('line', { x1: pts[0][0], y1: TOP_Y, x2: pts[PATH_PTS][0], y2: TOP_Y, stroke: '#2a2a2a', 'stroke-width': 3 }),
      marker, scale,
      s('path', { d: 'M440 576 H555', stroke: C.muted, 'stroke-width': 3, 'stroke-dasharray': '3 6' }));
    let scaleMax = 0;
    const drawScale = (max) => {
      scaleMax = max;
      scale.replaceChildren();
      for (let k = 1; k * 1000 <= max; k++) {
        const t = (k * 1000) / max;
        const [x, y] = lineAt(t);
        scale.append(s('text', { x: x + 10, y: y + 52, fill: t >= ZONES.red ? C.red : C.fg }, String(k)));
      }
    };

    const spd = h('div', { class: 'spd' }, '0');
    const cap = h('div', { class: 'cap' }, 'N');
    const pedals = h('div', { class: 'pedals' });
    const P = { t: h('span', {}, 'T'), b: h('span', {}, 'B'), c: h('span', {}, 'C') };
    pedals.append(P.t, P.b, P.c);
    const rpm = h('div', { class: 'rpm' }, '0', h('small', {}, 'rpm'));
    const row = (unit) => {
      const v = h('b', {}, '–');
      return { el: h('div', {}, v, h('span', {}, unit)), v };
    };
    const L = { time: row('stage'), dist: row('m'), top: row('top km/h'), g: row('g') };
    const status = h('div', { class: 'status' });
    stage.append(h('div', { class: 't-line' }, svg, h('div', { class: 'unit' }, 'km/h'), spd, cap, pedals, rpm,
      h('div', { class: 'list' }, ...Object.values(L).map((r) => r.el)), status));

    return {
      update(f) {
        status.textContent = '';
        const st = stats.update(f);
        const { max, frac, atLimit } = rpmInfo(f);
        if (max && max !== scaleMax) drawScale(max);
        const [x] = lineAt(frac);
        const off = atLimit && !blinkOn();
        clip.setAttribute('width', off ? 0 : x.toFixed(1));
        const [, y] = lineAt(frac);
        marker.setAttribute('x1', x.toFixed(1));
        marker.setAttribute('x2', x.toFixed(1));
        marker.setAttribute('y2', y.toFixed(1));
        marker.setAttribute('stroke', frac >= ZONES.red ? C.red : C.fg);
        spd.textContent = Math.round(f.speedKmh);
        cap.textContent = gearText(f.gear);
        cap.classList.toggle('shift', frac >= ZONES.red);
        P.t.innerHTML = f.throttle > 0.05 ? '<b>T</b>' : 'T';
        P.b.innerHTML = f.brake > 0.05 ? '<b>B</b>' : 'B';
        P.c.innerHTML = f.clutch > 0.05 ? '<b>C</b>' : 'C';
        rpm.firstChild.textContent = Math.round(f.rpm / 10) * 10;
        L.time.v.textContent = fmtTime(f.lapTime);
        L.dist.v.textContent = fmtInt(f.lapDistance);
        L.top.v.textContent = Math.round(st.top);
        L.g.v.textContent = fmtG(f).replace(' g', '');
      },
      idle(text) {
        status.textContent = text;
        clip.setAttribute('width', 0);
        marker.setAttribute('x2', marker.getAttribute('x1') ?? 0);
        spd.textContent = '0';
        cap.textContent = 'N';
        cap.classList.remove('shift');
      },
    };
  },
};
