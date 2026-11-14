// The telemetry switch and fullscreen in the DiRT 3 settings – on real files from the game.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readMotion, setMotion, isCodriverReady, applyToFile, candidatePaths, findConfig, readDisplay, nativeResolution, setFullscreen } from '../src/games/dirt3-config.js';

const fixture = fs.readFileSync(new URL('./fixtures/dirt3-hardware_settings_config.xml', import.meta.url), 'utf8');

test('reads the motion line from the game file', () => {
  assert.deepEqual(readMotion(fixture), { enabled: true, ip: '127.0.0.1', port: 20777, extradata: 3, delay: 1 });
  assert.ok(isCodriverReady(readMotion(fixture)));
});

test('turning off changes only the enabled attribute; the rest of the file stays', () => {
  const off = setMotion(fixture, false);
  assert.equal(readMotion(off).enabled, false);
  assert.equal(readMotion(off).ip, '127.0.0.1');
  assert.equal(off.replace(/enabled="false" ip/, 'enabled="true" ip'), fixture);
});

test('turning on sets codriver address and port, even from D-Box settings', () => {
  const dbox = fixture.replace(/<motion[^>]*\/>/, '<motion enabled="true" ip="dbox" port="20777" delay="1" extradata="0" />');
  assert.equal(isCodriverReady(readMotion(dbox)), false);
  const on = setMotion(dbox, true);
  assert.ok(isCodriverReady(readMotion(on)));
  assert.equal(readMotion(on).extradata, 3);
});

test('writing the file: one backup, read-only attribute preserved', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codriver-'));
  const file = path.join(dir, 'hardware_settings_config.xml');
  fs.writeFileSync(file, fixture);
  fs.chmodSync(file, 0o444);
  applyToFile(file, false);
  assert.equal(readMotion(fs.readFileSync(file, 'utf8')).enabled, false);
  assert.equal(fs.statSync(file).mode & 0o200, 0, 'still read-only');
  assert.equal(fs.readFileSync(`${file}.codriver-backup`, 'utf8'), fixture);
  applyToFile(file, true);
  assert.equal(fs.readFileSync(`${file}.codriver-backup`, 'utf8'), fixture, 'the backup is not overwritten');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the file is also found in Documents moved to OneDrive', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  const file = path.join(home, 'OneDrive', 'Dokumenty', 'My Games', 'DiRT3', 'hardwaresettings', 'hardware_settings_config.xml');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, fixture);
  assert.ok(candidatePaths(home).includes(file));
  assert.equal(findConfig(home), file);
  fs.rmSync(home, { recursive: true, force: true });
});

// Fullscreen: the game sometimes saves itself as windowed (seen on 2026-11-14: 1920×1080, fullscreen="false"
// on a 2560×1600 screen), so "Launch DiRT 3" switches it back to fullscreen at the native resolution.
const info = fs.readFileSync(new URL('./fixtures/dirt3-hardware_settings_info.xml', import.meta.url), 'utf8');

test('native resolution comes from the game hardware info, if the game lists that mode', () => {
  assert.deepEqual(nativeResolution(info), { width: 2560, height: 1600 });
  assert.equal(nativeResolution(info.replace('<resolution width="2560" height="1600"', '<resolution width="1" height="1"')), null);
  assert.equal(nativeResolution('<hardware_settings_info />'), null);
});

test('fullscreen changes only the resolution line', () => {
  assert.deepEqual(readDisplay(fixture), { width: 1280, height: 800, fullscreen: false });
  const next = setFullscreen(fixture, { width: 2560, height: 1600 });
  assert.deepEqual(readDisplay(next), { width: 2560, height: 1600, fullscreen: true });
  assert.equal(next.replace(/<resolution\b[^>]*>/, ''), fixture.replace(/<resolution\b[^>]*>/, ''));
  assert.deepEqual(readDisplay(setFullscreen(fixture)), { width: 1280, height: 800, fullscreen: true }, 'without a size the resolution stays');
});

test('writing with fullscreen uses the info file next to the settings', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codriver-fs-'));
  const file = path.join(dir, 'hardware_settings_config.xml');
  fs.writeFileSync(file, fixture);
  fs.writeFileSync(path.join(dir, 'hardware_settings_info.xml'), info);
  const r = applyToFile(file, true, 20777, { fullscreen: true });
  assert.deepEqual(r.display, { width: 2560, height: 1600, fullscreen: true });
  assert.equal(r.motion.enabled, true);
  fs.rmSync(dir, { recursive: true, force: true });
});
