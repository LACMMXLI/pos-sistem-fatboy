@echo off
setlocal

set "ROOT=%~dp0"
set "LOG=%ROOT%frontend-dev.log"

if exist "%LOG%" del "%LOG%"

echo Iniciando frontend de FATBOY POS...
echo.

start "FATBOY Frontend" cmd /c "cd /d "%ROOT%frontend" && npm run dev > "%LOG%" 2>&1"

echo Se abrio una ventana:
echo - Frontend
echo.
echo Puedes cerrar esta ventana.

endlocal
