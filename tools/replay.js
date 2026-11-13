#!/usr/bin/env node
// Odtwarza nagranie CSV (z tools/udp-listen.ps1) jako pakiety UDP – test dashboardu bez gry.
//
//   node tools/replay.js test/fixtures/dirt3-2026-11-13.csv [--port 20777] [--loop]
import fs from 'node:fs';
import dgram from 'node:dgram';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a));
const portIdx = args.indexOf('--port');
const port = Number(portIdx >= 0 ? args[portIdx + 1] : 20777);
const loop = args.includes('--loop');
if (!file) {
  console.log('Użycie: node tools/replay.js plik.csv [--port 20777] [--loop]');
  process.exit(1);
}

export function readRecording(path) {
  const lines = fs.readFileSync(path, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  const width = lines[0].split(';').length;
  return lines.slice(1)
    .map((l) => l.split(';'))
    .filter((r) => r.length === width)
    .map((r) => ({ tMs: Number(r[0]), floats: r.slice(2).map(Number) }));
}

const rows = readRecording(file);
console.log(`${rows.length} pakietów -> udp 127.0.0.1:${port}${loop ? ' (w pętli)' : ''}`);

const sock = dgram.createSocket('udp4');
function play() {
  const t0 = Date.now();
  const r0 = rows[0].tMs;
  let i = 0;
  (function tick() {
    const elapsed = Date.now() - t0;
    while (i < rows.length && rows[i].tMs - r0 <= elapsed) {
      const buf = Buffer.alloc(rows[i].floats.length * 4);
      rows[i].floats.forEach((v, k) => buf.writeFloatLE(v, k * 4));
      sock.send(buf, port, '127.0.0.1');
      i++;
    }
    if (i < rows.length) setTimeout(tick, 4);
    else if (loop) setTimeout(play, 2000);
    else setTimeout(() => sock.close(), 100);
  })();
}
play();
