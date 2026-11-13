// Testy kodu QR i odpowiedzi mDNS (bez sieci).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeQr, qrSvg } from '../public/lib/qr.js';
import { parseQuestions, buildAnswer } from '../src/server/mdns.js';

test('QR: rozmiar rośnie z długością adresu, wzorce narożne są na miejscu', () => {
  const short = encodeQr('http://192.168.8.126');
  const long = encodeQr('http://192.168.8.126:8080/?theme=papier&demo');
  assert.equal(short.size, 25); // wersja 2
  assert.ok(long.size > short.size);
  for (const { size, modules } of [short, long]) {
    for (const [x, y] of [[0, 0], [size - 7, 0], [0, size - 7]]) {
      assert.equal(modules[y][x], true, 'róg znacznika ciemny');
      assert.equal(modules[y + 1][x + 1], false, 'jasny pierścień');
      assert.equal(modules[y + 3][x + 3], true, 'środek znacznika ciemny');
    }
  }
});

test('QR: zbyt długi tekst daje czytelny błąd, SVG ma viewBox', () => {
  assert.throws(() => encodeQr('x'.repeat(400)), /za długi/);
  assert.match(qrSvg('http://codriver.local'), /^<svg[^>]+viewBox="0 0 \d+ \d+"/);
});

function query(name, type = 1) {
  const labels = name.split('.').map((l) => Buffer.concat([Buffer.from([l.length]), Buffer.from(l)]));
  return Buffer.concat([Buffer.from([0xab, 0xcd, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]), ...labels, Buffer.from([0, 0, type, 0x80, 1])]);
}

test('mDNS: zapytanie o codriver.local jest rozpoznane (bez względu na wielkość liter)', () => {
  const [q] = parseQuestions(query('CoDriver.local'));
  assert.deepEqual(q, { name: 'codriver.local', type: 1, unicast: true });
});

test('mDNS: odpowiedź niesie adres IP i ID pytającego (legacy unicast)', () => {
  const ans = buildAnswer('codriver.local', '192.168.8.126', { id: 0xabcd, question: true });
  assert.equal(ans.readUInt16BE(0), 0xabcd);
  assert.equal(ans.readUInt16BE(2) & 0x8000, 0x8000, 'bit odpowiedzi');
  assert.equal(ans.readUInt16BE(6), 1, 'jeden rekord');
  assert.deepEqual([...ans.subarray(-4)], [192, 168, 8, 126]);
});

test('mDNS: odpowiedzi innych hostów są ignorowane', () => {
  const ans = buildAnswer('inny.local', '10.0.0.1');
  assert.deepEqual(parseQuestions(ans), []);
});
