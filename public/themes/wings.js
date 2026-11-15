// AB · Wings – a sci-fi blue console: hatched bars spread out like wings from a round speed
// display, a gear column on the right, a ticker line along the bottom.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, fmtG, clamp, blinkOn, polar, ZONES } from '../lib/util.js';
import { createStats } from '../lib/stats.js';

const C = { bg0: '#0b2232', bg1: '#030a10', fg: '#e6f6ff', muted: '#5f8aa3', blue: '#7fd8ff', off: '#123448', frame: '#2c5a78', red: '#ff5470' };

const CSS = `
.t-wings { position: absolute; inset: 0; color: ${C.fg}; font-family: 'Orbitron', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums;
  background: radial-gradient(ellipse at 50% 50%, ${C.bg0} 0, ${C.bg1} 75%); }
.t-wings svg { position: absolute; inset: 0; overflow: visible; }
.t-wings .spd { position: absolute; left: 650px; top: 300px; width: 300px; text-align: center; font-size: 100px; font-weight: 700; line-height: 1; }
.t-wings .unit { position: absolute; left: 650px; top: 410px; width: 300px; text-align: center; font-size: 26px; color: ${C.muted}; }
.t-wings .k { position: absolute; font-size: 18px; color: ${C.muted}; letter-spacing: .1em; }
.t-wings .info { position: absolute; left: 260px; top: 440px; font-size: 18px; color: ${C.muted}; letter-spacing: .1em; }
.t-wings .info b { display: block; font-size: 34px; color: ${C.fg}; font-weight: 500; }
.t-wings .date { position: absolute; left: 80px; top: 60px; font-size: 26px; }
.t-wings .gears { position: absolute; right: 70px; top: 170px; display: flex; flex-direction: column; align-items: center; font-size: 30px; color: ${C.off}; line-height: 1.3; }
.t-wings .gears span.on { color: ${C.fg}; font-size: 58px; text-shadow: 0 0 14px ${C.blue}; }
.t-wings .gears span.on.shift { color: ${C.red}; }
.t-wings .ticker { position: absolute; left: 280px; right: 280px; top: 690px; padding: 8px 20px; border: 2px solid ${C.frame}; border-radius: 6px;
  font-size: 20px; color: ${C.muted}; display: flex; justify-content: space-between; }
.t-wings .ticker b { color: ${C.fg}; font-weight: 500; }
.t-wings .status { position: absolute; left: 0; right: 0; top: 20px; text-align: center; font-size: 22px; color: ${C.muted}; }
`;

const CX = 800, CY = 380;

/** A wing: a trapezoid of vertical hatch lines between two slanted edges; fills from the inner end out. */
function wing(svg, { x0, x1, top0, top1, bot0, bot1, n = 46 }) {
  const lines = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = x0 + (x1 - x0) * t;
    const l = s('line', { x1: x, y1: top0 + (top1 - top0) * t, x2: x, y2: bot0 + (bot1 - bot0) * t, stroke: C.off, 'stroke-width': 5 });
    lines.push(l);
    svg.append(l);
  }
  svg.append(s('polygon', { points: `${x0},${top0 - 8} ${x1},${top1 - 8} ${x1},${bot1 + 8} ${x0},${bot0 + 8}`, fill: 'none', stroke: C.frame, 'stroke-width': 2 }));
  return (v, color = C.blue) => lines.forEach((l, i) => l.setAttribute('stroke', i < Math.round(clamp(v) * n) ? color : C.off));
}

export default {
  id: 'wings',
  name: 'Wings',
  description: 'Sci-fi console: hatched bars spread like wings from a round speed display',
  create(stage) {
    useFont('Orbitron:wght@500;700');
    useStyle('wings', CSS);
    const stats = createStats();

    const svg = s('svg', { viewBox: '0 0 1600 800', width: 1600, height: 800, 'aria-hidden': 'true' });
    // inner ends near the dial, spreading outwards and upwards
    const rpm = wing(svg, { x0: 590, x1: 250, top0: 240, top1: 120, bot0: 330, bot1: 280 });
    const spdW = wing(svg, { x0: 1010, x1: 1350, top0: 240, top1: 120, bot0: 330, bot1: 280 });
    const thr = wing(svg, { x0: 1010, x1: 1350, top0: 450, top1: 420, bot0: 520, bot1: 580, n: 30 });
    svg.append(
      s('circle', { cx: CX, cy: CY, r: 200, fill: '#06121b', stroke: C.frame, 'stroke-width': 10 }),
      s('circle', { cx: CX, cy: CY, r: 160, fill: 'url(#wings-glow)', stroke: C.blue, 'stroke-width': 3 }),
      s('defs', {}, s('radialGradient', { id: 'wings-glow' }, s('stop', { offset: 0, 'stop-color': '#1d6f9a' }), s('stop', { offset: 1, 'stop-color': '#08202e' }))));
    const dots = s('g', { fill: C.blue });
    for (let a = 0; a < 360; a += 15) {
      const [x, y] = polar(CX, CY, 182, a);
      dots.append(s('circle', { cx: x, cy: y, r: a % 45 === 0 ? 4 : 2 }));
    }
    svg.append(dots);

    const spd = h('div', { class: 'spd' }, '0');
    const gears = h('div', { class: 'gears' }, ...['R', 'N', '1', '2', '3', '4', '5', '6'].map((g) => h('span', {}, g)));
    const time = h('b', {}, '0:00.0');
    const dist = h('b', {}, '0 m');
    const top = h('b', {}, '0');
    const avg = h('b', {}, '0');
    const g = h('b', {}, '0.0 g');
    const status = h('div', { class: 'status' });
    stage.append(h('div', { class: 't-wings' }, svg, spd, h('div', { class: 'unit' }, 'KM/H'),
      h('div', { class: 'date' }, time),
      h('div', { class: 'k', style: 'left:255px;top:95px' }, 'REV ×1000'),
      h('div', { class: 'k', style: 'left:1230px;top:95px' }, 'SPEED'),
      h('div', { class: 'k', style: 'left:1230px;top:595px' }, 'THROTTLE'),
      h('div', { class: 'info' }, 'INFO', h('b', {}, 'STAGE'), 'DISTANCE', dist),
      gears,
      h('div', { class: 'ticker' }, h('span', {}, 'TOP ', top), h('span', {}, 'AVG ', avg), h('span', {}, 'G ', g)),
      status));

    return {
      update(f) {
        status.textContent = '';
        const st = stats.update(f);
        const { frac, atLimit } = rpmInfo(f);
        rpm(atLimit && !blinkOn() ? 0 : frac, frac >= ZONES.red ? C.red : C.blue);
        spdW(f.speedKmh / 200);
        thr(f.throttle);
        spd.textContent = Math.round(f.speedKmh);
        const gt = gearText(f.gear);
        [...gears.children].forEach((el) => {
          el.classList.toggle('on', el.textContent === gt);
          el.classList.toggle('shift', frac >= ZONES.red);
        });
        time.textContent = fmtTime(f.lapTime);
        dist.textContent = `${fmtInt(f.lapDistance)} m`;
        top.textContent = Math.round(st.top);
        avg.textContent = Math.round(st.avg);
        g.textContent = fmtG(f);
      },
      idle(text) {
        status.textContent = text;
        rpm(0);
        spdW(0);
        thr(0);
        spd.textContent = '0';
        [...gears.children].forEach((el) => el.classList.toggle('on', el.textContent === 'N'));
      },
    };
  },
};
