@echo off
title codriver replay
cd /d "%~dp0.."
where bun >nul 2>nul && (bun tools/replay.js test/fixtures/dirt3-2026-11-13.csv --loop & goto end)
node tools/replay.js test/fixtures/dirt3-2026-11-13.csv --loop
:end
pause
