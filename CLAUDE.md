# codriver – notes for agents

- Language: everything that goes into the repository is in English – documentation (README, `docs/`, ADRs, this file),
  commit messages, pull request titles and descriptions, release notes. Conversation with the maintainer may be in Polish.
  The user interface is in Polish for now. Code identifiers are in English.
- Zero npm dependencies. `node:*` modules only; the code must run on Bun and Node 18+ (`node --test` and `bun test` pass).
- Architecture and how to add a game or a look: `docs/architecture.md`. Telemetry field maps: `docs/telemetry/`.
- The server never writes to the console in a loop (status goes to `process.title`) – clicking into a Windows console freezes the process.
- Themes draw on a 1600×800 stage; RPM zones come only from `ZONES`/`rpmInfo()` in `public/lib/util.js`.
- Every new look: an entry in `public/themes/index.js` and a screenshot `docs/screens/<id>.png` (`?demo&theme=<id>`).
- New telemetry field: record a drive and write a test in `test/` against game data first, then the code.
- Endpoints that change game settings or launch programs accept requests from the same machine only (`isLoopback` in `src/server/http.js`).
- Before committing: `bun test` (or `node --test`) and `bun scripts/build.js`.
- Releases: bump `version` in `package.json`, then Actions → Release → Run workflow; the asset is `codriver-vX.Y.Z.exe`.
