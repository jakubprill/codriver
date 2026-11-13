#!/usr/bin/env node
// codriver – telemetria z gry (UDP) -> dashboard w przeglądarce (SSE).
// Działa na Node.js >= 18 i na Bun, bez żadnych zależności.
//
//   node src/main.js [--udp 20777] [--http 8080] [--open]
import dgram from 'node:dgram';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import codemasters from './games/codemasters.js';
import { TelemetryState } from './telemetry.js';
import { createHttpServer } from './server/http.js';

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

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i > 0 && process.argv[i + 1]) return process.argv[i + 1];
  return process.env[`CODRIVER_${name.toUpperCase()}`] ?? fallback;
}

const game = codemasters;
const UDP_PORT = Number(arg('udp', game.defaultPort));
const HTTP_PORT = Number(arg('http', 8080));

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

// --- HTTP ---
const { server, clients } = createHttpServer({ publicDir: path.join(here, '..', 'public'), assets, state });
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`\nPort HTTP ${HTTP_PORT} jest zajęty – codriver chyba już działa.\n`);
  else console.error('Błąd HTTP:', e);
  process.exit(1);
});
server.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`codriver ${VERSION} – ${game.name}: UDP :${UDP_PORT} -> http :${HTTP_PORT}\n`);
  console.log(`  Ten komputer:    http://localhost:${HTTP_PORT}`);
  for (const addr of lanAddresses()) console.log(`  Telefon/tablet:  http://${addr}:${HTTP_PORT}`);
  console.log('\nStatus jest w tytule okna. Ctrl+C kończy.\n');
  if (process.argv.includes('--open')) openBrowser(`http://localhost:${HTTP_PORT}`);
});

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

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}
