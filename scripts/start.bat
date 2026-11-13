@echo off
title codriver
cd /d "%~dp0.."
where bun >nul 2>nul && (bun src/main.js --open & goto end)
where node >nul 2>nul && (node src/main.js --open & goto end)
echo Nie znaleziono Bun ani Node.js. Zainstaluj: scoop install bun
:end
pause
