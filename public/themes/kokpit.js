// C · Cockpit (id: kokpit) – a steering-wheel display: a row of LEDs, a bar tachometer, data in boxes.
import { h, useFont, useStyle, rpmInfo, gearText, fmtTime, fmtInt, fmtG, clamp, blinkOn, ZONES } from '../lib/util.js';

const C = { bg: '#050709', line: '#22303a', label: '#6f8796', fg: '#f5f7f8', off: '#121a20', cyan: '#39c6f0', green: '#39d98a', yellow: '#f4c21d', red: '#ff4d3a', blue: '#3b86ff' };

const CSS = `
.t-kokpit { position: absolute; inset: 0; box-sizing: border-box; padding: 34px 48px; background: ${C.bg}; color: ${C.fg};
  font-family: 'Chakra Petch', 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums; display: flex; flex-direction: column; gap: 22px; }
.t-kokpit .leds { display: flex; justify-content: center; gap: 18px; }
.t-kokpit .leds span { width: 40px; height: 40px; border-radius: 50%; background: ${C.off}; }
.t-kokpit .bars { display: flex; align-items: flex-end; gap: 6px; height: 100px; }
.t-kokpit .bars span { flex: 1; border-radius: 2px; background: ${C.off}; }
.t-kokpit .scale { display: flex; justify-content: space-between; font-size: 22px; color: ${C.label}; margin-top: 8px; height: 26px; }
.t-kokpit .row3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; flex-grow: 1; }
.t-kokpit .row4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 22px; height: 104px; }
.t-kokpit .box { border: 2px solid ${C.line}; border-radius: 14px; padding: 22px 32px; display: flex; flex-direction: column; justify-content: space-between; min-width: 0; }
.t-kokpit .row4 .box { padding: 14px 24px; }
.t-kokpit .lab { font-size: 24px; color: ${C.label}; }
.t-kokpit .row4 .lab { font-size: 21px; }
.t-kokpit .big { font-size: 170px; font-weight: 700; line-height: .9; }
.t-kokpit .val { font-size: 44px; font-weight: 600; }
.t-kokpit .gearbox { border: 3px solid ${C.cyan}; border-radius: 14px; background: #071219; display: flex; align-items: center; justify-content: center;
  font-size: 300px; font-weight: 700; line-height: 1; }
.t-kokpit .ped { display: flex; align-items: center; gap: 12px; font-size: 20px; color: ${C.label}; }
.t-kokpit .ped > span:first-child { width: 44px; }
.t-kokpit .track { flex: 1; height: 18px; background: #14202a; border-radius: 9px; position: relative; overflow: hidden; }
.t-kokpit .track i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 9px; }
.t-kokpit .status { text-align: center; font-size: 30px; color: ${C.label}; height: 0; overflow: visible; position: relative; top: -10px; }
`;

const N_BARS = 60;

export default {
  id: 'kokpit',
  name: 'Cockpit',
  description: 'Steering-wheel display: LEDs, bars and data boxes',
  create(stage) {
    useFont('Chakra+Petch:wght@400;600;700');
    useStyle('kokpit', CSS);

    const leds = Array.from({ length: 15 }, (_, i) => Object.assign(h('span'), { _c: i < 5 ? C.green : i < 10 ? C.red : C.blue }));
    const bars = Array.from({ length: N_BARS }, (_, k) => h('span', { style: `height:${30 + (70 * (k + 1)) / N_BARS}px` }));
    const scale = h('div', { class: 'scale' });
    let scaleFor = -1;
    const drawScale = (max) => {
      const top = Math.max(1, Math.ceil(max / 1000));
      if (top === scaleFor) return;
      scaleFor = top;
      scale.replaceChildren(...Array.from({ length: top + 1 }, (_, k) => h('span', { style: k === top ? `color:${C.red}` : '' }, k)));
    };
    drawScale(7000);

    const speed = h('div', { class: 'big' }, '0');
    const rpm = h('div', { class: 'big', style: 'font-size:130px;font-weight:600' }, '0');
    const gear = h('div', { class: 'gearbox' }, '–');
    const lt = h('div', { class: 'val' }, '0:00.0');
    const dist = h('div', { class: 'val' }, '0 m');
    const gval = h('div', { class: 'val' }, '0.0 g');
    const thr = h('i', { style: `background:${C.green};width:0` });
    const brk = h('i', { style: `background:${C.red};width:0` });
    const status = h('div', { class: 'status' });

    const root = h('div', { class: 't-kokpit' },
      h('div', { class: 'leds' }, leds),
      h('div', {}, h('div', { class: 'bars' }, bars), scale),
      status,
      h('div', { class: 'row3' },
        h('div', { class: 'box' }, h('div', { class: 'lab' }, 'speed'), speed, h('div', { class: 'lab' }, 'km/h')),
        gear,
        h('div', { class: 'box', style: 'text-align:right' }, h('div', { class: 'lab' }, 'rpm'), rpm, h('div', { class: 'lab' }, 'rev/min'))),
      h('div', { class: 'row4' },
        h('div', { class: 'box' }, h('div', { class: 'lab' }, 'stage time'), lt),
        h('div', { class: 'box' }, h('div', { class: 'lab' }, 'distance'), dist),
        h('div', { class: 'box', style: 'justify-content:center;gap:12px' },
          h('div', { class: 'ped' }, h('span', {}, 'thr.'), h('span', { class: 'track' }, thr)),
          h('div', { class: 'ped' }, h('span', {}, 'brk.'), h('span', { class: 'track' }, brk))),
        h('div', { class: 'box' }, h('div', { class: 'lab' }, 'g-force'), gval)),
    );
    stage.append(root);

    return {
      update(f) {
        status.textContent = '';
        const { max, frac, atLimit } = rpmInfo(f);
        const scaleMax = Math.max(1000, Math.ceil(max / 1000) * 1000) || 7000;
        drawScale(scaleMax);
        const flash = atLimit && !blinkOn();
        const litLeds = max ? Math.round(clamp((frac - 0.6) / (ZONES.limit - 0.6)) * 15) : 0;
        leds.forEach((l, i) => {
          const on = atLimit ? !flash : i < litLeds;
          const c = atLimit ? C.blue : l._c;
          l.style.background = on ? c : C.off;
          l.style.boxShadow = on ? `0 0 18px ${c}` : 'none';
        });
        bars.forEach((b, k) => {
          const v = ((k + 1) / N_BARS) * scaleMax;
          b.style.background = v > f.rpm ? C.off : max && v >= max * ZONES.red ? C.red : max && v >= max * ZONES.amber ? C.yellow : C.fg;
        });
        gear.textContent = gearText(f.gear);
        gear.style.borderColor = atLimit ? C.blue : C.cyan;
        speed.textContent = Math.round(f.speedKmh);
        rpm.textContent = Math.round(f.rpm / 50) * 50;
        lt.textContent = fmtTime(f.lapTime);
        dist.textContent = `${fmtInt(Math.max(0, f.lapDistance))} m`;
        gval.textContent = fmtG(f);
        thr.style.width = `${clamp(f.throttle) * 100}%`;
        brk.style.width = `${clamp(f.brake) * 100}%`;
      },
      idle(text) {
        status.textContent = text;
        leds.forEach((l) => { l.style.background = C.off; l.style.boxShadow = 'none'; });
        bars.forEach((b) => { b.style.background = C.off; });
        gear.textContent = '–';
      },
    };
  },
};
