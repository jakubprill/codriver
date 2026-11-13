// Włączanie i wyłączanie telemetrii w pliku ustawień DiRT 3.
//
// DiRT 3 Complete Edition z włączoną telemetrią potrafi wyrzucić błąd
// "sendto failed with error 10038" na mecie (znany błąd gry). Dlatego telemetrię
// warto włączać tylko na czas jazdy z dashboardem – albo używać poprawki
// DiRTTelemetryErrorFix (docs/telemetry/codemasters.md).
//
// Gra czyta plik przy starcie i może go nadpisać przy wyjściu, więc zmiany robimy
// przy zamkniętej grze; zaczynają działać od następnego uruchomienia.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const RELATIVE = ['My Games', 'DiRT3', 'hardwaresettings', 'hardware_settings_config.xml'];
const MOTION_RE = /<motion\b[^>]*\/>/;

/** Możliwe położenia pliku: zwykłe Dokumenty i Dokumenty przeniesione do OneDrive. */
export function candidatePaths(home = os.homedir()) {
  const docs = ['Documents', 'Dokumenty'];
  const roots = [home];
  try {
    for (const e of fs.readdirSync(home, { withFileTypes: true })) {
      if (e.isDirectory() && /^OneDrive/i.test(e.name)) roots.push(path.join(home, e.name));
    }
  } catch { /* brak katalogu domowego */ }
  return roots.flatMap((r) => docs.map((d) => path.join(r, d, ...RELATIVE)));
}

export function findConfig(home) {
  return candidatePaths(home).find((p) => fs.existsSync(p)) ?? null;
}

/** Atrybuty linii <motion .../> albo null. */
export function readMotion(xml) {
  const m = xml.match(MOTION_RE);
  if (!m) return null;
  const attrs = {};
  for (const [, k, v] of m[0].matchAll(/(\w+)="([^"]*)"/g)) attrs[k] = v;
  return {
    enabled: attrs.enabled === 'true',
    ip: attrs.ip ?? '',
    port: Number(attrs.port),
    extradata: Number(attrs.extradata),
    delay: Number(attrs.delay),
  };
}

/** Czy ustawienia wysyłają dane tam, gdzie słucha codriver. */
export function isCodriverReady(motion, port = 20777) {
  return !!motion && motion.enabled && motion.ip === '127.0.0.1' && motion.port === port;
}

/** Nowa treść pliku z włączoną (pod codriver) albo wyłączoną telemetrią. Reszta pliku bez zmian. */
export function setMotion(xml, enabled, port = 20777) {
  if (!MOTION_RE.test(xml)) throw new Error('W pliku nie ma linii <motion .../>');
  const line = enabled
    ? `<motion enabled="true" ip="127.0.0.1" port="${port}" delay="1" extradata="3" />`
    : xml.match(MOTION_RE)[0].replace(/enabled="[^"]*"/, 'enabled="false"');
  return xml.replace(MOTION_RE, line);
}

/**
 * Zapisuje zmianę w pliku. Przy pierwszej zmianie robi kopię `.codriver-backup`.
 * Atrybut „tylko do odczytu” zdejmuje na czas zapisu i przywraca.
 * @returns {{ path: string, motion: object }}
 */
export function applyToFile(file, enabled, port = 20777) {
  const xml = fs.readFileSync(file, 'utf8');
  const next = setMotion(xml, enabled, port);
  const backup = `${file}.codriver-backup`;
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
  const readOnly = (fs.statSync(file).mode & 0o200) === 0;
  if (readOnly) fs.chmodSync(file, 0o666);
  try {
    if (next !== xml) fs.writeFileSync(file, next);
  } finally {
    if (readOnly) fs.chmodSync(file, 0o444);
  }
  return { path: file, motion: readMotion(next) };
}

/** Stan dla interfejsu. */
export function status(port = 20777, file = findConfig()) {
  if (!file) return { found: false };
  const motion = readMotion(fs.readFileSync(file, 'utf8'));
  return { found: true, path: file, motion, ready: isCodriverReady(motion, port) };
}
