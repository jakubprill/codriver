// R · Scarlet – a red Italian-style track display: a round tach with a red RPM sweep on the left
// and a white speed sweep on the right, a g-force plot and a speed trace of the last 30 seconds.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, fmtG, clamp, blinkOn, polar, ZONES } from '../lib/util.js';
import { arc, fillPath } from '../lib/gauge.js';
import { createStats } from '../lib/stats.js';

const C = { bg: '#0b0607', fg: '#f6f1f1', muted: '#8d7c7f', red: '#ff2436', deep: '#7a0a14', white: '#ffffff', line: '#3a2a2d' };

const CSS = `
.t-scarlet { position: absolute; inset: 0; color: ${C.fg}; font-family: 'Kanit', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums;
  background: linear-gradient(180deg, #120a0b 0, #1a0a0c 55%, ${C.deep} 100%); }
.t-scarlet svg { position: absolute; inset: 0; overflow: visible; }
.t-scarlet .spd { position: absolute; left: 640px; width: 320px; text-align: center; top: 320px; font-size: 96px; font-weight: 500; line-height: 1; }
.t-scarlet .spd small { display: block; font-size: 22px; color: ${C.muted}; }
.t-scarlet .gear { position: absolute; left: 700px; width: 200px; text-align: center; top: 460px; font-size: 64px; font-weight: 500; }
.t-scarlet .gear.shift { color: ${C.red}; }
.t-scarlet .k { position: absolute; font-size: 22px; color: ${C.muted}; letter-spacing: .08em; }
.t-scarlet .big { position: absolute; left: 1120px; top: 170px; font-size: 76px; font-weight: 400; }
.t-scarlet .box { position: absolute; bottom: 60px; font-size: 22px; color: ${C.muted}; text-align: center; }
.t-scarlet .box b { display: block; font-size: 34px; color: ${C.fg}; font-weight: 500; }
.t-scarlet .status { position: absolute; left: 0; right: 0; top: 30px; text-align: center; font-size: 24px; color: ${C.muted}; }
`;

const CX = 800, CY = 400, R = 210;
const RPM_A0 = 200, RPM_A1 = 345; // left side, from bottom up over the top
const SPD_A0 = 160, SPD_A1 = 15;  // right side, bottom up
const SPEED_MAX = 200;
const GX = 330, GY = 420, GR = 120; // g-force plot
const TX = 1110, TY = 330, TW = 340, TH = 170; // speed trace

export default {
  id: 'scarlet',
  name: 'Scarlet',
  description: 'Red track display: round tach with red and white sweeps, g-force plot, speed trace',
  create(stage) {
    useFont('Kanit:wght@400;500');
    useStyle('scarlet', CSS);
    const stats = createStats();

    const svg = s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, 'aria-hidden': 'true' });
    svg.append(
      s('path', { d: 'M90 700 Q 800 640 1510 700 M120 150 Q 800 40 1480 150', fill: 'none', stroke: C.line, 'stroke-width': 3 }),
      s('circle', { cx: CX, cy: CY, r: R + 30, fill: 'none', stroke: C.line, 'stroke-width': 2 }),
      s('path', { d: arc(CX, CY, R, RPM_A0, RPM_A1), fill: 'none', stroke: '#2a1416', 'stroke-width': 26 }));
    const rpmFill = fillPath(arc(CX, CY, R, RPM_A0, RPM_A1), { stroke: C.red, 'stroke-width': 26, style: `filter: drop-shadow(0 0 12px ${C.red})` });
    const spdFill = fillPath(arc(CX, CY, R, SPD_A0, SPD_A1), { stroke: C.white, 'stroke-width': 10, 'stroke-linecap': 'round' });
    const needle = s('line', { stroke: C.white, 'stroke-width': 4, 'stroke-linecap': 'round' });
    const scale = s('g', { 'font-size': 26, fill: C.fg, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    svg.append(s('path', { d: arc(CX, CY, R, SPD_A0, SPD_A1), fill: 'none', stroke: '#2a1416', 'stroke-width': 10 }), rpmFill, spdFill, needle, scale);
    let scaleMax = 0;
    const drawScale = (max) => {
      scaleMax = max;
      scale.replaceChildren();
      for (let k = 0; k * 1000 <= max; k++) {
        const [x, y] = polar(CX, CY, R - 46, RPM_A0 + ((RPM_A1 - RPM_A0) * k * 1000) / max);
        scale.append(s('text', { x, y }, String(k)));
      }
    };

    // g-force plot: rings and a dot with a short trail
    svg.append(s('circle', { cx: GX, cy: GY, r: GR, fill: 'none', stroke: C.line, 'stroke-width': 2 }),
      s('circle', { cx: GX, cy: GY, r: GR / 2, fill: 'none', stroke: C.line, 'stroke-width': 1.5 }),
      s('path', { d: `M${GX - GR} ${GY}H${GX + GR}M${GX} ${GY - GR}V${GY + GR}`, stroke: C.line, 'stroke-width': 1.5 }));
    const trail = s('polyline', { fill: 'none', stroke: C.red, 'stroke-width': 3, opacity: 0.5 });
    const dot = s('circle', { r: 12, fill: C.red, style: `filter: drop-shadow(0 0 10px ${C.red})` });
    // speed trace
    const trace = s('polyline', { fill: 'none', stroke: C.red, 'stroke-width': 4, 'stroke-linejoin': 'round', style: `filter: drop-shadow(0 0 6px ${C.red})` });
    const traceDot = s('circle', { r: 8, fill: C.white });
    svg.append(trail, dot, s('line', { x1: TX, y1: TY + TH, x2: TX + TW, y2: TY + TH, stroke: C.line, 'stroke-width': 2 }), trace, traceDot);

    const spdVal = h('span', {}, '0');
    const gear = h('div', { class: 'gear' }, 'N');
    const big = h('div', { class: 'big' }, '0:00.0');
    const gVal = h('div', { class: 'k', style: `left:${GX - 60}px;top:${GY + GR + 20}px;width:120px;text-align:center;color:#f6f1f1` }, '0.0 g');
    const box = (x, label) => {
      const v = h('b', {}, '–');
      root.append(h('div', { class: 'box', style: `left:${x}px;width:220px` }, v, label));
      return v;
    };
    const status = h('div', { class: 'status' });
    const root = h('div', { class: 't-scarlet' }, svg,
      h('div', { class: 'spd' }, spdVal, h('small', {}, 'km/h')), gear,
      h('div', { class: 'k', style: `left:${GX - 60}px;top:${GY - GR - 50}px;width:120px;text-align:center` }, 'g-force'), gVal,
      big, h('div', { class: 'k', style: 'left:1120px;top:140px' }, 'stage time'),
      h('div', { class: 'k', style: `left:${TX}px;top:${TY + TH + 14}px` }, 'speed, last 30 s'),
      status);
    stage.append(root);
    const dist = box(560, 'distance');
    const top = box(820, 'top speed');
    const trailPts = [];

    return {
      update(f) {
        status.textContent = '';
        const st = stats.update(f);
        const { max, frac, atLimit } = rpmInfo(f);
        if (max && max !== scaleMax) drawScale(max);
        rpmFill.set(frac);
        if (atLimit && !blinkOn()) rpmFill.style.opacity = '0.3';
        const sf = clamp(f.speedKmh / SPEED_MAX);
        spdFill.set(sf);
        const a = SPD_A0 + (SPD_A1 - SPD_A0) * sf;
        const [x0, y0] = polar(CX, CY, R - 40, a);
        const [x1, y1] = polar(CX, CY, R + 16, a);
        Object.entries({ x1: x0, y1: y0, x2: x1, y2: y1 }).forEach(([k, v]) => needle.setAttribute(k, v.toFixed(1)));
        spdVal.textContent = Math.round(f.speedKmh);
        gear.textContent = gearText(f.gear);
        gear.classList.toggle('shift', frac >= ZONES.red);
        big.textContent = fmtTime(f.lapTime);
        gVal.textContent = fmtG(f);
        // g plot: lateral right, braking up
        const px = GX + clamp(f.gLat / 2, -1, 1) * GR;
        const py = GY + clamp(f.gLon / 2, -1, 1) * GR;
        dot.setAttribute('cx', px.toFixed(1));
        dot.setAttribute('cy', py.toFixed(1));
        trailPts.push(`${px.toFixed(0)},${py.toFixed(0)}`);
        if (trailPts.length > 20) trailPts.shift();
        trail.setAttribute('points', trailPts.join(' '));
        // speed trace over the last 30 s, scaled to the top speed so far
        const hist = st.history;
        const vmax = Math.max(60, st.top);
        const t0 = f.lapTime - 30;
        const pts = hist.map((p) => `${(TX + ((p.t - t0) / 30) * TW).toFixed(0)},${(TY + TH - (p.v / vmax) * TH).toFixed(0)}`);
        trace.setAttribute('points', pts.join(' '));
        const last = pts[pts.length - 1]?.split(',');
        if (last) { traceDot.setAttribute('cx', last[0]); traceDot.setAttribute('cy', last[1]); }
        dist.textContent = `${fmtInt(f.lapDistance)} m`;
        top.textContent = `${Math.round(st.top)} km/h`;
      },
      idle(text) {
        status.textContent = text;
        rpmFill.set(0);
        spdFill.set(0);
        spdVal.textContent = '0';
        gear.textContent = 'N';
        gear.classList.remove('shift');
      },
    };
  },
};
