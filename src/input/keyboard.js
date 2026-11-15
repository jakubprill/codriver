// Key presses for the game, sent from the button box on a phone or tablet.
//
// Windows only. One PowerShell process compiles a small C# helper once and then reads commands from
// stdin; each key goes out with SendInput as a hardware scan code, which DirectInput games such as
// DiRT 3 read like a real keyboard – so a button can be assigned in the game's Controls screen.
//
// Safety:
// - only the keys in KEYS (numeric keypad, Esc, F12): nothing that types text or reaches the system;
// - a key is sent only while a known game window is in front (GAMES); otherwise the helper answers
//   "skip:<process>" and nothing is typed into another program;
// - a held key is released after HOLD_LIMIT_MS even if the "up" never arrives (a dropped connection).
import { spawn as nodeSpawn } from 'node:child_process';

/** Allowed keys: name -> [scan code, extended]. */
export const KEYS = Object.freeze({
  'Num 0': [0x52, false], 'Num 1': [0x4f, false], 'Num 2': [0x50, false], 'Num 3': [0x51, false],
  'Num 4': [0x4b, false], 'Num 5': [0x4c, false], 'Num 6': [0x4d, false], 'Num 7': [0x47, false],
  'Num 8': [0x48, false], 'Num 9': [0x49, false], 'Num /': [0x35, true], 'Num *': [0x37, false],
  'Num -': [0x4a, false], 'Num +': [0x4e, false], 'Num .': [0x53, false], 'Num Enter': [0x1c, true],
  Esc: [0x01, false], F12: [0x58, false],
});

/** Game processes that may receive keys (lower case, without .exe). */
export const GAMES = Object.freeze(['dirt3_game', 'drt']);

export const HOLD_LIMIT_MS = 5000;
const TAP_MS = 60;
/**
 * Whether an address belongs to the home network (or this machine): private IPv4 ranges, link-local,
 * IPv6 unique-local and link-local. Key presses are accepted only from these.
 */
export function isLanAddress(addr = '') {
  const a = String(addr).toLowerCase().replace(/^::ffff:/, '');
  if (a === '127.0.0.1' || a === '::1') return true;
  const m = a.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [x, y] = [Number(m[1]), Number(m[2])];
    return x === 10 || (x === 172 && y >= 16 && y <= 31) || (x === 192 && y === 168) || (x === 169 && y === 254);
  }
  return /^f[cd][0-9a-f]{2}:/.test(a) || /^fe[89ab][0-9a-f]:/.test(a);
}

const REPLY_TIMEOUT_MS = 4000; // the first command waits for the C# helper to compile (~1–2 s)

/** The PowerShell program: C# helper + a loop reading "<id> <down|up> <scan> <ext>" lines. */
export function helperScript(games = GAMES) {
  const list = games.map((g) => `"${g}"`).join(', ');
  return `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
public static class CodriverKeys {
  [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit)] struct UNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNION u; }
  [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint n, INPUT[] inputs, int size);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  public static string Foreground() {
    uint pid; GetWindowThreadProcessId(GetForegroundWindow(), out pid);
    try { return Process.GetProcessById((int)pid).ProcessName.ToLowerInvariant(); } catch { return ""; }
  }
  public static uint Send(ushort scan, bool up, bool ext) {
    var i = new INPUT[1];
    i[0].type = 1;
    i[0].u.ki.wScan = scan;
    i[0].u.ki.dwFlags = 0x0008 | (up ? 0x0002u : 0u) | (ext ? 0x0001u : 0u);
    return SendInput(1, i, Marshal.SizeOf(typeof(INPUT)));
  }
}
"@
$games = @(${list})
[Console]::Out.WriteLine("ready")
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null) { break }
  $p = $line.Split(' ')
  if ($p.Length -ne 4) { continue }
  $fg = [CodriverKeys]::Foreground()
  if ($p[1] -eq 'down' -and -not ($games -contains $fg)) { [Console]::Out.WriteLine("$($p[0]) skip:$fg"); continue }
  $n = [CodriverKeys]::Send([uint16]$p[2], $p[1] -eq 'up', $p[3] -eq '1')
  if ($n -eq 1) { [Console]::Out.WriteLine("$($p[0]) ok") } else { [Console]::Out.WriteLine("$($p[0]) error") }
}
`;
}

/**
 * @param {object} [o]
 * @param {Function} [o.spawn]     for tests
 * @param {string} [o.platform]    for tests
 * @param {number} [o.holdLimitMs]
 */
export function createKeyboard({ spawn = nodeSpawn, platform = process.platform, holdLimitMs = HOLD_LIMIT_MS } = {}) {
  let child = null;
  let buffer = '';
  let nextId = 1;
  const pending = new Map(); // id -> resolve
  const held = new Map(); // key name -> auto-release timer

  const start = () => {
    if (child) return child;
    // the program goes in as -EncodedCommand (UTF-16LE, base64); stdin carries only key commands
    const encoded = Buffer.from(helperScript(), 'utf16le').toString('base64');
    child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    child.on?.('error', () => { child = null; });
    child.on?.('exit', () => {
      child = null;
      for (const resolve of pending.values()) resolve('error');
      pending.clear();
    });
    child.stdout?.setEncoding?.('utf8');
    child.stdout?.on('data', (chunk) => {
      buffer += chunk;
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        const [id, result] = line.split(' ');
        const resolve = pending.get(Number(id));
        if (resolve) { pending.delete(Number(id)); resolve(result); }
      }
    });
    return child;
  };

  /** Sends one event; resolves to "ok", "skip:<process>", "error" or "timeout". */
  const send = (key, dir) => new Promise((resolve) => {
    const [scan, ext] = KEYS[key];
    const id = nextId++;
    pending.set(id, resolve);
    setTimeout(() => { if (pending.delete(id)) resolve('timeout'); }, REPLY_TIMEOUT_MS);
    try {
      start().stdin.write(`${id} ${dir} ${scan} ${ext ? 1 : 0}\n`);
    } catch {
      pending.delete(id);
      resolve('error');
    }
  });

  const check = (key) => {
    if (platform !== 'win32') throw new Error('Sending keys only works on Windows.');
    if (!Object.hasOwn(KEYS, key)) throw new Error(`Key not allowed: ${key}`);
  };

  const up = (key) => {
    check(key);
    clearTimeout(held.get(key));
    held.delete(key);
    return send(key, 'up');
  };

  return {
    /** Starts the helper ahead of the first key (the button box page calls this when it opens). */
    warm() {
      if (platform === 'win32') try { start(); } catch { /* reported on the first key */ }
    },
    /** Presses and holds a key (released by up() or after holdLimitMs). */
    async down(key) {
      check(key);
      const result = await send(key, 'down');
      if (result === 'ok') {
        clearTimeout(held.get(key));
        held.set(key, setTimeout(() => { up(key).catch(() => {}); }, holdLimitMs));
      }
      return result;
    },
    up,
    /** A short press. */
    async tap(key) {
      const result = await this.down(key);
      if (result !== 'ok') return result;
      await new Promise((r) => setTimeout(r, TAP_MS));
      await up(key);
      return result;
    },
    /** Releases every held key (a device disconnected, codriver closing). */
    releaseAll() {
      for (const key of [...held.keys()]) up(key).catch(() => {});
    },
    close() {
      this.releaseAll();
      child?.stdin?.end();
      child = null;
    },
  };
}
