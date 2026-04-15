@echo off
setlocal

set "ROOT=%~dp0"

echo Iniciando backend de FATBOY POS...
echo.

set "LOG=%ROOT%backend-dev.log"
if exist "%LOG%" del "%LOG%"

start "FATBOY Backend" cmd /c "cd /d "%ROOT%backend" && npm run start:dev > "%LOG%" 2>&1"

echo Se abrio una ventana:
echo - Backend
echo.
echo Puedes cerrar esta ventana.

endlocal
