// G · Halo – a supercar-style ring: an ice-blue lit band sweeps the dial with the RPM,
// the speed sits digital in the middle, throttle and brake hug the ring on both sides.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, fmtG, clamp, blinkOn, polar, ZONES } from '../lib/util.js';

const C = {
  bg: '#04060c', bezel: '#1d2433', bezelHi: '#5a6a86', track: '#0d1626', band: '#cfe7ff', bandGlow: 'rgba(150, 205, 255, .55)',
  amber: '#ffc04a', red: '#ff4b3a', fg: '#eaf2ff', muted: '#7d8ba3', thr: '#5ef0c0', brk: '#ff5a4a',
};

const CSS = `
.t-halo { position: absolute; inset: 0; color: ${C.fg}; font-family: 'Saira', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums;
  background: radial-gradient(circle at 50% 50%, #0d1424 0, ${C.bg} 62%); }
.t-halo svg { position: absolute; left: 380px; top: -20px; overflow: visible; }
.t-halo .lit { filter: drop-shadow(0 0 14px ${C.bandGlow}); transition: stroke .15s; }
.t-halo .spd { position: absolute; left: 600px; top: 286px; width: 400px; text-align: center; font-size: 176px; font-weight: 600; line-height: 1; letter-spacing: -0.02em; }
.t-halo .unit { position: absolute; left: 600px; top: 464px; width: 400px; text-align: center; font-size: 28px; color: ${C.muted}; letter-spacing: .12em; }
.t-halo .gear { position: absolute; left: 752px; top: 176px; width: 96px; height: 104px; border: 2px solid ${C.bezelHi}; border-radius: 14px;
  display: grid; place-items: center; font-size: 80px; font-weight: 700; background: rgba(10, 18, 32, .85); }
.t-halo .gear.shift { color: ${C.bg}; background: ${C.red}; border-color: ${C.red}; }
.t-halo .time { position: absolute; left: 600px; top: 524px; width: 400px; text-align: center; font-size: 44px; font-weight: 500; }
.t-halo .info { position: absolute; top: 110px; font-size: 24px; color: ${C.muted}; letter-spacing: .06em; line-height: 1.5; }
.t-halo .info b { display: block; font-size: 48px; font-weight: 500; color: ${C.fg}; letter-spacing: 0; }
.t-halo .side { position: absolute; bottom: 70px; font-size: 22px; color: ${C.muted}; letter-spacing: .1em; }
.t-halo .status { position: absolute; left: 0; right: 0; top: 24px; text-align: center; font-size: 26px; color: ${C.muted}; }
`;

const CX = 420;
const CY = 420;
const R_BAND = 300;
const W_BAND = 64;
const CIRC = 2 * Math.PI * R_BAND;
const SWEEP = 270;
const ARC = (CIRC * SWEEP) / 360;
const START = 225; // polar(): 0 = top, clockwise; the scale runs from bottom-left over the top to bottom-right

const arc = (r, a0, a1) => {
  const [x0, y0] = polar(CX, CY, r, a0);
  const [x1, y1] = polar(CX, CY, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
};

export default {
  id: 'halo',
  name: 'Halo',
  description: 'Supercar ring: a lit band sweeps the dial, the speed digital in the middle',
  create(stage) {
    useFont('Saira:wght@400;500;600;700');
    useStyle('halo', CSS);

    // the band is a circle stroke: dash = lit part, rotated so it starts at the bottom left
    const ring = (stroke, extra = {}) => s('circle', { cx: CX, cy: CY, r: R_BAND, fill: 'none', stroke, 'stroke-width': W_BAND,
      'stroke-dasharray': `${ARC} ${CIRC}`, transform: `rotate(${START - 90 + 0} ${CX} ${CY})`, ...extra });
    const band = ring(C.band, { class: 'lit', 'stroke-dasharray': `0 ${CIRC}` });

    // ticks over the band: one per 1000 RPM once the maximum is known, small ones between
    const ticks = s('g', {});
    const labels = s('g', { 'font-size': 30, 'font-weight': 500, fill: C.muted, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    let tickMax = 0;
    const drawTicks = (max) => {
      tickMax = max;
      ticks.replaceChildren();
      labels.replaceChildren();
      const thousands = Math.max(1, Math.floor(max / 1000));
      for (let k = 0; k <= thousands * 2; k++) {
        const a = START + (SWEEP * (k * 500)) / max;
        if (a > START + SWEEP + 0.1) break;
        const major = k % 2 === 0;
        const [x0, y0] = polar(CX, CY, R_BAND - W_BAND / 2, a);
        const [x1, y1] = polar(CX, CY, R_BAND - W_BAND / 2 + (major ? 26 : 14), a);
        ticks.append(s('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: '#0a1220', 'stroke-width': major ? 6 : 3, 'stroke-linecap': 'round' }));
        if (major) {
          const [lx, ly] = polar(CX, CY, R_BAND + W_BAND / 2 + 28, a);
          labels.append(s('text', { x: lx, y: ly }, String(k / 2)));
        }
      }
      // red zone marked on the outer edge of the band
      redZone.setAttribute('d', arc(R_BAND + W_BAND / 2 + 6, START + SWEEP * ZONES.red, START + SWEEP));
    };
    const redZone = s('path', { d: '', fill: 'none', stroke: C.red, 'stroke-width': 6, 'stroke-linecap': 'round' });

    // throttle (left) and brake (right): arcs outside the bezel, filling from the bottom up
    const SIDE_R = 400;
    const side = (a0, a1, color) => {
      const d = arc(SIDE_R, a0, a1);
      const track = s('path', { d, fill: 'none', stroke: C.track, 'stroke-width': 14, 'stroke-linecap': 'round' });
      const fill = s('path', { d, fill: 'none', stroke: color, 'stroke-width': 14, 'stroke-linecap': 'round', pathLength: 100, 'stroke-dasharray': '0 100',
        style: `filter: drop-shadow(0 0 8px ${color})` });
      return { track, fill };
    };
    // a round cap would still draw a dot at 0 %, so an empty arc is hidden
    const fillTo = (path, v) => {
      path.setAttribute('stroke-dasharray', `${(clamp(v) * 100).toFixed(1)} 100`);
      path.style.opacity = v > 0.005 ? 1 : 0;
    };
    const thr = side(215, 320, C.thr);
    const brk = side(145, 40, C.brk);

    const svg = s('svg', { width: 840, height: 840, viewBox: '0 0 840 840', 'aria-hidden': 'true' },
      // bezel: two thin rings with a highlight on the top
      s('defs', {}, s('linearGradient', { id: 'halo-bezel', x1: 0, y1: 0, x2: 0, y2: 1 },
        s('stop', { offset: 0, 'stop-color': C.bezelHi }), s('stop', { offset: 0.5, 'stop-color': C.bezel }), s('stop', { offset: 1, 'stop-color': '#0a0e17' }))),
      s('circle', { cx: CX, cy: CY, r: R_BAND + W_BAND / 2 + 54, fill: 'none', stroke: 'url(#halo-bezel)', 'stroke-width': 18 }),
      s('circle', { cx: CX, cy: CY, r: R_BAND - W_BAND / 2 - 16, fill: '#070b14', stroke: 'url(#halo-bezel)', 'stroke-width': 6 }),
      ring(C.track),
      band,
      ticks,
      redZone,
      labels,
      thr.track, thr.fill, brk.track, brk.fill);

    const spd = h('div', { class: 'spd' }, '0');
    const gear = h('div', { class: 'gear' }, 'N');
    const time = h('div', { class: 'time' }, '0:00.0');
    const dist = h('b', {}, '0 m');
    const g = h('b', {}, '0.0 g');
    const rpm = h('b', {}, '0');
    const status = h('div', { class: 'status' });

    stage.append(h('div', { class: 't-halo' },
      svg, spd, h('div', { class: 'unit' }, 'km/h'), gear, time,
      h('div', { class: 'info', style: 'left:70px' }, 'distance', dist, h('br'), 'g-force', g),
      h('div', { class: 'info', style: 'right:70px;text-align:right' }, 'rpm', rpm),
      h('div', { class: 'side', style: 'left:330px' }, 'thr.'),
      h('div', { class: 'side', style: 'right:330px' }, 'brk.'),
      status));

    return {
      update(f) {
        status.textContent = '';
        const { max, frac, atLimit } = rpmInfo(f);
        if (max && max !== tickMax) drawTicks(max);
        band.setAttribute('stroke-dasharray', `${(ARC * frac).toFixed(1)} ${CIRC}`);
        band.setAttribute('stroke', frac >= ZONES.red ? C.red : frac >= ZONES.amber ? C.amber : C.band);
        band.style.opacity = atLimit && !blinkOn() ? 0.3 : 1;
        gear.classList.toggle('shift', frac >= ZONES.red);
        gear.textContent = gearText(f.gear);
        spd.textContent = Math.round(f.speedKmh);
        rpm.textContent = fmtInt(Math.round(f.rpm / 50) * 50);
        time.textContent = fmtTime(f.lapTime);
        dist.textContent = `${fmtInt(f.lapDistance)} m`;
        g.textContent = fmtG(f);
        fillTo(thr.fill, f.throttle);
        fillTo(brk.fill, f.brake);
      },
      idle(text) {
        status.textContent = text;
        band.setAttribute('stroke-dasharray', `0 ${CIRC}`);
        fillTo(thr.fill, 0);
        fillTo(brk.fill, 0);
        gear.classList.remove('shift');
        gear.textContent = 'N';
        spd.textContent = '0';
      },
    };
  },
};
