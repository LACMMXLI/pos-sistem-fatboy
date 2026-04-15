@echo off
setlocal

set "ROOT=%~dp0"

echo Iniciando servidores de FATBOY POS...
echo.

start "FATBOY Backend" cmd /k "cd /d "%ROOT%backend" && npm run start:dev"
start "FATBOY Frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

echo Se abrieron dos ventanas:
echo - Backend
echo - Frontend
echo.
echo Puedes cerrar esta ventana.

endlocal
