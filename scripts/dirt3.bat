@echo off
title codriver + DiRT 3
cd /d "%~dp0.."
where bun >nul 2>nul && (bun src/main.js --launch-dirt3 --open & goto end)
where node >nul 2>nul && (node src/main.js --launch-dirt3 --open & goto end)
echo Neither Bun nor Node.js was found. Install one: scoop install bun
:end
pause
