@echo off
echo Starting Letra...
echo.

REM Start CLI server in background
start "Letra CLI Server" cmd /c "node packages\cli\dist\index.js flow serve"

REM Wait for CLI server
timeout /t 3 /nobreak >nul

REM Start Vite dev server
cd packages\client
call npm run dev
