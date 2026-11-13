// Parser tests on a real DiRT 3 recording (2026-11-13, car with an automatic gearbox).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/games/codemasters.js';
import { TelemetryState } from '../src/telemetry.js';

const fixture = new URL('./fixtures/dirt3-2026-11-13.csv', import.meta.url);

function packets() {
  const lines = fs.readFileSync(fixture, 'utf8').trim().split('\n');
  return lines.slice(1).map((l) => {
    const floats = l.split(';').slice(2).map(Number);
    const buf = Buffer.alloc(floats.length * 4);
    floats.forEach((v, i) => buf.writeFloatLE(v, i * 4));
    return buf;
  });
}

test('a DiRT 3 packet has 38 fields and is detected as dirt3', () => {
  const [first] = packets();
  assert.equal(first.length, 152);
  assert.equal(parse(first).game, 'dirt3');
});

test('idle is 1200 RPM (125.66 rad/s)', () => {
  const f = parse(packets()[0]);
  assert.ok(Math.abs(f.rpm - 1200) < 1, `rpm=${f.rpm}`);
  assert.equal(f.gear, 1);
});

test('values are within realistic ranges', () => {
  const frames = packets().map(parse);
  const max = (k) => Math.max(...frames.map((f) => f[k]));
  assert.ok(max('speedKmh') > 140 && max('speedKmh') < 160, `vmax=${max('speedKmh')}`);
  assert.ok(max('rpm') > 6400 && max('rpm') < 6700, `rpm max=${max('rpm')}`);
  assert.deepEqual([...new Set(frames.map((f) => f.gear))].sort(), [1, 2, 3, 4]);
  for (const f of frames) {
    assert.ok(Number.isFinite(f.gLat) && Number.isFinite(f.gLon), 'g-forces without -inf');
    assert.ok(f.throttle >= 0 && f.throttle <= 1);
  }
});

test('the RPM-to-speed ratio drops with every gear', () => {
  const ratio = {};
  for (const f of packets().map(parse)) {
    if (f.speedKmh < 10) continue;
    (ratio[f.gear] ??= []).push(f.rpm / f.speedKmh);
  }
  const med = (a) => a.sort((x, y) => x - y)[a.length >> 1];
  const gears = Object.keys(ratio).map(Number).sort();
  for (let i = 1; i < gears.length; i++) assert.ok(med(ratio[gears[i]]) < med(ratio[gears[i - 1]]));
});

test('a DiRT Rally packet (66 fields) uses RPM ×10 and max RPM from the game', () => {
  const buf = Buffer.alloc(66 * 4);
  buf.writeFloatLE(25, 7 * 4);      // 90 km/h
  buf.writeFloatLE(3, 33 * 4);      // 3rd gear
  buf.writeFloatLE(512, 37 * 4);    // 5120 RPM
  buf.writeFloatLE(780, 63 * 4);    // max 7800
  const f = parse(buf);
  assert.equal(f.game, 'dirt-rally');
  assert.equal(f.rpm, 5120);
  assert.equal(f.maxRpm, 7800);
  assert.equal(Math.round(f.speedKmh), 90);
});

test('state learns max RPM and resets it after a 5 s gap', () => {
  let now = 0;
  const st = new TelemetryState(() => now);
  st.push({ rpm: 6000, maxRpm: 0 });
  now += 100; st.push({ rpm: 6500, maxRpm: 0 });
  assert.equal(st.snapshot().maxRpm, 6500);
  now += 6000; st.push({ rpm: 3000, maxRpm: 0 });
  assert.equal(st.snapshot().maxRpm, 3000);
  now += 2000;
  assert.equal(st.snapshot().live, false);
});
