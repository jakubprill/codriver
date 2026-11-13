// HTTP: pliki z public/, strumień ramek przez Server-Sent Events, status w JSON.
// SSE zamiast WebSocketów: ruch jest jednokierunkowy, a SSE działa w każdej przeglądarce
// i w czystym Node/Bun bez bibliotek.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

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
 */
export function createHttpServer({ publicDir, assets = null, state, info = () => ({}), sendHz = 30 }) {
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
