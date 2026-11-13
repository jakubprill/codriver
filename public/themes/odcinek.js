// A · Stage (id: odcinek) – rally digital. An arc of slanted segments across the screen
// is both the tachometer and the shift lights.
import { h, s, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, fmtG, clamp, blinkOn, ZONES } from '../lib/util.js';

const C = { night: '#0d1418', carbon: '#172126', gravel: '#7d8c92', chalk: '#ece8de', amber: '#f4a81d', red: '#ec3a2c', green: '#4cc38a', blue: '#3b86ff' };

const CSS = `
.t-odcinek { position: absolute; inset: 0; background: ${C.night}; color: ${C.chalk};
  font-family: 'Barlow Condensed', Bahnschrift, 'DIN Condensed', 'sans-serif-condensed', 'Arial Narrow', sans-serif;
  font-variant-numeric: tabular-nums; }
.t-odcinek .tach { position: absolute; left: 0; top: 0; }
.t-odcinek .gear { position: absolute; left: 540px; top: 150px; width: 520px; text-align: center; font-size: 580px; line-height: 1; font-weight: 700; }
.t-odcinek .ro { position: absolute; top: 330px; width: 420px; }
.t-odcinek .ro.l { left: 110px; }
.t-odcinek .ro.r { right: 110px; text-align: right; }
.t-odcinek .ro .num { font-size: 210px; line-height: .85; font-weight: 700; }
.t-odcinek .ro.r .num { font-size: 150px; font-weight: 600; color: #c9c5bb; }
.t-odcinek .ro .unit { font-size: 36px; color: ${C.gravel}; margin-top: 14px; }
.t-odcinek .pedal { position: absolute; top: 300px; width: 22px; height: 400px; background: ${C.carbon}; border-radius: 11px; overflow: hidden; }
.t-odcinek .pedal i { position: absolute; left: 0; right: 0; bottom: 0; border-radius: 11px; }
.t-odcinek .strip { position: absolute; left: 110px; right: 110px; bottom: 26px; height: 64px; border-top: 2px solid ${C.carbon};
  padding-top: 14px; display: flex; justify-content: space-between; align-items: baseline; font-size: 36px; color: ${C.gravel}; }
.t-odcinek .strip b { color: ${C.chalk}; font-weight: 600; margin-left: 12px; }
.t-odcinek .status { position: absolute; left: 0; right: 0; bottom: 110px; text-align: center; font-size: 40px; color: ${C.gravel}; }
.t-odcinek.idle .gear, .t-odcinek.idle .num, .t-odcinek.idle .strip b { color: ${C.carbon}; }
`;

const SEGS = 46, CX = 800, CY = 1650, R1 = 1430, R2 = 1530, A0 = -0.505, A1 = 0.505, SKEW = 0.006;
const pt = (r, a) => [CX + r * Math.sin(a), CY - r * Math.cos(a)];

export default {
  id: 'odcinek',
  name: 'Stage',
  description: 'Rally digital: an RPM arc over a huge gear number',
  create(stage) {
    useFont('Barlow+Condensed:wght@400;600;700');
    useStyle('odcinek', CSS);

    const segs = [];
    const tach = s('svg', { class: 'tach', width: 1600, height: 330, viewBox: '0 0 1600 330', 'aria-hidden': 'true' });
    for (let i = 0; i < SEGS; i++) {
      const st = (A1 - A0) / SEGS, a = A0 + i * st, b = a + st * 0.72;
      const p = [pt(R1, a), pt(R1, b), pt(R2, b + SKEW), pt(R2, a + SKEW)];
      const f = (i + 1) / SEGS;
      const p2 = s('path', { d: 'M' + p.map((q) => q.map((v) => v.toFixed(1)).join(',')).join('L') + 'Z', fill: C.carbon });
      p2.dataset.on = f >= ZONES.red ? C.red : f >= ZONES.amber ? C.amber : C.chalk;
      segs.push(p2);
      tach.append(p2);
    }
    const ticks = s('g');
    tach.append(ticks);
    let ticksFor = 0;
    const drawTicks = (max) => {
      const key = Math.round(max / 250);
      if (!max || key === ticksFor) return;
      ticksFor = key;
      ticks.replaceChildren();
      for (let k = 1000; k <= max; k += 1000) {
        const f = k / max, [x, y] = pt(R2 + 30, A0 + (A1 - A0) * f);
        ticks.append(s('text', { x: x.toFixed(1), y: (y + 4).toFixed(1), fill: f >= ZONES.red ? C.red : '#56656b', 'font-size': 30, 'font-weight': 600, 'text-anchor': 'middle' }, k / 1000));
      }
    };

    const brk = h('i', { style: `background:${C.red};height:0` });
    const thr = h('i', { style: `background:${C.green};height:0` });
    const speed = h('div', { class: 'num' }, '0');
    const rpm = h('div', { class: 'num' }, '0');
    const gear = h('div', { class: 'gear' }, '–');
    const lt = h('b', {}, '0:00.0');
    const dist = h('b', {}, '0 m');
    const gval = h('b', {}, '0.0 g');
    const status = h('div', { class: 'status' });

    const root = h('div', { class: 't-odcinek idle' },
      tach,
      h('div', { class: 'pedal', style: 'left:40px', title: 'brake' }, brk),
      h('div', { class: 'pedal', style: 'right:40px', title: 'throttle' }, thr),
      h('div', { class: 'ro l' }, speed, h('div', { class: 'unit' }, 'km/h')),
      gear,
      h('div', { class: 'ro r' }, rpm, h('div', { class: 'unit' }, 'rpm')),
      status,
      h('div', { class: 'strip' },
        h('span', {}, 'time', lt), h('span', {}, 'distance', dist), h('span', {}, 'g-force', gval)),
    );
    stage.append(root);

    return {
      update(f) {
        root.classList.remove('idle');
        status.textContent = '';
        const { max, frac, atLimit } = rpmInfo(f);
        const lit = Math.round(frac * SEGS);
        const flash = atLimit && !blinkOn();
        segs.forEach((p, i) => p.setAttribute('fill', atLimit ? (flash ? C.carbon : C.blue) : i < lit ? p.dataset.on : C.carbon));
        drawTicks(max);
        gear.textContent = gearText(f.gear);
        gear.style.color = atLimit ? C.blue : '';
        speed.textContent = Math.round(f.speedKmh);
        rpm.textContent = Math.round(f.rpm / 50) * 50;
        thr.style.height = `${clamp(f.throttle) * 100}%`;
        brk.style.height = `${clamp(f.brake) * 100}%`;
        lt.textContent = fmtTime(f.lapTime);
        dist.textContent = `${fmtInt(Math.max(0, f.lapDistance))} m`;
        gval.textContent = fmtG(f);
      },
      idle(text) {
        root.classList.add('idle');
        status.textContent = text;
        segs.forEach((p) => p.setAttribute('fill', C.carbon));
        gear.textContent = '–';
        gear.style.color = '';
      },
    };
  },
};
