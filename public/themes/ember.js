// S · Ember – a supercar ring in molten orange: the band fills with the RPM under a white needle,
// digital speed in the middle, the gear in orange; stage data on the left, a pedal ring on the right.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, fmtG, clamp, blinkOn, polar, ZONES } from '../lib/util.js';
import { arc, sector, fillPath, ticks } from '../lib/gauge.js';
import { createStats } from '../lib/stats.js';

const C = { bg: '#050403', fg: '#f7f1ea', muted: '#86796b', orange: '#ff8a1c', hot: '#ffb347', red: '#ff3b1f', off: '#1a120b', line: '#4a3523', green: '#3ccf5a' };

const CSS = `
.t-ember { position: absolute; inset: 0; color: ${C.fg}; font-family: 'Audiowide', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums;
  background: radial-gradient(ellipse at 50% 50%, #140c06 0, ${C.bg} 60%); }
.t-ember svg { position: absolute; inset: 0; overflow: visible; }
.t-ember .spd { position: absolute; left: 600px; top: 330px; width: 400px; text-align: center; font-size: 120px; line-height: 1; }
.t-ember .unit { position: absolute; left: 600px; top: 455px; width: 400px; text-align: center; font-size: 20px; color: ${C.muted}; }
.t-ember .gear { position: absolute; left: 905px; top: 500px; font-size: 110px; color: ${C.orange}; line-height: 1; }
.t-ember .gear.shift { color: ${C.red}; }
.t-ember .list { position: absolute; left: 110px; top: 200px; width: 330px; font-family: 'Segoe UI', sans-serif; }
.t-ember .list h3 { margin: 0 0 18px; font-weight: 500; font-size: 28px; }
.t-ember .list div { display: flex; justify-content: space-between; font-size: 22px; color: ${C.muted}; padding: 10px 0; border-bottom: 1px solid ${C.line}; }
.t-ember .list b { color: ${C.fg}; font-size: 30px; font-weight: 500; }
.t-ember .pv { position: absolute; left: 1180px; top: 360px; width: 240px; text-align: center; font-family: 'Segoe UI', sans-serif; font-size: 26px; }
.t-ember .pv small { color: ${C.muted}; font-size: 18px; }
.t-ember .status { position: absolute; left: 0; right: 0; bottom: 30px; text-align: center; font-size: 22px; color: ${C.muted}; }
`;

const CX = 800, CY = 400, R0 = 190, R1 = 250, START = 210, SWEEP = 260;
const PX = 1300, PY = 390, PR = 110; // pedal ring

export default {
  id: 'ember',
  name: 'Ember',
  description: 'Supercar ring in molten orange with a white needle; stage data and a pedal ring',
  create(stage) {
    useFont('Audiowide');
    useStyle('ember', CSS);
    const stats = createStats();

    const band = s('path', { d: '', fill: 'url(#ember-band)', style: `filter: drop-shadow(0 0 18px rgba(255, 138, 28, .6))` });
    const needle = s('line', { stroke: C.fg, 'stroke-width': 7, 'stroke-linecap': 'round', style: 'filter: drop-shadow(0 0 6px #fff)' });
    const scale = s('g', { 'font-size': 40, fill: C.fg, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    const redTicks = s('path', { d: '', fill: 'none', stroke: C.red, 'stroke-width': 8 });
    let scaleMax = 0;
    const drawScale = (max) => {
      scaleMax = max;
      scale.replaceChildren();
      for (let k = 1; k * 1000 <= max; k++) {
        const t = (k * 1000) / max;
        const [x, y] = polar(CX, CY, R0 - 34, START + SWEEP * t);
        scale.append(s('text', { x, y, fill: t >= ZONES.red ? C.red : C.fg }, String(k)));
      }
      redTicks.setAttribute('d', arc(CX, CY, R1 + 14, START + SWEEP * ZONES.red, START + SWEEP));
    };
    const thr = fillPath(arc(PX, PY, PR, 200, 340), { stroke: C.green, 'stroke-width': 14 });
    const brk = fillPath(arc(PX, PY, PR, 160, 20), { stroke: C.hot, 'stroke-width': 14 });
    const gCells = Array.from({ length: 14 }, (_, i) => s('rect', { x: 1190 + i * 18, y: 560, width: 12, height: 22, fill: C.off }));

    stage.append(h('div', { class: 't-ember' },
      s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, 'aria-hidden': 'true' },
        s('defs', {}, s('radialGradient', { id: 'ember-band', gradientUnits: 'userSpaceOnUse', cx: CX, cy: CY, r: R1 },
          s('stop', { offset: R0 / R1, 'stop-color': C.orange }), s('stop', { offset: 1, 'stop-color': C.hot }))),
        s('path', { d: sector(CX, CY, R0, R1, START, START + SWEEP), fill: C.off }),
        band,
        ticks({ cx: CX, cy: CY, r: R1 + 26, len: 10, longLen: 30, from: START, to: START + SWEEP, step: SWEEP / 40, long: (i) => i % 5 === 0, stroke: C.fg }),
        redTicks, scale, needle,
        s('circle', { cx: CX, cy: CY, r: R0 - 70, fill: 'none', stroke: C.line, 'stroke-width': 2 }),
        s('path', { d: 'M440 190 Q 520 190 560 260 M440 560 Q 520 560 560 500 M1160 190 Q 1080 190 1040 260 M1160 600 Q 1080 600 1040 520', fill: 'none', stroke: C.line, 'stroke-width': 3 }),
        s('path', { d: arc(PX, PY, PR, 200, 340), fill: 'none', stroke: C.off, 'stroke-width': 14 }),
        s('path', { d: arc(PX, PY, PR, 160, 20), fill: 'none', stroke: C.off, 'stroke-width': 14 }),
        thr, brk, ...gCells)));
    const root = stage.lastChild;

    const spd = h('div', { class: 'spd' }, '0');
    const gear = h('div', { class: 'gear' }, 'N');
    const row = (label) => {
      const v = h('b', {}, '–');
      return { el: h('div', {}, h('span', {}, label), v), v };
    };
    const R = { dist: row('distance'), time: row('stage time'), avg: row('average'), top: row('top speed') };
    const pv = h('div', { class: 'pv' }, h('span', {}, '0 / 0'), h('br'), h('small', {}, 'throttle / brake %'));
    const gl = h('div', { class: 'pv', style: 'top:590px;font-size:20px' }, '0.0 g');
    const status = h('div', { class: 'status' });
    root.append(spd, h('div', { class: 'unit' }, 'km/h'), gear,
      h('div', { class: 'list' }, h('h3', {}, 'Stage'), ...Object.values(R).map((r) => r.el)),
      pv, gl, status);

    return {
      update(f) {
        status.textContent = '';
        const st = stats.update(f);
        const { max, frac, atLimit } = rpmInfo(f);
        if (max && max !== scaleMax) drawScale(max);
        const a = START + SWEEP * Math.max(frac, 0.003);
        band.setAttribute('d', sector(CX, CY, R0, R1, START, a));
        band.style.opacity = atLimit && !blinkOn() ? 0.3 : 1;
        const [x0, y0] = polar(CX, CY, R0 - 10, a);
        const [x1, y1] = polar(CX, CY, R1 + 30, a);
        Object.entries({ x1: x0, y1: y0, x2: x1, y2: y1 }).forEach(([k, v]) => needle.setAttribute(k, v.toFixed(1)));
        needle.style.opacity = 1;
        spd.textContent = Math.round(f.speedKmh);
        gear.textContent = gearText(f.gear);
        gear.classList.toggle('shift', frac >= ZONES.red);
        R.dist.v.textContent = `${fmtInt(f.lapDistance)} m`;
        R.time.v.textContent = fmtTime(f.lapTime);
        R.avg.v.textContent = `${Math.round(st.avg)} km/h`;
        R.top.v.textContent = `${Math.round(st.top)} km/h`;
        thr.set(f.throttle);
        brk.set(f.brake);
        pv.firstChild.textContent = `${Math.round(clamp(f.throttle) * 100)} / ${Math.round(clamp(f.brake) * 100)}`;
        const g = Math.hypot(f.gLat, f.gLon);
        const ng = Math.round(clamp(g / 2) * gCells.length);
        gCells.forEach((c, i) => c.setAttribute('fill', i < ng ? C.green : C.off));
        gl.textContent = `g-force ${fmtG(f)}`;
      },
      idle(text) {
        status.textContent = text;
        band.setAttribute('d', '');
        needle.style.opacity = 0;
        thr.set(0);
        brk.set(0);
        spd.textContent = '0';
        gear.textContent = 'N';
        gear.classList.remove('shift');
      },
    };
  },
};
