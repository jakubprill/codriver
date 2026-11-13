# Codemasters telemetry (DiRT 3, DiRT Rally)

Codemasters games send a UDP packet containing an array of little-endian `float32` values.

## Enabling it

`Documents\My Games\<game>\hardwaresettings\hardware_settings_config.xml` (with OneDrive: `OneDrive\Documents\…`, on a Polish
system `Dokumenty`):

```xml
<motion enabled="true" ip="127.0.0.1" port="20777" delay="1" extradata="3" />
```

- By default the game has `ip="dbox"` (D-Box hardware) and `extradata="0"` – this has to change.
- The file is sometimes marked read-only so the game doesn't overwrite it: clear the flag, edit, set it again if you like.
  codriver does this for you (`codriver --telemetry on|off|status`, or the DiRT 3 card in the panel).
- The game sends data only while driving, not in menus.

## Known DiRT 3 Complete Edition bug: “sendto failed with error 10038”

With telemetry enabled, DiRT 3 Complete Edition (the Steamworks version) may show
“sendto failed with error 10038: An operation was attempted on something that is not a socket”
after every stage and hang. This is a game bug (it sends data through a socket it has already closed), not a codriver bug –
it happens without codriver too.

What to do about it:

1. **Turn telemetry off when you play without the dashboard.** On the PC: codriver panel → **DiRT 3** card →
   “Wyłącz telemetrię” (turn off), or `codriver --telemetry off` (`on` enables it, `status` shows the state).
   The change applies from the next game launch; the first change creates a `hardware_settings_config.xml.codriver-backup` copy.
2. **Community fix [DiRTTelemetryErrorFix](https://github.com/RoccoC/DiRTTelemetryErrorFix)** (MIT, also recommended by SimHub).
   It injects the EasyHook library into the game process and wraps `sendto`: when the game gets error 10038,
   the fix returns a normal result instead. It waits up to 30 s for the game to start and exits on its own when the game closes.

   **With codriver:** download [DiRTTelemetryErrorFix_Release.zip](https://github.com/RoccoC/DiRTTelemetryErrorFix/blob/master/bin/DiRTTelemetryErrorFix_Release.zip?raw=true)
   and extract it to `tools\DiRTTelemetryErrorFix` in the codriver folder (with `codriver.exe`: to a `DiRTTelemetryErrorFix`
   folder next to the file, or point to it with the `CODRIVER_DIRT3_FIX` environment variable). Then the **“Uruchom DiRT 3”**
   (Launch DiRT 3) button in the panel – or `codriver --launch-dirt3` – enables telemetry, starts the fix and launches the game via Steam.

   Why codriver doesn't fix this itself: the error happens inside the game's code, before the data leaves the PC.
   Fixing it requires injecting native code into the game process – that doesn't fit a lightweight, dependency-free app,
   so codriver relies on the existing, proven fix.

DiRT Rally does not have this bug.

## DiRT 3 – verified on 2026-11-13

Packet: **152 bytes = 38 fields**, about 170 packets per second. `extradata=3` adds no fields (no max RPM).
Recording: `test/fixtures/dirt3-2026-11-13.csv` (every 12th packet of a 30 s drive, automatic gearbox, gears 1–4).

| Index | Field | Unit / notes |
|---|---|---|
| 0 | game time | s |
| 1 | lap/stage time | s |
| 2 | lap distance | m |
| 3 | total distance | |
| 4–6 | position x, y, z | m |
| **7** | **speed** | m/s (×3.6 = km/h) |
| 8–10 | velocity x, y, z | m/s |
| 11–16 | roll and pitch vectors | |
| 17–20 | suspension position | |
| 21–24 | suspension velocity | |
| 25–28 | wheel speed | m/s |
| **29** | **throttle** | 0..1 |
| 30 | steering | −1..1 |
| **31** | **brake** | 0..1 |
| 32 | clutch | 0..1 |
| **33** | **gear** | 1..n; neutral and reverse not verified yet |
| 34 | lateral g-force | g; may be −inf at the start |
| 35 | longitudinal g-force | g; may be −inf at the start |
| 36 | lap | |
| **37** | **engine rate** | **rad/s** (×60/2π = RPM); 125.66 = 1200 RPM at idle |

Cross-check: the automatic gearbox shifts at ~6400 RPM, the limiter is at 6583 RPM,
and the RPM-to-speed ratio drops with every gear (70 → 26 → 18 → 13 rad/s per m/s).

## DiRT Rally – to be verified in practice

Same layout for the first 38 fields; with `extradata=3` the packet has **264 bytes = 66 fields**. Differences according to community notes:

| Index | Field | Notes |
|---|---|---|
| 37 | engine rate | **RPM ÷ 10** (unlike DiRT 3) |
| 63 | max RPM | RPM ÷ 10 |
| 64 | idle RPM | RPM ÷ 10 |
| 65 | number of gears | |
| 33 | gear | reverse = 10 |

The parser detects DiRT Rally by packet length (≥ 64 fields). To do: a recorded drive
(`tools/udp-listen.ps1`) and a test based on it, as for DiRT 3.
