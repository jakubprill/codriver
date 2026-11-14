// Launching DiRT 3: order of steps and finding the fix (without actually starting programs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launchDirt3, launchScript, ensureFixTimeout, findFix, FIX_EXE, FIX_TIMEOUT_S, STEAM_APP_ID } from '../src/games/dirt3-launcher.js';

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
  const handlers = {};
  const spawn = (cmd, args) => { calls.push([cmd, ...args]); return { unref() {}, on(ev, fn) { handlers[ev] = fn; return this; } }; };
  return { dir, configFile, calls, spawn, handlers };
}

/** The PowerShell -Command argument of a spawn call. */
const script = (call) => call[call.indexOf('-Command') + 1];

test('with the fix: telemetry on, the fix elevated first, then the game via Steam – one PowerShell call', () => {
  const { dir, configFile, calls, spawn } = sandbox({ withFix: true });
  const r = launchDirt3({ appDir: dir, spawn, platform: 'win32', configFile });
  assert.equal(r.telemetry.enabled, true);
  assert.ok(r.fix.endsWith(FIX_EXE));
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'powershell.exe');
  const cmd = script(calls[0]);
  const fixAt = cmd.indexOf(FIX_EXE), gameAt = cmd.indexOf(`steam://rungameid/${STEAM_APP_ID}`);
  assert.ok(fixAt > 0 && gameAt > fixAt, 'the fix before the game');
  assert.match(cmd, /-Verb RunAs/);
  assert.match(cmd, /-ArgumentList '-silent'/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a failed spawn does not throw and falls back to starting just the game', () => {
  const { dir, configFile, calls, spawn, handlers } = sandbox({ withFix: true });
  launchDirt3({ appDir: dir, spawn, platform: 'win32', configFile });
  assert.equal(typeof handlers.error, 'function', 'an error handler is attached');
  handlers.error(new Error('spawn powershell.exe ENOENT'));
  assert.equal(calls.length, 2);
  assert.ok(calls[1].includes(`steam://rungameid/${STEAM_APP_ID}`));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('paths with apostrophes are quoted for PowerShell', () => {
  const cmd = launchScript("C:\\Users\\o'neil\\fix\\" + FIX_EXE);
  assert.ok(cmd.includes("o''neil"));
});

test('without the fix the game still starts', () => {
  const { dir, configFile, calls, spawn } = sandbox({ withFix: false });
  const r = launchDirt3({ appDir: dir, spawn, platform: 'win32', configFile });
  assert.equal(r.fix, null);
  assert.equal(calls.length, 1);
  assert.doesNotMatch(script(calls[0]), /RunAs/);
  assert.match(script(calls[0]), new RegExp(`steam://rungameid/${STEAM_APP_ID}`));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('outside Windows there is a clear error', () => {
  assert.throws(() => launchDirt3({ appDir: '.', platform: 'linux', spawn: () => ({ unref() {}, on() {} }), configFile: null }), /only works on Windows/);
});

test('the CODRIVER_DIRT3_FIX path takes precedence', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codriver-fix-'));
  const exe = path.join(dir, FIX_EXE);
  fs.writeFileSync(exe, '');
  assert.equal(findFix('/does/not/exist', { CODRIVER_DIRT3_FIX: dir }), exe);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the fix waits long enough for a cold Steam start; a longer timeout is kept', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codriver-fixcfg-'));
  const exe = path.join(dir, FIX_EXE);
  const cfg = (t) => `<configuration><appSettings>\n    <add key="timeout" value="${t}" />\n  </appSettings></configuration>`;
  fs.writeFileSync(`${exe}.config`, cfg(30));
  assert.equal(ensureFixTimeout(exe), FIX_TIMEOUT_S);
  assert.equal(fs.readFileSync(`${exe}.config`, 'utf8'), cfg(FIX_TIMEOUT_S));
  fs.writeFileSync(`${exe}.config`, cfg(600));
  assert.equal(ensureFixTimeout(exe), 600);
  assert.equal(ensureFixTimeout(path.join(dir, 'missing.exe')), null);
  fs.rmSync(dir, { recursive: true, force: true });
});
