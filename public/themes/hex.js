// J · Hex – a race display in a hexagonal frame: a huge gear inside a white RPM arc with a shift
// marker, pedal bars on the left, the stage clock and records on the right.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, fmtG, clamp, blinkOn, polar, ZONES } from '../lib/util.js';
import { arc, fillPath } from '../lib/gauge.js';
import { createStats } from '../lib/stats.js';

const C = { bg: '#020203', panel: '#0d0c10', edge: '#2a2730', fg: '#f4f2f7', muted: '#77727f', red: '#ff2d4a' };

const CSS = `
.t-hex { position: absolute; inset: 0; background: ${C.bg}; color: ${C.fg}; font-family: 'Orbitron', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums; }
.t-hex svg { position: absolute; inset: 0; overflow: visible; }
.t-hex .gear { position: absolute; left: 600px; top: 230px; width: 400px; text-align: center; font-size: 300px; font-weight: 900; line-height: 1; }
.t-hex .gear.shift { color: ${C.red}; }
.t-hex .k { position: absolute; font-size: 20px; color: ${C.muted}; letter-spacing: .04em; }
.t-hex .v { position: absolute; font-size: 54px; font-weight: 700; }
.t-hex .v.small { font-size: 38px; }
.t-hex .v.red { color: ${C.red}; font-size: 40px; }
.t-hex .bar { position: absolute; height: 6px; background: #1d1b22; }
.t-hex .bar i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--c); }
.t-hex .bar b { position: absolute; right: 0; top: -30px; font-size: 20px; font-weight: 500; color: ${C.muted}; }
.t-hex .status { position: absolute; left: 0; right: 0; bottom: 40px; text-align: center; font-size: 24px; color: ${C.muted}; }
`;

const CX = 800, CY = 400, R = 230, START = 225, SWEEP = 250;

export default {
  id: 'hex',
  name: 'Hex',
  description: 'Race display in a hexagon: a huge gear in a white RPM arc, records on the right',
  create(stage) {
    useFont('Orbitron:wght@500;700;900');
    useStyle('hex', CSS);
    const stats = createStats();

    const white = fillPath(arc(CX, CY, R, START, START + SWEEP * ZONES.red), { stroke: C.fg, 'stroke-width': 22 });
    const red = fillPath(arc(CX, CY, R, START + SWEEP * ZONES.red, START + SWEEP), { stroke: C.red, 'stroke-width': 8 });
    const [mx, my] = polar(CX, CY, R, START + SWEEP + 8);
    const marker = s('circle', { cx: mx, cy: my, r: 14, fill: 'none', stroke: C.red, 'stroke-width': 4 });
    const hexagon = '230,140 1370,140 1530,400 1370,660 230,660 70,400';

    stage.append(h('div', { class: 't-hex' },
      s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, 'aria-hidden': 'true' },
        s('polygon', { points: hexagon, fill: C.panel, stroke: C.edge, 'stroke-width': 3 }),
        s('path', { d: arc(CX, CY, R, START, START + SWEEP), fill: 'none', stroke: '#18161c', 'stroke-width': 22 }),
        white, red, marker,
        s('text', { x: mx - 20, y: my + 46, 'font-size': 20, fill: C.muted }, 'shift'),
        s('path', { d: 'M150 370 L120 400 L150 430', fill: 'none', stroke: C.red, 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))));
    const root = stage.lastChild;

    const at = (x, y, cls, text) => h('div', { class: cls, style: `left:${x}px;top:${y}px` }, text);
    const gear = h('div', { class: 'gear' }, 'N');
    const spd = at(250, 220, 'v', '0');
    const rpm = at(420, 228, 'v small', '0');
    const time = at(1110, 200, 'v', '0:00.0');
    const top = at(1110, 320, 'v red', '0');
    const sprint = at(1110, 420, 'v red', '–');
    const g = at(1110, 520, 'v', '0.0 g');
    const bar = (x, y, w, label, color) => {
      const fillEl = h('i', { style: `--c:${color};width:0` });
      const val = h('b', {}, '0%');
      root.append(h('div', { class: 'bar', style: `left:${x}px;top:${y}px;width:${w}px` }, fillEl, val), at(x, y - 30, 'k', label));
      return (v) => { fillEl.style.width = `${clamp(v) * 100}%`; val.textContent = `${Math.round(clamp(v) * 100)}%`; };
    };
    const status = h('div', { class: 'status' });
    root.append(gear,
      at(250, 196, 'k', 'km/h'), spd, at(420, 196, 'k', 'rpm'), rpm,
      at(1110, 176, 'k', 'stage time'), time,
      at(1110, 296, 'k', 'top speed, km/h'), top,
      at(1110, 396, 'k', '0–100 km/h'), sprint,
      at(1110, 496, 'k', 'g-force'), g,
      status);
    const thr = bar(250, 360, 280, 'throttle', C.fg);
    const brk = bar(250, 440, 280, 'brake', C.red);
    const clu = bar(250, 520, 280, 'clutch', C.muted);

    return {
      update(f) {
        status.textContent = '';
        const st = stats.update(f);
        const { frac, atLimit } = rpmInfo(f);
        white.set(frac / ZONES.red);
        red.set((frac - ZONES.red) / (1 - ZONES.red));
        const shift = frac >= ZONES.red;
        marker.setAttribute('fill', shift && (!atLimit || blinkOn()) ? C.red : 'none');
        gear.classList.toggle('shift', shift);
        gear.textContent = gearText(f.gear);
        spd.textContent = Math.round(f.speedKmh);
        rpm.textContent = fmtInt(Math.round(f.rpm / 50) * 50);
        time.textContent = fmtTime(f.lapTime);
        top.textContent = Math.round(st.top);
        sprint.textContent = st.sprint ? `${st.sprint.toFixed(2)} s` : '–';
        g.textContent = fmtG(f);
        thr(f.throttle);
        brk(f.brake);
        clu(f.clutch);
      },
      idle(text) {
        status.textContent = text;
        white.set(0);
        red.set(0);
        marker.setAttribute('fill', 'none');
        gear.classList.remove('shift');
        gear.textContent = 'N';
        spd.textContent = '0';
        thr(0);
        brk(0);
        clu(0);
      },
    };
  },
};
