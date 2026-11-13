// HTTP: files from public/, a frame stream via Server-Sent Events, status as JSON.
// SSE instead of WebSockets: traffic is one-way, and SSE works in every browser
// and in plain Node/Bun without libraries.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import * as dirt3Config from '../games/dirt3-config.js';
import * as dirt3Launcher from '../games/dirt3-launcher.js';
import { lanInterfaces } from './mdns.js';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/**
 * @param {object} o
 * @param {string} o.publicDir  UI folder (development mode)
 * @param {Record<string,string>|null} o.assets  embedded files: URL path -> path inside the .exe
 * @param {() => object} [o.info]  network addresses to display (QR code)
 * @param {number} [o.udpPort]  the port the game should send data to
 * @param {string} [o.appDir]  codriver folder (where we look for the DiRT 3 fix)
 */
export function createHttpServer({ publicDir, assets = null, state, info = () => ({}), udpPort = 20777, appDir = '.', sendHz = 30 }) {
  const clients = new Set();
  const root = path.resolve(publicDir);

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');

    if (url.pathname === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write('retry: 1000\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    if (url.pathname === '/api/dirt3/telemetry') {
      handleTelemetry(req, res, udpPort, appDir);
      return;
    }

    if (url.pathname === '/api/dirt3/launch') {
      handleLaunch(req, res, udpPort, appDir);
      return;
    }

    if (url.pathname === '/info') {
      res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify({ ...info(), local: isLoopback(req.socket.remoteAddress) }));
      return;
    }

    if (url.pathname === '/status') {
      res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify({ ...state.status(), screens: clients.size, frame: state.snapshot() }));
      return;
    }

    // static files
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    let file;
    if (assets) {
      file = assets[rel];
      if (!file) { res.writeHead(404); res.end('Not found'); return; }
    } else {
      file = path.resolve(root, '.' + rel);
      if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(rel)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    });
  });

  const timer = setInterval(() => {
    if (!clients.size) return;
    const msg = `data: ${JSON.stringify(state.snapshot())}\n\n`;
    for (const c of clients) c.write(msg);
  }, 1000 / sendHz);
  server.on('close', () => clearInterval(timer));

  return { server, clients };
}

/**
 * Whether the request came from this same machine – also when the page is opened via the IP address
 * or codriver.local (then the sender's address is the machine's own interface address, not 127.0.0.1).
 */
function isLoopback(addr = '') {
  const a = addr.replace(/^::ffff:/, '');
  if (a === '127.0.0.1' || a === '::1') return true;
  return lanInterfaces().some((i) => i.address === a);
}

function sendJson(res, code, body) {
  res.writeHead(code, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-cache' });
  res.end(JSON.stringify(body));
}

function fixInfo(appDir) {
  const found = dirt3Launcher.findFix(appDir);
  return { found: !!found, path: found, suggestedDir: dirt3Launcher.suggestedFixDir(appDir), download: dirt3Launcher.FIX_DOWNLOAD };
}

/** POST: enables telemetry, starts the fix (if present) and the game – from this machine only. */
function handleLaunch(req, res, udpPort, appDir) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Only POST is allowed' });
  if (!isLoopback(req.socket.remoteAddress)) {
    return sendJson(res, 403, { error: 'The game can only be launched on the computer running codriver.' });
  }
  try {
    const result = dirt3Launcher.launchDirt3({ appDir, udpPort });
    sendJson(res, 200, { ...result, fixInfo: fixInfo(appDir) });
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
}

/** GET: telemetry state in the DiRT 3 settings. POST {"enabled": bool}: change it – from this machine only. */
function handleTelemetry(req, res, udpPort, appDir) {
  if (req.method === 'GET') return sendJson(res, 200, { ...dirt3Config.status(udpPort), fix: fixInfo(appDir), canLaunch: process.platform === 'win32' });
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Only GET and POST are allowed' });
  if (!isLoopback(req.socket.remoteAddress)) {
    return sendJson(res, 403, { error: 'Game settings can only be changed on the computer running codriver.' });
  }
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 1000) req.destroy(); });
  req.on('end', () => {
    try {
      const { enabled } = JSON.parse(body || '{}');
      if (typeof enabled !== 'boolean') return sendJson(res, 400, { error: 'Send {"enabled": true|false}' });
      const file = dirt3Config.findConfig();
      if (!file) return sendJson(res, 404, { error: 'DiRT 3 settings file not found. Start the game once so it creates it.' });
      dirt3Config.applyToFile(file, enabled, udpPort);
      sendJson(res, 200, { ...dirt3Config.status(udpPort, file), fix: fixInfo(appDir), canLaunch: process.platform === 'win32' });
    } catch (e) {
      sendJson(res, 500, { error: `Could not change the settings: ${e.message}` });
    }
  });
}
