@echo off
title codriver
cd /d "%~dp0.."
where bun >nul 2>nul && (bun src/main.js --open & goto end)
where node >nul 2>nul && (node src/main.js --open & goto end)
echo Neither Bun nor Node.js was found. Install one: scoop install bun
:end
pause
