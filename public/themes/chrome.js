// AE · Chrome – a silver sports dial: a bright white band carries the RPM numbers round the top,
// a red window in the middle holds gear and speed, slatted pedal gauges sit inside and outside.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, clamp, blinkOn, polar, ZONES } from '../lib/util.js';
import { arc, sector, fillPath } from '../lib/gauge.js';
import { createStats } from '../lib/stats.js';

const C = { bg: '#000', fg: '#fafafa', ink: '#111', muted: '#8a8a8a', band: '#e9e9ea', bandShade: '#9a9a9c', red: '#c8141e', deep: '#3a0306', needle: '#ff2a2a' };

const CSS = `
.t-chrome { position: absolute; inset: 0; background: ${C.bg}; color: ${C.fg}; font-family: 'Russo One', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums; }
.t-chrome svg { position: absolute; inset: 0; overflow: visible; }
.t-chrome .gear { position: absolute; left: 700px; top: 215px; width: 200px; text-align: center; font-size: 90px; line-height: 1; }
.t-chrome .gear.shift { color: #ff4a4a; }
.t-chrome .spd { position: absolute; left: 600px; top: 310px; width: 400px; text-align: center; font-size: 110px; line-height: 1; }
.t-chrome .spd small { font-size: 26px; margin-left: 6px; }
.t-chrome .odo { position: absolute; top: 640px; padding: 6px 14px; font-size: 32px; letter-spacing: .12em; color: ${C.fg}; background: #1a1a1a; border: 2px solid #444; }
.t-chrome .k { position: absolute; font-size: 22px; color: ${C.muted}; }
.t-chrome .msg { position: absolute; left: 0; right: 0; top: 740px; text-align: center; font-size: 26px; font-style: italic; color: ${C.fg}; }
`;

const CX = 800, CY = 420, R = 330, A0 = 235, A1 = 485;

export default {
  id: 'chrome',
  name: 'Chrome',
  description: 'Silver sports dial: a white band with the RPM numbers, a red window for gear and speed',
  create(stage) {
    useFont('Russo+One');
    useStyle('chrome', CSS);
    const stats = createStats();

    const svg = s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, 'aria-hidden': 'true' },
      s('defs', {},
        s('linearGradient', { id: 'chrome-band', x1: 0, y1: 0, x2: 0, y2: 1 },
          s('stop', { offset: 0, 'stop-color': C.band }), s('stop', { offset: 0.7, 'stop-color': C.band }), s('stop', { offset: 1, 'stop-color': C.bandShade })),
        s('radialGradient', { id: 'chrome-red', cx: 0.5, cy: 0.35 }, s('stop', { offset: 0, 'stop-color': C.red }), s('stop', { offset: 1, 'stop-color': C.deep }))));
    svg.append(
      s('path', { d: sector(CX, CY, R - 70, R, A0, A1), fill: 'url(#chrome-band)' }),
      s('path', { d: sector(CX, CY, R - 72, R - 66, A0, A1), fill: '#555' }),
      s('path', { d: `M${CX - 240} ${CY + 60} L${CX - 150} ${CY + 170} H${CX + 150} L${CX + 240} ${CY + 60} V${CY - 120} Q${CX} ${CY - 330} ${CX - 240} ${CY - 120} Z`, fill: 'url(#chrome-red)', stroke: '#777', 'stroke-width': 3 }));
    // RPM: numbers printed on the band, a red tick that travels round its inner edge
    const nums = s('g', { 'font-size': 46, fill: C.ink, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    const progress = fillPath(arc(CX, CY, R + 14, A0, A1), { stroke: C.needle, 'stroke-width': 10 });
    const needle = s('path', { d: '', fill: C.needle });
    svg.append(nums, progress, needle);
    let scaleMax = 0;
    const drawScale = (max) => {
      scaleMax = max;
      nums.replaceChildren();
      for (let k = 1; k * 1000 <= max; k++) {
        const t = (k * 1000) / max;
        const [x, y] = polar(CX, CY, R - 36, A0 + (A1 - A0) * t);
        nums.append(s('text', { x, y, fill: t >= ZONES.red ? C.red : C.ink }, String(k)));
      }
    };
    // slatted pedal gauges inside the red window, and outside on the flanks
    const slats = (x, y, dir) => {
      const list = Array.from({ length: 8 }, (_, i) => s('rect', { x: dir > 0 ? x : x - 110 + i * 6, y: y - i * 16, width: 110 - i * 6, height: 10, fill: '#5a1015' }));
      svg.append(...list);
      return (v) => list.forEach((r, i) => r.setAttribute('fill', i < Math.round(clamp(v) * list.length) ? C.fg : '#5a1015'));
    };
    const thr = slats(CX - 210, CY + 150, 1);
    const brk = slats(CX + 210, CY + 150, -1);
    const side = (x0, dir) => {
      const list = Array.from({ length: 10 }, (_, i) => s('rect', { x: x0 + dir * i * 10 - (dir < 0 ? 70 : 0), y: 360 - i * 26, width: 70, height: 14, fill: '#262626' }));
      svg.append(...list);
      return (v) => list.forEach((r, i) => r.setAttribute('fill', i < Math.round(clamp(v) * list.length) ? (i > 7 ? C.needle : C.fg) : '#262626'));
    };
    const spdSide = side(200, -1);
    const gSide = side(1400, 1);

    const gear = h('div', { class: 'gear' }, 'N');
    const spd = h('div', { class: 'spd' }, h('span', {}, '0'), h('small', {}, 'km/h'));
    const odoL = h('div', { class: 'odo', style: 'left:110px' }, '000000');
    const odoR = h('div', { class: 'odo', style: 'right:110px' }, '0:00.0');
    const msg = h('div', { class: 'msg' }, '');
    stage.append(h('div', { class: 't-chrome' }, svg, gear, spd, odoL, odoR, msg,
      h('div', { class: 'k', style: 'left:110px;top:610px' }, 'm'),
      h('div', { class: 'k', style: 'right:110px;top:610px' }, 'stage time'),
      h('div', { class: 'k', style: 'left:570px;top:600px' }, 'thr.'),
      h('div', { class: 'k', style: 'left:990px;top:600px' }, 'brk.'),
      h('div', { class: 'k', style: 'left:60px;top:400px' }, 'speed'),
      h('div', { class: 'k', style: 'left:1440px;top:400px' }, 'g-force')));

    return {
      update(f) {
        const st = stats.update(f);
        const { max, frac, atLimit } = rpmInfo(f);
        if (max && max !== scaleMax) drawScale(max);
        progress.set(atLimit && !blinkOn() ? 0 : frac);
        const a = A0 + (A1 - A0) * frac;
        const [x0, y0] = polar(CX, CY, R + 4, a - 1.2);
        const [x1, y1] = polar(CX, CY, R + 4, a + 1.2);
        const [x2, y2] = polar(CX, CY, R - 80, a);
        needle.setAttribute('d', `M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}Z`);
        gear.textContent = gearText(f.gear);
        gear.classList.toggle('shift', frac >= ZONES.red);
        spd.firstChild.textContent = Math.round(f.speedKmh);
        thr(f.throttle);
        brk(f.brake);
        spdSide(f.speedKmh / 200);
        gSide(Math.hypot(f.gLat, f.gLon) / 2);
        odoL.textContent = String(Math.round(f.lapDistance)).padStart(6, '0');
        odoR.textContent = fmtTime(f.lapTime);
        msg.textContent = st.sprint ? `0–100 km/h in ${st.sprint.toFixed(2)} s · top ${Math.round(st.top)} km/h` : '';
      },
      idle(text) {
        msg.textContent = text;
        progress.set(0);
        needle.setAttribute('d', '');
        thr(0);
        brk(0);
        spdSide(0);
        gSide(0);
        spd.firstChild.textContent = '0';
        gear.textContent = 'N';
      },
    };
  },
};
