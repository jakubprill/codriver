// X · Pulse – a ring of short lime dashes; around the current RPM they stretch outwards like a
// pulse travelling round the dial. Seven-segment speed in the middle with faint unlit digits.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, blinkOn, polar, ZONES } from '../lib/util.js';
import { sevenSeg } from '../lib/seg7.js';

const C = { bg: '#000', fg: '#f2f2ea', muted: '#77776a', lime: '#b8e04a', dim: '#3b4a17', red: '#ff4a3a' };

const CSS = `
.t-pulse { position: absolute; inset: 0; background: ${C.bg}; color: ${C.fg}; font-family: 'DIN Alternate', 'Barlow Condensed', 'Arial Narrow', sans-serif; font-variant-numeric: tabular-nums; }
.t-pulse svg { position: absolute; overflow: visible; }
.t-pulse .k { position: absolute; font-size: 26px; color: ${C.muted}; letter-spacing: .1em; }
.t-pulse .gear { position: absolute; left: 1220px; top: 340px; font-size: 26px; color: ${C.muted}; letter-spacing: .1em; }
.t-pulse .gear b { display: block; font-size: 150px; color: ${C.fg}; letter-spacing: 0; line-height: 1; font-weight: 600; }
.t-pulse .gear.shift b { color: ${C.red}; }
.t-pulse .side { position: absolute; left: 90px; top: 250px; font-size: 24px; color: ${C.muted}; letter-spacing: .1em; line-height: 1.4; }
.t-pulse .side b { display: block; font-size: 52px; color: ${C.fg}; letter-spacing: 0; font-weight: 500; margin-bottom: 20px; }
.t-pulse .status { position: absolute; left: 0; right: 0; bottom: 30px; text-align: center; font-size: 24px; color: ${C.muted}; }
`;

const CX = 800, CY = 400, R = 250, N = 60;
const A0 = 0, SWEEP = 360; // the full circle, from the top clockwise
const WIDTH = 0.09; // how wide the pulse spreads, as a share of the ring

export default {
  id: 'pulse',
  name: 'Pulse',
  description: 'A ring of lime dashes that stretch out around the current RPM; digital speed',
  create(stage) {
    useFont('Barlow+Condensed:wght@500;600');
    useStyle('pulse', CSS);

    const svg = s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, style: 'left:0;top:0', 'aria-hidden': 'true' });
    const dashes = Array.from({ length: N }, () => {
      const l = s('line', { stroke: C.lime, 'stroke-width': 9 });
      svg.append(l);
      return l;
    });
    const rpmLabel = s('text', { 'font-size': 34, fill: C.fg, 'dominant-baseline': 'central' }, '');
    svg.append(rpmLabel);

    const speed = sevenSeg({ count: 3, w: 70, h: 130, gap: 16, x: 670, y: 310, on: C.fg, ghost: 'rgba(242, 242, 234, 0.07)', skew: -4 });
    const gear = h('b', {}, 'N');
    const gearBox = h('div', { class: 'gear' }, 'gear', gear);
    const time = h('b', {}, '0:00.0');
    const dist = h('b', {}, '0 m');
    const status = h('div', { class: 'status' });
    stage.append(h('div', { class: 't-pulse' }, svg, speed.svg,
      h('div', { class: 'k', style: 'left:700px;top:455px;width:200px;text-align:center' }, 'km/h'),
      gearBox,
      h('div', { class: 'side' }, 'stage time', time, 'distance', dist),
      status));

    let shown = 0;
    const draw = (frac, off, red) => {
      shown += (frac - shown) * 0.4;
      dashes.forEach((l, i) => {
        const at = i / N;
        let d = Math.abs(at - shown);
        d = Math.min(d, 1 - d); // around the circle
        const pulse = Math.max(0, 1 - d / WIDTH); // 0..1 near the value
        const a = A0 + SWEEP * at;
        const len = 14 + 120 * pulse * pulse;
        const [x0, y0] = polar(CX, CY, R, a);
        const [x1, y1] = polar(CX, CY, R + len, a);
        l.setAttribute('x1', x0.toFixed(1));
        l.setAttribute('y1', y0.toFixed(1));
        l.setAttribute('x2', x1.toFixed(1));
        l.setAttribute('y2', y1.toFixed(1));
        l.setAttribute('stroke', off ? C.dim : pulse > 0 && red ? C.red : pulse > 0.05 || at <= shown ? C.lime : C.dim);
      });
      const [lx, ly] = polar(CX, CY, R + 140, A0 + SWEEP * shown);
      rpmLabel.setAttribute('x', lx.toFixed(1));
      rpmLabel.setAttribute('y', ly.toFixed(1));
      rpmLabel.setAttribute('text-anchor', lx < CX - 20 ? 'end' : lx > CX + 20 ? 'start' : 'middle');
    };
    draw(0, false, false);

    return {
      update(f) {
        status.textContent = '';
        const { frac, atLimit } = rpmInfo(f);
        const red = frac >= ZONES.red;
        draw(frac, atLimit && !blinkOn(), red);
        rpmLabel.textContent = fmtInt(Math.round(f.rpm / 100) * 100);
        speed.set(String(Math.round(f.speedKmh)));
        gear.textContent = gearText(f.gear);
        gearBox.classList.toggle('shift', red);
        time.textContent = fmtTime(f.lapTime);
        dist.textContent = `${fmtInt(f.lapDistance)} m`;
      },
      idle(text) {
        status.textContent = text;
        shown = 0;
        draw(0, false, false);
        rpmLabel.textContent = '';
        speed.set('0');
        gear.textContent = 'N';
        gearBox.classList.remove('shift');
      },
    };
  },
};
