@echo off
cd /d "%~dp0"
powershell -NoProfile -Command "if (Test-NetConnection 127.0.0.1 -Port 3000 -InformationLevel Quiet) { exit 0 } else { exit 1 }"
if %errorlevel%==0 (
  start "" http://localhost:3000/
  exit /b 0
)
start "" http://localhost:3000/
node server.js
pause
