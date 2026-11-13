// Launching DiRT 3: order of steps and finding the fix (without actually starting programs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launchDirt3, findFix, FIX_EXE, STEAM_APP_ID } from '../src/games/dirt3-launcher.js';

const fixture = fs.readFileSync(new URL('./fixtures/dirt3-hardware_settings_config.xml', import.meta.url), 'utf8');

function sandbox({ withFix }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codriver-launch-'));
  const configFile = path.join(dir, 'hardware_settings_config.xml');
  fs.writeFileSync(configFile, fixture.replace('enabled="true" ip', 'enabled="false" ip'));
  if (withFix) {
    fs.mkdirSync(path.join(dir, 'tools', 'DiRTTelemetryErrorFix'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'tools', 'DiRTTelemetryErrorFix', FIX_EXE), '');
  }
  const calls = [];
  const spawn = (cmd, args) => { calls.push([cmd, ...args]); return { unref() {} }; };
  return { dir, configFile, calls, spawn };
}

test('with the fix: telemetry on, the fix first, then the game via Steam', () => {
  const { dir, configFile, calls, spawn } = sandbox({ withFix: true });
  const r = launchDirt3({ appDir: dir, spawn, platform: 'win32', configFile });
  assert.equal(r.telemetry.enabled, true);
  assert.ok(r.fix.endsWith(FIX_EXE));
  assert.equal(calls.length, 2);
  assert.ok(calls[0][0].endsWith(FIX_EXE));
  assert.deepEqual(calls[0].slice(1), ['-silent']);
  assert.ok(calls[1].includes(`steam://rungameid/${STEAM_APP_ID}`));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('without the fix the game still starts', () => {
  const { dir, configFile, calls, spawn } = sandbox({ withFix: false });
  const r = launchDirt3({ appDir: dir, spawn, platform: 'win32', configFile });
  assert.equal(r.fix, null);
  assert.equal(calls.length, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('outside Windows there is a clear error', () => {
  assert.throws(() => launchDirt3({ appDir: '.', platform: 'linux', spawn: () => ({ unref() {} }), configFile: null }), /only works on Windows/);
});

test('the CODRIVER_DIRT3_FIX path takes precedence', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codriver-fix-'));
  const exe = path.join(dir, FIX_EXE);
  fs.writeFileSync(exe, '');
  assert.equal(findFix('/does/not/exist', { CODRIVER_DIRT3_FIX: dir }), exe);
  fs.rmSync(dir, { recursive: true, force: true });
});
