#!/usr/bin/env node
// codriver – game telemetry (UDP) -> dashboard in the browser (SSE).
// Runs on Node.js >= 18 and on Bun, with no dependencies.
//
//   node src/main.js [--udp 20777] [--http 80] [--name codriver] [--open | --no-open]
//   node src/main.js --telemetry on|off|status   – telemetry in the DiRT 3 settings, without starting the server
//   node src/main.js --launch-dirt3              – also starts the error-10038 fix and the game
//
// Without --http it tries port 80 (an address with no port: http://codriver.local), and 8080 if that is taken.
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

// In the .exe the UI is embedded (scripts/build.js); in development we read public/.
let assets = null;
try {
  assets = (await import('./assets.gen.js')).default;
} catch {
  /* missing = development mode */
}
// App folder: the folder of the .exe, or the repository root in development.
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

// --- one-shot mode: the in-game telemetry switch ---
const telemetryArg = arg('telemetry');
if (telemetryArg) {
  process.exit(telemetryCommand(telemetryArg));
}

function telemetryCommand(cmd) {
  const file = dirt3Config.findConfig();
  if (!file) {
    console.error('DiRT 3 settings file not found (Documents\\My Games\\DiRT3\\hardwaresettings). Start the game once.');
    return 1;
  }
  if (cmd === 'on' || cmd === 'off') dirt3Config.applyToFile(file, cmd === 'on', UDP_PORT);
  else if (cmd !== 'status') { console.error('Usage: --telemetry on|off|status'); return 1; }
  const st = dirt3Config.status(UDP_PORT, file);
  console.log(`${st.path}\nTelemetry: ${st.motion?.enabled ? 'on' : 'off'}${st.ready ? ' (ready for codriver)' : ''}`);
  if (cmd !== 'status') console.log('The change takes effect the next time the game starts.');
  return 0;
}

if (process.argv.includes('--launch-dirt3')) {
  try {
    const r = launchDirt3({ appDir, udpPort: UDP_PORT });
    console.log(`Telemetry: ${r.telemetry ? 'on' : 'game settings not found'}`);
    console.log(r.fix ? `Error-10038 fix: ${r.fix}` : 'Error-10038 fix: not found (docs/telemetry/codemasters.md)');
    console.log('DiRT 3: launching via Steam…');
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
    console.error(`\nUDP port ${UDP_PORT} is busy – another program (or a second codriver) is already using it.\n`);
  } else {
    console.error('UDP error:', e);
  }
  process.exit(1);
});
udp.bind(UDP_PORT, '0.0.0.0');

// --- addresses for the phone ---
let httpPort = HTTP_PORTS[0];
let mdns = { ok: false };
const withPort = (host) => `http://${host}${httpPort === 80 ? '' : `:${httpPort}`}`;
/** Addresses where codriver is reachable on the network. IPs first – they work on every phone. */
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
    if (e.code === 'EADDRINUSE') console.error(`\nHTTP port ${port} is busy – codriver is probably already running.\n`);
    else console.error('HTTP error:', e);
    process.exit(1);
  });
  server.listen(port, '0.0.0.0', onListening);
}

async function onListening() {
  mdns = await startMdns(HOSTNAME);
  const { urls, name } = addresses();
  console.log(`codriver ${VERSION} – ${game.name}: UDP :${UDP_PORT} -> http :${httpPort}\n`);
  console.log(`  This computer:   ${withPort('localhost')}`);
  if (name) console.log(`  Phone/tablet:    ${name}`);
  for (const u of urls) console.log(`  ${name ? 'or:             ' : 'Phone/tablet:   '} ${u}`);
  if (urls[0]) {
    console.log('\nScan with your phone camera:\n');
    console.log(qrTerminal(urls[0]));
  }
  console.log('\nStatus is shown in the window title. Ctrl+C quits.\n');
  // the .exe opens the panel on its own (double-click); from source only with --open
  const open = process.argv.includes('--open') || (assets && !process.argv.includes('--no-open'));
  if (open) openBrowser(withPort('localhost'));
}

listen(HTTP_PORTS);

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  import('node:child_process').then(({ spawn }) => spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref());
}

// Status goes to the window title, not the console body: writing to a Windows console in selection
// mode (after a click into the window) pauses the whole process, while changing the title does not.
setInterval(() => {
  const s = state.status();
  const ago = s.lastPacketAgoMs == null ? 'none' : `${Math.round(s.lastPacketAgoMs / 1000)} s ago`;
  process.title = `codriver | packets: ${s.packets} | last: ${ago} | screens: ${clients.size}`;
}, 1000);
