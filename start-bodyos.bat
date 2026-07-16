@echo off
setlocal
cd /d "%~dp0"
title BodyOS v3.9 Server

rem Stop only the process currently listening on port 3000, so an old BodyOS cannot be opened by mistake.
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /PID %%P /F >nul 2>&1
)

timeout /t 1 /nobreak >nul

if not exist node_modules\qrcode (
  echo Installing required files...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo Installation failed.
    pause
    exit /b 1
  )
)

start "" "http://localhost:3000/?v=39"
node server.js

echo.
echo BodyOS stopped.
pause
