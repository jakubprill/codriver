// Turning telemetry on and off in the DiRT 3 settings file.
//
// DiRT 3 Complete Edition with telemetry enabled may throw
// "sendto failed with error 10038" at the finish (a known game bug). So it is worth enabling
// telemetry only while driving with the dashboard – or using the DiRTTelemetryErrorFix
// (docs/telemetry/codemasters.md).
//
// The game reads the file at startup and may overwrite it on exit, so changes are made
// while the game is closed; they take effect from the next launch.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const RELATIVE = ['My Games', 'DiRT3', 'hardwaresettings', 'hardware_settings_config.xml'];
const MOTION_RE = /<motion\b[^>]*\/>/;

/** Possible file locations: regular Documents and Documents moved to OneDrive. */
export function candidatePaths(home = os.homedir()) {
  const docs = ['Documents', 'Dokumenty'];
  const roots = [home];
  try {
    for (const e of fs.readdirSync(home, { withFileTypes: true })) {
      if (e.isDirectory() && /^OneDrive/i.test(e.name)) roots.push(path.join(home, e.name));
    }
  } catch { /* no home directory */ }
  return roots.flatMap((r) => docs.map((d) => path.join(r, d, ...RELATIVE)));
}

export function findConfig(home) {
  return candidatePaths(home).find((p) => fs.existsSync(p)) ?? null;
}

/** Attributes of the <motion .../> line, or null. */
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

/** Whether the settings send data to where codriver listens. */
export function isCodriverReady(motion, port = 20777) {
  return !!motion && motion.enabled && motion.ip === '127.0.0.1' && motion.port === port;
}

/** New file contents with telemetry enabled (for codriver) or disabled. The rest of the file is unchanged. */
export function setMotion(xml, enabled, port = 20777) {
  if (!MOTION_RE.test(xml)) throw new Error('The file has no <motion .../> line');
  const line = enabled
    ? `<motion enabled="true" ip="127.0.0.1" port="${port}" delay="1" extradata="3" />`
    : xml.match(MOTION_RE)[0].replace(/enabled="[^"]*"/, 'enabled="false"');
  return xml.replace(MOTION_RE, line);
}

/**
 * Writes the change to the file. The first change makes a `.codriver-backup` copy.
 * A read-only attribute is cleared for the write and restored afterwards.
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

/** State for the UI. */
export function status(port = 20777, file = findConfig()) {
  if (!file) return { found: false };
  const motion = readMotion(fs.readFileSync(file, 'utf8'));
  return { found: true, path: file, motion, ready: isCodriverReady(motion, port) };
}
