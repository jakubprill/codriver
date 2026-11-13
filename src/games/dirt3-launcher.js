// Launching DiRT 3 with one button: telemetry on, the error-10038 fix, the game via Steam.
//
// The fix is DiRTTelemetryErrorFix (MIT, https://github.com/RoccoC/DiRTTelemetryErrorFix).
// codriver neither bundles nor reimplements it – it injects native code into the game process –
// we only start it when it sits in one of the known folders (findFix).
// Once started it waits up to 30 s for the game process and exits on its own when the game closes.
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

  // 2. the fix – before the game, because it waits for the game process
  const fix = findFix(appDir);
  if (fix) {
    spawn(fix, ['-silent'], { cwd: path.dirname(fix), detached: true, stdio: 'ignore' }).unref();
  }

  // 3. the game via Steam
  spawn('cmd', ['/c', 'start', '', `steam://rungameid/${STEAM_APP_ID}`], { detached: true, stdio: 'ignore', windowsHide: true }).unref();

  return { telemetry, fix, game: true };
}
