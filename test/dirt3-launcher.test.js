// Launching DiRT 3: order of steps and finding the fix (without actually starting programs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launchDirt3, elevateScript, ensureFixTimeout, parseTasklist, runningState, isElevated, findFix, FIX_EXE, FIX_TIMEOUT_S, STEAM_APP_ID } from '../src/games/dirt3-launcher.js';

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

const GAME = `steam://rungameid/${STEAM_APP_ID}`;
const startsGame = (call) => call[0] === 'cmd' && call.includes(GAME);

test('not elevated: the fix through a UAC prompt, and the game starts right away, on its own', () => {
  const { dir, configFile, calls, spawn } = sandbox({ withFix: true });
  const r = launchDirt3({ appDir: dir, spawn, platform: 'win32', configFile });
  assert.equal(r.telemetry.enabled, true);
  assert.ok(r.fix.endsWith(FIX_EXE));
  assert.equal(r.fixPrompt, true);
  assert.equal(r.display.fullscreen, true, 'the game always starts fullscreen');
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'powershell.exe');
  assert.match(script(calls[0]), /-Verb RunAs/);
  assert.match(script(calls[0]), /-ArgumentList '-silent'/);
  assert.doesNotMatch(script(calls[0]), /steam:/, 'the game does not wait for the prompt');
  assert.ok(startsGame(calls[1]));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('elevated: the fix is started directly, without a prompt', () => {
  const { dir, configFile, calls, spawn } = sandbox({ withFix: true });
  const r = launchDirt3({ appDir: dir, spawn, platform: 'win32', configFile, elevated: true });
  assert.equal(r.fixPrompt, false);
  assert.ok(calls[0][0].endsWith(FIX_EXE));
  assert.deepEqual(calls[0].slice(1), ['-silent']);
  assert.ok(startsGame(calls[1]));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a failed spawn never throws: every child process gets an error handler', () => {
  const { dir, configFile, spawn, handlers } = sandbox({ withFix: true });
  launchDirt3({ appDir: dir, spawn, platform: 'win32', configFile, elevated: true });
  assert.equal(typeof handlers.error, 'function');
  assert.doesNotThrow(() => handlers.error(new Error('spawn UNKNOWN')));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('paths with apostrophes are quoted for PowerShell', () => {
  assert.ok(elevateScript("C:\\Users\\o'neil\\fix\\" + FIX_EXE).includes("o''neil"));
});

test('process list: game and fix detected from tasklist output', async () => {
  const out = '"System Idle Process","0","Services","0","8 K"\r\n"dirt3_game.exe","4242","Console","1","1 200 000 K"\r\n"DiRTTelemetryErrorFix.exe","77","Console","1","20 000 K"\r\n';
  assert.ok(parseTasklist(out).has('dirt3_game.exe'));
  const execFile = (cmd, args, o, cb) => { cb(null, out); return { on() {} }; };
  assert.deepEqual(await runningState({ execFile, platform: 'win32' }), { game: true, fix: true });
  const none = (cmd, args, o, cb) => { cb(null, '"explorer.exe","1","Console","1","1 K"'); return { on() {} }; };
  assert.deepEqual(await runningState({ execFile: none, platform: 'win32' }), { game: false, fix: false });
  assert.equal(await runningState({ platform: 'linux' }), null);
});

test('elevation check: net session succeeds only as administrator', async () => {
  const ok = (cmd, args, o, cb) => { cb(null); return { on() {} }; };
  const denied = (cmd, args, o, cb) => { cb(new Error('Access is denied.')); return { on() {} }; };
  assert.equal(await isElevated({ execFile: ok, platform: 'win32' }), true);
  assert.equal(await isElevated({ execFile: denied, platform: 'win32' }), false);
});

test('without the fix the game still starts', () => {
  const { dir, configFile, calls, spawn } = sandbox({ withFix: false });
  const r = launchDirt3({ appDir: dir, spawn, platform: 'win32', configFile });
  assert.equal(r.fix, null);
  assert.equal(calls.length, 1);
  assert.ok(startsGame(calls[0]));
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
