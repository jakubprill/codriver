# Architektura

```
 gra (DiRT 3)                     komputer z Windowsem                         telefon / tablet / monitor
 ───────────                      ────────────────────                         ──────────────────────────
  UDP 20777  ── pakiet float32 ─▶  src/games/codemasters.js  parse()           public/app.js
  ~170 / s                                │  wspólna ramka (Frame)              ├─ ekran wyboru motywu
                                          ▼                                     └─ dashboard
                                   src/telemetry.js  TelemetryState                  │
                                          │  ostatnia ramka, max obrotów              ▼
                                          ▼                                     public/themes/*.js
                                   src/server/http.js  ── SSE /events 30/s ─▶   create(stage) → update(frame)
                                          └─ pliki public/ (albo osadzone w .exe)
```

## Zasady

- **Bez zależności.** Tylko moduły wbudowane (`node:http`, `node:dgram`, `node:fs`). Kod działa na Bun i Node 18+.
- **Bun pakuje, Node też uruchamia.** `scripts/build.js` kompiluje jeden plik wykonywalny z osadzonym `public/`.
- **Server-Sent Events, nie WebSockety.** Dane płyną w jedną stronę; SSE działa wszędzie bez bibliotek i samo się wznawia.
- **Serwer nie pisze do konsoli w trakcie pracy.** Status jest w tytule okna – klik w konsolę Windows wstrzymałby proces.
- **Gra → wspólna ramka → motyw.** Motywy nie wiedzą, z jakiej gry są dane; gry nie wiedzą, jak dane wyglądają.

## Ramka telemetrii (`Frame`)

Opisana w `src/telemetry.js`. Najważniejsze pola: `speedKmh`, `rpm`, `maxRpm`, `gear` (0 = N, wsteczny < 0 albo ≥ 10),
`throttle`, `brake`, `clutch` (0..1), `gLat`, `gLon`, `lapTime` (s), `lapDistance` (m), `live`.

`maxRpm` pochodzi z gry, jeśli ją podaje (DiRT Rally); inaczej serwer uczy się go z jazdy
i zeruje po 5 s przerwy w danych (nowy odcinek, inne auto).

## Jak dodać grę

1. Nagraj surowe pakiety: `tools/udp-listen.ps1` (PowerShell, bez instalacji) zapisuje CSV.
2. Zmapuj pola: `python tools/analyze-csv.py nagranie.csv` pokazuje zakres każdego indeksu.
3. Dodaj `src/games/<gra>.js` z `parse(buf) → Frame`, `defaultPort`, `minPacketBytes`.
4. Dołóż test w `test/` na kawałku nagrania (`test/fixtures/`).
5. Wybór gry w `src/main.js` (dziś jedna rodzina: Codemasters).

## Jak dodać wygląd

1. Nowy plik `public/themes/<id>.js`:
   ```js
   export default {
     id: 'moj', name: 'Mój', description: 'jedno zdanie do ekranu wyboru',
     create(stage) {            // stage: element 1600×800 px, skalowany do ekranu
       // zbuduj DOM/SVG raz
       return {
         update(frame) { /* ~30 razy na sekundę */ },
         idle(text) { /* brak danych: pokaż komunikat */ },
       };
     },
   };
   ```
2. Dopisz go w `public/themes/index.js`.
3. Strefy obrotów bierz z `ZONES` i `rpmInfo()` w `public/lib/util.js`, żeby lampki zgadzały się między motywami.
4. Podgląd: `?demo&theme=<id>`; zrzut do `docs/screens/`.

## Pliki

| Ścieżka | Co robi |
|---|---|
| `src/main.js` | start: UDP + HTTP, adresy w sieci, `--open`, `--udp`, `--http` |
| `src/games/codemasters.js` | parser pakietów Codemasters (DiRT 3, DiRT Rally) |
| `src/telemetry.js` | stan: ostatnia ramka, nauka max obrotów, `live` |
| `src/server/http.js` | pliki, `/events` (SSE), `/status` (JSON) |
| `public/app.js` | ekran wyboru, dashboard, pełny ekran, zapamiętany motyw |
| `public/lib/` | wspólne: `util.js`, skalowanie planszy `stage.js`, dane pokazowe `demo.js` |
| `public/themes/` | wyglądy |
| `tools/` | nagrywanie (`udp-listen.ps1`), analiza (`analyze-csv.py`), odtwarzanie (`replay.js`) |
| `scripts/` | `build.js` (plik .exe), `start.bat`, `replay.bat` |
| `docs/mockups/` | źródła makiet z płótna projektowego |
