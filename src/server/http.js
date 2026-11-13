// HTTP: pliki z public/, strumień ramek przez Server-Sent Events, status w JSON.
// SSE zamiast WebSocketów: ruch jest jednokierunkowy, a SSE działa w każdej przeglądarce
// i w czystym Node/Bun bez bibliotek.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import * as dirt3Config from '../games/dirt3-config.js';
import * as dirt3Launcher from '../games/dirt3-launcher.js';

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
 * @param {string} o.publicDir  katalog z interfejsem (tryb deweloperski)
 * @param {Record<string,string>|null} o.assets  osadzone pliki: ścieżka URL -> ścieżka w pliku .exe
 * @param {() => object} [o.info]  adresy w sieci do wyświetlenia (kod QR)
 * @param {number} [o.udpPort]  port, na który gra ma wysyłać dane
 * @param {string} [o.appDir]  folder codrivera (tu szukamy poprawki DiRT 3)
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
      res.end(JSON.stringify(info()));
      return;
    }

    if (url.pathname === '/status') {
      res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify({ ...state.status(), screens: clients.size, frame: state.snapshot() }));
      return;
    }

    // pliki statyczne
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    let file;
    if (assets) {
      file = assets[rel];
      if (!file) { res.writeHead(404); res.end('Nie ma takiego pliku'); return; }
    } else {
      file = path.resolve(root, '.' + rel);
      if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('Nie ma takiego pliku'); return; }
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

const isLoopback = (addr = '') => addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';

function sendJson(res, code, body) {
  res.writeHead(code, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-cache' });
  res.end(JSON.stringify(body));
}

function fixInfo(appDir) {
  const found = dirt3Launcher.findFix(appDir);
  return { found: !!found, path: found, suggestedDir: dirt3Launcher.suggestedFixDir(appDir), download: dirt3Launcher.FIX_DOWNLOAD };
}

/** POST: włącza telemetrię, uruchamia poprawkę (jeśli jest) i grę – tylko z tego komputera. */
function handleLaunch(req, res, udpPort, appDir) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Dozwolony POST' });
  if (!isLoopback(req.socket.remoteAddress)) {
    return sendJson(res, 403, { error: 'Grę można uruchomić tylko na komputerze, na którym działa codriver.' });
  }
  try {
    const result = dirt3Launcher.launchDirt3({ appDir, udpPort });
    sendJson(res, 200, { ...result, fixInfo: fixInfo(appDir) });
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
}

/** GET: stan telemetrii w ustawieniach DiRT 3. POST {"enabled": bool}: zmiana – tylko z tego komputera. */
function handleTelemetry(req, res, udpPort, appDir) {
  if (req.method === 'GET') return sendJson(res, 200, { ...dirt3Config.status(udpPort), fix: fixInfo(appDir), canLaunch: process.platform === 'win32' });
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Dozwolone GET i POST' });
  if (!isLoopback(req.socket.remoteAddress)) {
    return sendJson(res, 403, { error: 'Ustawienia gry można zmieniać tylko na komputerze, na którym działa codriver.' });
  }
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 1000) req.destroy(); });
  req.on('end', () => {
    try {
      const { enabled } = JSON.parse(body || '{}');
      if (typeof enabled !== 'boolean') return sendJson(res, 400, { error: 'Podaj {"enabled": true|false}' });
      const file = dirt3Config.findConfig();
      if (!file) return sendJson(res, 404, { error: 'Nie znaleziono pliku ustawień DiRT 3. Uruchom grę raz, żeby go utworzyła.' });
      dirt3Config.applyToFile(file, enabled, udpPort);
      sendJson(res, 200, { ...dirt3Config.status(udpPort, file), fix: fixInfo(appDir), canLaunch: process.platform === 'win32' });
    } catch (e) {
      sendJson(res, 500, { error: `Nie udało się zmienić ustawień: ${e.message}` });
    }
  });
}
