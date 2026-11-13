// Uruchamianie DiRT 3 jednym przyciskiem: telemetria włączona, poprawka błędu 10038, gra przez Steam.
//
// Poprawka to DiRTTelemetryErrorFix (MIT, https://github.com/RoccoC/DiRTTelemetryErrorFix).
// codriver jej nie zawiera ani nie przepisuje – wstrzykuje ona natywny kod do procesu gry,
// a my tylko ją uruchamiamy, jeśli leży w jednym ze znanych folderów (findFix).
// Po starcie czeka do 30 s na proces gry i sama się zamyka po wyjściu z gry.
import fs from 'node:fs';
import path from 'node:path';
import { spawn as nodeSpawn } from 'node:child_process';
import * as dirt3Config from './dirt3-config.js';

export const STEAM_APP_ID = 321040; // DiRT 3 Complete Edition
export const FIX_EXE = 'DiRTTelemetryErrorFix.exe';
export const FIX_DOWNLOAD = 'https://github.com/RoccoC/DiRTTelemetryErrorFix/blob/master/bin/DiRTTelemetryErrorFix_Release.zip?raw=true';

/** Foldery, w których szukamy poprawki – od najbardziej konkretnego. */
export function fixCandidates(appDir, env = process.env) {
  const dirs = [];
  if (env.CODRIVER_DIRT3_FIX) dirs.push(env.CODRIVER_DIRT3_FIX);
  dirs.push(path.join(appDir, 'tools', 'DiRTTelemetryErrorFix'), path.join(appDir, 'DiRTTelemetryErrorFix'));
  return dirs.map((d) => (d.toLowerCase().endsWith('.exe') ? d : path.join(d, FIX_EXE)));
}

export function findFix(appDir, env) {
  return fixCandidates(appDir, env).find((p) => fs.existsSync(p)) ?? null;
}

/** Miejsce, które podpowiadamy użytkownikowi do rozpakowania poprawki. */
export const suggestedFixDir = (appDir) => path.join(appDir, 'tools', 'DiRTTelemetryErrorFix');

/**
 * @param {object} o
 * @param {string} o.appDir      folder codrivera (repo albo folder z codriver.exe)
 * @param {number} [o.udpPort]
 * @param {Function} [o.spawn]   do testów
 * @param {string} [o.platform]  do testów
 * @returns {{ telemetry: object|null, fix: string|null, game: boolean }}
 */
export function launchDirt3({ appDir, udpPort = 20777, spawn = nodeSpawn, platform = process.platform, configFile = dirt3Config.findConfig() }) {
  if (platform !== 'win32') throw new Error('Uruchamianie gry działa tylko na Windowsie.');

  // 1. telemetria w ustawieniach gry (gra czyta je przy starcie)
  const telemetry = configFile ? dirt3Config.applyToFile(configFile, true, udpPort).motion : null;

  // 2. poprawka – przed grą, bo czeka na jej proces
  const fix = findFix(appDir);
  if (fix) {
    spawn(fix, ['-silent'], { cwd: path.dirname(fix), detached: true, stdio: 'ignore' }).unref();
  }

  // 3. gra przez Steam
  spawn('cmd', ['/c', 'start', '', `steam://rungameid/${STEAM_APP_ID}`], { detached: true, stdio: 'ignore', windowsHide: true }).unref();

  return { telemetry, fix, game: true };
}
