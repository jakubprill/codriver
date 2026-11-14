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
import { spawn as nodeSpawn } from 'node:child_process';
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

/** The PowerShell command that starts the fix (elevated) and then the game via Steam. */
export function launchScript(fix, appId = STEAM_APP_ID) {
  const game = `Start-Process ${psQuote(`steam://rungameid/${appId}`)}`;
  if (!fix) return game;
  // If the user declines the UAC prompt, Start-Process throws – the game still starts.
  return `try { Start-Process -FilePath ${psQuote(fix)} -ArgumentList '-silent' -WorkingDirectory ${psQuote(path.dirname(fix))} -Verb RunAs -WindowStyle Hidden } catch {}; ${game}`;
}

/**
 * @param {object} o
 * @param {string} o.appDir      codriver folder (the repo, or the folder containing codriver.exe)
 * @param {number} [o.udpPort]
 * @param {Function} [o.spawn]   for tests
 * @param {string} [o.platform]  for tests
 * @returns {{ telemetry: object|null, fix: string|null, game: boolean }}
 */
export function launchDirt3({ appDir, udpPort = 20777, spawn = nodeSpawn, platform = process.platform, configFile = dirt3Config.findConfig() }) {
  if (platform !== 'win32') throw new Error('Launching the game only works on Windows.');

  // 1. telemetry in the game settings (the game reads them at startup)
  const telemetry = configFile ? dirt3Config.applyToFile(configFile, true, udpPort).motion : null;

  // 2. the fix (elevated) and 3. the game via Steam – one PowerShell command, in that order
  const fix = findFix(appDir);
  if (fix) ensureFixTimeout(fix);
  const opts = { detached: true, stdio: 'ignore', windowsHide: true };
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', launchScript(fix)], opts);
  // An error from a child process must never take the server down; without PowerShell, start just the game.
  child.on?.('error', () => {
    spawn('cmd', ['/c', 'start', '', `steam://rungameid/${STEAM_APP_ID}`], opts).on?.('error', () => {});
  });
  child.unref();

  return { telemetry, fix, game: true };
}
