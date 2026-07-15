@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules\qrcode (
  echo 初回準備をしています。インターネット接続が必要です。
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install に失敗しました。Node.js とインターネット接続を確認してください。
    pause
    exit /b 1
  )
)
start "" http://localhost:3000/
npm start
pause
