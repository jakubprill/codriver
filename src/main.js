#!/usr/bin/env node
// codriver – telemetria z gry (UDP) -> dashboard w przeglądarce (SSE).
// Działa na Node.js >= 18 i na Bun, bez żadnych zależności.
//
//   node src/main.js [--udp 20777] [--http 80] [--name codriver] [--open]
//   node src/main.js --telemetry on|off|status   – telemetria w ustawieniach DiRT 3, bez startu serwera
//   node src/main.js --launch-dirt3              – dodatkowo uruchamia poprawkę błędu 10038 i grę
//
// Bez --http próbuje portu 80 (adres bez numeru: http://codriver.local), a gdy jest zajęty – 8080.
import dgram from 'node:dgram';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import codemasters from './games/codemasters.js';
import { TelemetryState } from './telemetry.js';
import { createHttpServer } from './server/http.js';
import { startMdns, lanInterfaces } from './server/mdns.js';
import { qrTerminal } from '../public/lib/qr.js';
import * as dirt3Config from './games/dirt3-config.js';
import { launchDirt3 } from './games/dirt3-launcher.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// eslint-disable-next-line no-undef
const VERSION = typeof CODRIVER_VERSION !== 'undefined' ? CODRIVER_VERSION : 'dev';

// W pliku .exe interfejs jest osadzony (scripts/build.js); w trybie deweloperskim czytamy public/.
let assets = null;
try {
  assets = (await import('./assets.gen.js')).default;
} catch {
  /* brak = tryb deweloperski */
}
// Folder aplikacji: przy pliku .exe – jego folder, w trybie deweloperskim – katalog repozytorium.
const appDir = assets ? path.dirname(process.execPath) : path.resolve(here, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i > 0 && process.argv[i + 1]) return process.argv[i + 1];
  return process.env[`CODRIVER_${name.toUpperCase()}`] ?? fallback;
}

const game = codemasters;
const UDP_PORT = Number(arg('udp', game.defaultPort));
const HTTP_PORTS = arg('http') ? [Number(arg('http'))] : [80, 8080];
const HOSTNAME = `${arg('name', 'codriver')}.local`;

// --- tryb jednorazowy: przełącznik telemetrii w grze ---
const telemetryArg = arg('telemetry');
if (telemetryArg) {
  process.exit(telemetryCommand(telemetryArg));
}

function telemetryCommand(cmd) {
  const file = dirt3Config.findConfig();
  if (!file) {
    console.error('Nie znaleziono pliku ustawień DiRT 3 (Dokumenty\\My Games\\DiRT3\\hardwaresettings). Uruchom grę raz.');
    return 1;
  }
  if (cmd === 'on' || cmd === 'off') dirt3Config.applyToFile(file, cmd === 'on', UDP_PORT);
  else if (cmd !== 'status') { console.error('Użycie: --telemetry on|off|status'); return 1; }
  const st = dirt3Config.status(UDP_PORT, file);
  console.log(`${st.path}\nTelemetria: ${st.motion?.enabled ? 'włączona' : 'wyłączona'}${st.ready ? ' (gotowa dla codriver)' : ''}`);
  if (cmd !== 'status') console.log('Zmiana zadziała po ponownym uruchomieniu gry.');
  return 0;
}

if (process.argv.includes('--launch-dirt3')) {
  try {
    const r = launchDirt3({ appDir, udpPort: UDP_PORT });
    console.log(`Telemetria: ${r.telemetry ? 'włączona' : 'nie znaleziono ustawień gry'}`);
    console.log(r.fix ? `Poprawka błędu 10038: ${r.fix}` : 'Poprawka błędu 10038: nie znaleziono (docs/telemetry/codemasters.md)');
    console.log('DiRT 3: uruchamiam przez Steam…');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

const state = new TelemetryState();

// --- UDP ---
const udp = dgram.createSocket('udp4');
udp.on('message', (msg) => {
  if (msg.length < game.minPacketBytes) return;
  state.push(game.parse(msg));
});
udp.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\nPort UDP ${UDP_PORT} jest zajęty – inny program (albo drugi codriver) już go używa.\n`);
  } else {
    console.error('Błąd UDP:', e);
  }
  process.exit(1);
});
udp.bind(UDP_PORT, '0.0.0.0');

// --- adresy dla telefonu ---
let httpPort = HTTP_PORTS[0];
let mdns = { ok: false };
const withPort = (host) => `http://${host}${httpPort === 80 ? '' : `:${httpPort}`}`;
/** Adresy, pod którymi widać codriver w sieci. IP najpierw – działa na każdym telefonie. */
function addresses() {
  const ips = lanInterfaces().map((i) => withPort(i.address));
  return { urls: ips, name: mdns.ok ? withPort(HOSTNAME) : null, version: VERSION };
}

// --- HTTP ---
const { server, clients } = createHttpServer({ publicDir: path.join(here, '..', 'public'), assets, state, info: addresses, udpPort: UDP_PORT, appDir });

function listen(ports) {
  const [port, ...rest] = ports;
  httpPort = port;
  server.once('error', (e) => {
    if ((e.code === 'EADDRINUSE' || e.code === 'EACCES') && rest.length) return listen(rest);
    if (e.code === 'EADDRINUSE') console.error(`\nPort HTTP ${port} jest zajęty – codriver chyba już działa.\n`);
    else console.error('Błąd HTTP:', e);
    process.exit(1);
  });
  server.listen(port, '0.0.0.0', onListening);
}

async function onListening() {
  mdns = await startMdns(HOSTNAME);
  const { urls, name } = addresses();
  console.log(`codriver ${VERSION} – ${game.name}: UDP :${UDP_PORT} -> http :${httpPort}\n`);
  console.log(`  Ten komputer:    ${withPort('localhost')}`);
  if (name) console.log(`  Telefon/tablet:  ${name}`);
  for (const u of urls) console.log(`  ${name ? 'albo:           ' : 'Telefon/tablet: '} ${u}`);
  if (urls[0]) {
    console.log('\nZeskanuj aparatem telefonu:\n');
    console.log(qrTerminal(urls[0]));
  }
  console.log('\nStatus jest w tytule okna. Ctrl+C kończy.\n');
  if (process.argv.includes('--open')) openBrowser(withPort('localhost'));
}

listen(HTTP_PORTS);

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  import('node:child_process').then(({ spawn }) => spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref());
}

// Status w tytule okna, nie w treści konsoli: pisanie do konsoli Windows w trybie
// zaznaczania (po kliknięciu w okno) wstrzymuje cały proces, a zmiana tytułu nie.
setInterval(() => {
  const s = state.status();
  const ago = s.lastPacketAgoMs == null ? 'brak' : `${Math.round(s.lastPacketAgoMs / 1000)} s temu`;
  process.title = `codriver | pakiety: ${s.packets} | ostatni: ${ago} | ekrany: ${clients.size}`;
}, 1000);
