// Launching DiRT 3 with one button: telemetry on, the error-10038 fix, the game via Steam.
//
// The fix is DiRTTelemetryErrorFix (MIT, https://github.com/RoccoC/DiRTTelemetryErrorFix).
// codriver neither bundles nor reimplements it – it injects native code into the game process –
// we only start it when it sits in one of the known folders (findFix).
// Once started it waits for the game process (`timeout` in its .exe.config, raised to FIX_TIMEOUT_S) and exits
// on its own when the game closes. It injects code into the game, so it needs administrator rights:
// Windows shows a UAC prompt. A plain spawn() of an elevated program fails (and used to crash codriver),
// so both steps go through one PowerShell command: Start-Process -Verb RunAs for the fix, then the game.
// The game starts only after the prompt is answered, so the prompt never hides behind a fullscreen game.
import fs from 'node:fs';
import path from 'node:path';
import { spawn as nodeSpawn, execFile as nodeExecFile } from 'node:child_process';
import * as dirt3Config from './dirt3-config.js';

export const STEAM_APP_ID = 321040; // DiRT 3 Complete Edition
export const FIX_EXE = 'DiRTTelemetryErrorFix.exe';
export const FIX_DOWNLOAD = 'https://github.com/RoccoC/DiRTTelemetryErrorFix/blob/master/bin/DiRTTelemetryErrorFix_Release.zip?raw=true';

/** Folders where we look for the fix – most specific first. */
export function fixCandidates(appDir, env = process.env) {
  const dirs = [];
  if (env.CODRIVER_DIRT3_FIX) dirs.push(env.CODRIVER_DIRT3_FIX);
  dirs.push(path.join(appDir, 'tools', 'DiRTTelemetryErrorFix'), path.join(appDir, 'DiRTTelemetryErrorFix'));
  return dirs.map((d) => (d.toLowerCase().endsWith('.exe') ? d : path.join(d, FIX_EXE)));
}

export function findFix(appDir, env) {
  return fixCandidates(appDir, env).find((p) => fs.existsSync(p)) ?? null;
}

/** The folder we suggest for extracting the fix. */
export const suggestedFixDir = (appDir) => path.join(appDir, 'tools', 'DiRTTelemetryErrorFix');

/** How long the fix waits for the game: a cold Steam start plus the game's own start can exceed its default 30 s. */
export const FIX_TIMEOUT_S = 180;

/**
 * Raises the `timeout` in the fix's .exe.config to at least `seconds`. Returns the timeout in effect,
 * or null when the config is missing or unreadable (the fix then keeps its own default).
 */
export function ensureFixTimeout(fix, seconds = FIX_TIMEOUT_S) {
  const file = `${fix}.config`;
  try {
    const xml = fs.readFileSync(file, 'utf8');
    const re = /(<add\s+key="timeout"\s+value=")(\d+)(")/;
    const m = xml.match(re);
    if (!m) return null;
    if (Number(m[2]) >= seconds) return Number(m[2]);
    fs.writeFileSync(file, xml.replace(re, `$1${seconds}$3`));
    return seconds;
  } catch {
    return null;
  }
}

/** Single-quoted PowerShell string. */
export const psQuote = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** PowerShell command that starts the fix elevated (UAC prompt). */
export function elevateScript(fix) {
  return `Start-Process -FilePath ${psQuote(fix)} -ArgumentList '-silent' -WorkingDirectory ${psQuote(path.dirname(fix))} -Verb RunAs -WindowStyle Hidden`;
}

/** Is this process running as administrator? `net session` succeeds only with admin rights. */
export function isElevated({ execFile = nodeExecFile, platform = process.platform } = {}) {
  if (platform !== 'win32') return Promise.resolve(false);
  return new Promise((resolve) => {
    const child = execFile('net', ['session'], { windowsHide: true }, (err) => resolve(!err));
    child?.on?.('error', () => resolve(false));
  });
}

/** Image names (lower case) from `tasklist /FO CSV /NH` output. */
export function parseTasklist(out) {
  return new Set(String(out).split(/\r?\n/).map((l) => l.match(/^"([^"]+)"/)?.[1]?.toLowerCase()).filter(Boolean));
}

/** Are the game and the fix running right now? null when it can't be checked. */
export function runningState({ execFile = nodeExecFile, platform = process.platform } = {}) {
  if (platform !== 'win32') return Promise.resolve(null);
  return new Promise((resolve) => {
    const child = execFile('tasklist', ['/FO', 'CSV', '/NH'], { windowsHide: true, maxBuffer: 4 << 20 }, (err, out) => {
      if (err) return resolve(null);
      const names = parseTasklist(out);
      resolve({ game: names.has('dirt3_game.exe'), fix: names.has(FIX_EXE.toLowerCase()) });
    });
    child?.on?.('error', () => resolve(null));
  });
}

/**
 * @param {object} o
 * @param {string} o.appDir      codriver folder (the repo, or the folder containing codriver.exe)
 * @param {number} [o.udpPort]
 * @param {boolean} [o.elevated] codriver runs as administrator – start the fix directly
 * @param {Function} [o.spawn]   for tests
 * @param {string} [o.platform]  for tests
 * @returns {{ telemetry: object|null, display: object|null, fix: string|null, fixPrompt: boolean, game: boolean }}
 */
export function launchDirt3({ appDir, udpPort = 20777, elevated = false, spawn = nodeSpawn, platform = process.platform, configFile = dirt3Config.findConfig() }) {
  if (platform !== 'win32') throw new Error('Launching the game only works on Windows.');

  // 1. telemetry and fullscreen in the game settings (the game reads them at startup). The game saves its
  //    display mode on exit and sometimes falls back to a window (e.g. after losing focus during startup),
  //    so fullscreen is set again on every launch.
  const applied = configFile ? dirt3Config.applyToFile(configFile, true, udpPort, { fullscreen: true }) : null;
  const telemetry = applied?.motion ?? null;

  // An error from a child process must never take the server down.
  const opts = { detached: true, stdio: 'ignore', windowsHide: true };
  const start = (cmd, args, o = opts) => {
    const child = spawn(cmd, args, o);
    child.on?.('error', () => {});
    child.unref?.();
  };

  // 2. the fix – it waits for the game process, so it may start before or after the game
  const fix = findFix(appDir);
  if (fix) {
    ensureFixTimeout(fix);
    if (elevated) start(fix, ['-silent'], { ...opts, cwd: path.dirname(fix) });
    else start('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', elevateScript(fix)]);
  }

  // 3. the game via Steam – right away, never waiting for the fix
  start('cmd', ['/c', 'start', '', `steam://rungameid/${STEAM_APP_ID}`]);

  return { telemetry, display: applied?.display ?? null, fix, fixPrompt: !!fix && !elevated, game: true };
}
