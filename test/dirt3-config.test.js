// Przełącznik telemetrii w ustawieniach DiRT 3 – na prawdziwym pliku z gry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readMotion, setMotion, isCodriverReady, applyToFile, candidatePaths, findConfig } from '../src/games/dirt3-config.js';

const fixture = fs.readFileSync(new URL('./fixtures/dirt3-hardware_settings_config.xml', import.meta.url), 'utf8');

test('odczyt linii motion z pliku gry', () => {
  assert.deepEqual(readMotion(fixture), { enabled: true, ip: '127.0.0.1', port: 20777, extradata: 3, delay: 1 });
  assert.ok(isCodriverReady(readMotion(fixture)));
});

test('wyłączenie zmienia tylko atrybut enabled, reszta pliku zostaje', () => {
  const off = setMotion(fixture, false);
  assert.equal(readMotion(off).enabled, false);
  assert.equal(readMotion(off).ip, '127.0.0.1');
  assert.equal(off.replace(/enabled="false" ip/, 'enabled="true" ip'), fixture);
});

test('włączenie ustawia adres i port codrivera, nawet z ustawień D-Box', () => {
  const dbox = fixture.replace(/<motion[^>]*\/>/, '<motion enabled="true" ip="dbox" port="20777" delay="1" extradata="0" />');
  assert.equal(isCodriverReady(readMotion(dbox)), false);
  const on = setMotion(dbox, true);
  assert.ok(isCodriverReady(readMotion(on)));
  assert.equal(readMotion(on).extradata, 3);
});

test('zapis do pliku: kopia zapasowa raz, atrybut tylko do odczytu zachowany', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codriver-'));
  const file = path.join(dir, 'hardware_settings_config.xml');
  fs.writeFileSync(file, fixture);
  fs.chmodSync(file, 0o444);
  applyToFile(file, false);
  assert.equal(readMotion(fs.readFileSync(file, 'utf8')).enabled, false);
  assert.equal(fs.statSync(file).mode & 0o200, 0, 'nadal tylko do odczytu');
  assert.equal(fs.readFileSync(`${file}.codriver-backup`, 'utf8'), fixture);
  applyToFile(file, true);
  assert.equal(fs.readFileSync(`${file}.codriver-backup`, 'utf8'), fixture, 'kopia nie jest nadpisywana');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('plik jest szukany także w Dokumentach przeniesionych do OneDrive', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  const file = path.join(home, 'OneDrive', 'Dokumenty', 'My Games', 'DiRT3', 'hardwaresettings', 'hardware_settings_config.xml');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, fixture);
  assert.ok(candidatePaths(home).includes(file));
  assert.equal(findConfig(home), file);
  fs.rmSync(home, { recursive: true, force: true });
});
