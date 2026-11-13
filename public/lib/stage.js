// A 1600×800 stage scaled to its container: every theme draws in fixed pixels
// and looks the same on a phone, a tablet and a monitor.
import { h, STAGE_W, STAGE_H } from './util.js';

export function createStage(container) {
  const stage = h('div', { class: 'stage' });
  const frame = h('div', { class: 'stage-frame' }, stage);
  container.append(frame);

  const fit = () => {
    const { width, height } = container.getBoundingClientRect();
    const k = Math.min(width / STAGE_W, height / STAGE_H) || 0;
    stage.style.transform = `scale(${k})`;
    frame.style.width = `${STAGE_W * k}px`;
    frame.style.height = `${STAGE_H * k}px`;
  };
  new ResizeObserver(fit).observe(container);
  fit();
  return stage;
}
