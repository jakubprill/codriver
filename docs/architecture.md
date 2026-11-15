# Architecture

```
 game (DiRT 3)                    Windows PC                                   phone / tablet / monitor
 ─────────────                    ──────────                                   ────────────────────────
  UDP 20777  ── float32 packet ─▶  src/games/codemasters.js  parse()           public/app.js
  ~170 / s                                │  common frame (Frame)               ├─ panel + theme picker
                                          ▼                                     └─ dashboard
                                   src/telemetry.js  TelemetryState                  │
                                          │  latest frame, max RPM                    ▼
                                          ▼                                     public/themes/*.js
                                   src/server/http.js  ── SSE /events 30/s ─▶   create(stage) → update(frame)
                                          └─ public/ files (or embedded in the .exe)
                                   src/server/mdns.js  ── "codriver.local" ─▶   the phone finds the PC by name
```

## Principles

- **No dependencies.** Built-in modules only (`node:http`, `node:dgram`, `node:fs`). The code runs on Bun and Node 18+.
- **Bun packages, Node runs too.** `scripts/build.js` compiles a single executable with `public/` embedded.
- **Server-Sent Events, not WebSockets.** Data flows one way; SSE works everywhere without libraries and reconnects on its own.
- **The server does not write to the console while running.** Status goes to the window title – clicking into a Windows
  console puts it in selection mode, which pauses any process writing to it.
- **The phone finds the PC without typing an IP.** The server answers mDNS as `codriver.local` (`src/server/mdns.js`),
  tries port 80 (no port in the address; falls back to 8080) and shows a QR code with the IP address –
  in the console and in the panel opened on the PC (`/info`, `public/lib/qr.js`).
- **The panel is for the PC only.** The server decides whether a request comes from the same machine (loopback or one of
  its own interface addresses) – that unlocks the panel, and the endpoints that change game settings or launch the game.
- **Game → common frame → theme.** Themes don't know which game the data came from; games don't know how it is displayed.

## Telemetry frame (`Frame`)

Defined in `src/telemetry.js`. Key fields: `speedKmh`, `rpm`, `maxRpm`, `gear` (0 = N, reverse < 0 or ≥ 10),
`throttle`, `brake`, `clutch` (0..1), `gLat`, `gLon`, `lapTime` (s), `lapDistance` (m), `live`.

`maxRpm` comes from the game when it provides it (DiRT Rally); otherwise the server learns it while driving
and resets it after a 5 s gap in data (new stage, different car).

## Adding a game

1. Record raw packets: `tools/udp-listen.ps1` (PowerShell, nothing to install) writes a CSV.
2. Map the fields: `python tools/analyze-csv.py recording.csv` shows the range of every index.
3. Add `src/games/<game>.js` with `parse(buf) → Frame`, `defaultPort`, `minPacketBytes`.
4. Add a test in `test/` using a slice of the recording (`test/fixtures/`).
5. Select the game in `src/main.js` (today there is one family: Codemasters).

## Adding a look

1. New file `public/themes/<id>.js`:
   ```js
   export default {
     id: 'mine', name: 'Mine', description: 'one sentence for the picker',
     create(stage) {            // stage: a 1600×800 px element, scaled to the screen
       // build the DOM/SVG once
       return {
         update(frame) { /* ~30 times per second */ },
         idle(text) { /* no data: show the message */ },
       };
     },
   };
   ```
2. Register it in `public/themes/index.js`.
3. Take RPM zones from `ZONES` and `rpmInfo()` in `public/lib/util.js` so shift lights match across themes.
   Shared drawing helpers: arcs, ring sectors, ticks and filling strokes in `public/lib/gauge.js`, seven-segment
   digits in `public/lib/seg7.js`, stage statistics worked out on the screen (top speed, average, 0–100 km/h timer,
   speed history) in `public/lib/stats.js`.
4. Preview: `?demo&theme=<id>`; save a screenshot to `docs/screens/`.

## Files

| Path | What it does |
|---|---|
| `src/main.js` | startup: UDP + HTTP + mDNS, QR code in the console, `--open`, `--udp`, `--http`, `--name`, `--telemetry`, `--launch-dirt3` |
| `src/games/codemasters.js` | Codemasters packet parser (DiRT 3, DiRT Rally) |
| `src/games/dirt3-config.js` | turning telemetry on and off in the DiRT 3 settings file (`/api/dirt3/telemetry`, `--telemetry`) |
| `src/games/dirt3-launcher.js` | “Launch DiRT 3”: telemetry + error-10038 fix + start via Steam (`/api/dirt3/launch`, `--launch-dirt3`) |
| `src/telemetry.js` | state: latest frame, learned max RPM, `live` |
| `src/server/http.js` | files, `/events` (SSE), `/status` and `/info` (JSON), DiRT 3 endpoints |
| `src/server/mdns.js` | mDNS answers for `codriver.local` |
| `public/lib/qr.js` | QR code generator (console and SVG), shared by the server and the browser |
| `public/app.js` | panel on the PC, theme picker, dashboard, fullscreen, remembered theme |
| `public/lib/` | shared: `util.js`, stage scaling `stage.js`, sample data `demo.js` |
| `public/themes/` | the looks |
| `tools/` | recording (`udp-listen.ps1`), analysis (`analyze-csv.py`), playback (`replay.js`) |
| `scripts/` | `build.js` (the .exe), `start.bat`, `dirt3.bat`, `replay.bat` |
| `docs/mockups/` | mockup sources from the design canvas |

## Releases

The version lives in `package.json`. To release: bump it, commit, then run **Actions → Release → Run workflow**
on GitHub (or push a `vX.Y.Z` tag). The workflow runs the tests, builds `codriver-vX.Y.Z.exe` and publishes it under Releases.
