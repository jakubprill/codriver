// Stage statistics computed on the screen (top speed, 0–100 timer...), on the demo drive.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStats } from '../public/lib/stats.js';
import { createDemo } from '../public/lib/demo.js';

test('top speed, average and the 0–100 km/h time over a demo drive', () => {
  const stats = createStats();
  const step = createDemo();
  let st;
  for (let i = 0; i < 30 * 20; i++) st = stats.update(step());
  assert.ok(st.top > 100, `top ${st.top}`);
  assert.ok(st.avg > 20 && st.avg < st.top);
  assert.ok(st.sprint > 2 && st.sprint < 20, `0-100 in ${st.sprint}`);
  assert.ok(st.history.length > 50 && st.history.length <= 151);
});

test('a new stage starts the statistics over', () => {
  const stats = createStats();
  const f = (t, v) => ({ lapTime: t, lapDistance: t * 10, speedKmh: v, gLat: 0, gLon: 0 });
  stats.update(f(50, 150));
  const st = stats.update(f(0.1, 0));
  assert.equal(st.top, 0);
  assert.equal(st.sprint, null);
});
