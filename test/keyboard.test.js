// Button box: allowed keys, the home-network check, the helper protocol and the /api/keys endpoint
// (with a fake PowerShell process – the real one only runs on Windows).
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { KEYS, GAMES, isLanAddress, helperScript, createKeyboard } from '../src/input/keyboard.js';
import { createHttpServer } from '../src/server/http.js';
import { TelemetryState } from '../src/telemetry.js';

/** A fake helper process: records stdin lines and answers each with `reply(line)`. */
function fakeHelper(reply = () => 'ok') {
  const lines = [];
  const spawn = (cmd, args) => {
    const child = new EventEmitter();
    child.cmd = cmd;
    child.args = args;
    child.stdout = new EventEmitter();
    child.stdin = {
      write(text) {
        for (const line of text.split('\n').filter(Boolean)) {
          lines.push(line);
          const [id] = line.split(' ');
          setImmediate(() => child.stdout.emit('data', `${id} ${reply(line)}\n`));
        }
      },
      end() {},
    };
    spawn.child = child;
    return child;
  };
  return { spawn, lines };
}

test('only the keypad, Esc and F12 are allowed', () => {
  assert.deepEqual(Object.keys(KEYS).filter((k) => !k.startsWith('Num ')), ['Esc', 'F12']);
  assert.deepEqual(KEYS['Num 5'], [0x4c, false]);
  assert.equal(KEYS['Num /'][1], true, 'keypad slash is an extended key');
});

test('home network addresses are accepted, internet addresses are not', () => {
  for (const a of ['127.0.0.1', '::1', '192.168.8.126', '::ffff:192.168.1.20', '10.0.0.7', '172.20.1.1', '169.254.3.4', 'fd12:3456::1', 'fe80::1']) {
    assert.equal(isLanAddress(a), true, a);
  }
  for (const a of ['8.8.8.8', '172.32.0.1', '193.168.1.1', '2a00:1450::1', '', undefined]) {
    assert.equal(isLanAddress(a), false, String(a));
  }
});

test('the helper sends scan codes and checks that a game window is in front', () => {
  const script = helperScript();
  assert.match(script, /SendInput/);
  assert.match(script, /0x0008/, 'KEYEVENTF_SCANCODE');
  assert.match(script, /GetForegroundWindow/);
  for (const g of GAMES) assert.ok(script.includes(`"${g}"`), g);
});

test('down, up and tap go to the helper as scan codes; the helper is started as an encoded command', async () => {
  const { spawn, lines } = fakeHelper();
  const kb = createKeyboard({ spawn, platform: 'win32' });
  assert.equal(await kb.tap('Num 8'), 'ok');
  assert.deepEqual(lines.map((l) => l.split(' ').slice(1).join(' ')), ['down 72 0', 'up 72 0']);
  assert.ok(spawn.child.args.includes('-EncodedCommand'));
  const decoded = Buffer.from(spawn.child.args.at(-1), 'base64').toString('utf16le');
  assert.match(decoded, /CodriverKeys/);
  kb.close();
});

test('a key is not pressed when the game is not in front', async () => {
  const { spawn } = fakeHelper((line) => (line.includes(' down ') ? 'skip:chrome' : 'ok'));
  const kb = createKeyboard({ spawn, platform: 'win32' });
  assert.equal(await kb.tap('Esc'), 'skip:chrome');
  kb.close();
});

test('a held key is released on its own if the "up" never comes', async () => {
  const { spawn, lines } = fakeHelper();
  const kb = createKeyboard({ spawn, platform: 'win32', holdLimitMs: 30 });
  await kb.down('Num 5');
  await new Promise((r) => setTimeout(r, 80));
  assert.ok(lines.some((l) => l.endsWith('up 76 0')));
  kb.close();
});

test('keys outside the list and other systems are refused', async () => {
  const { spawn } = fakeHelper();
  await assert.rejects(createKeyboard({ spawn, platform: 'win32' }).tap('A'), /not allowed/);
  await assert.rejects(createKeyboard({ spawn, platform: 'linux' }).tap('Num 1'), /only works on Windows/);
});

test('/api/keys: lists keys, validates the request, presses through the keyboard', async () => {
  const calls = [];
  const keyboard = { warm() { calls.push('warm'); }, close() {}, async tap(k) { calls.push(`tap ${k}`); return 'ok'; }, async down() { return 'ok'; }, async up() { return 'ok'; } };
  const { server } = createHttpServer({ publicDir: 'public', state: new TelemetryState(), keyboard });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/api/keys`;
  try {
    const list = await (await fetch(base)).json();
    assert.ok(list.keys.includes('Num 8'));
    assert.deepEqual(calls, ['warm']);
    const post = (body) => fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post({ key: 'A', action: 'tap' })).status, 400);
    assert.equal((await post({ key: 'Num 8', action: 'type' })).status, 400);
    const r = await post({ key: 'Num 8', action: 'tap' });
    if (process.platform === 'win32') {
      assert.equal((await r.json()).result, 'ok');
      assert.ok(calls.includes('tap Num 8'));
    } else {
      assert.equal(r.status, 501);
    }
  } finally {
    server.close();
  }
});
