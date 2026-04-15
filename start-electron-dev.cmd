@echo off
setlocal

set "ROOT=%~dp0"
set "LOG=%ROOT%electron-dev.log"

if exist "%LOG%" del "%LOG%"

echo Iniciando Electron en modo desarrollo...
echo.

start "FATBOY Electron Dev" cmd /c "cd /d "%ROOT%" && call run-electron-dev.cmd > "%LOG%" 2>&1"

echo Se abrio una ventana:
echo - Electron Dev
echo.
echo Puedes cerrar esta ventana.

endlocal
