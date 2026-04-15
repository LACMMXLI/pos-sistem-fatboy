@echo off
setlocal

set "ROOT=%~dp0"

echo Iniciando servidor para tabletas...
echo.

start "FATBOY Frontend Tablets" cmd /k "cd /d "%ROOT%frontend" && npm run dev -- --host 0.0.0.0"

echo Se abrio una ventana:
echo - Frontend LAN para tabletas
echo.
echo URL esperada en la red local:
echo - http://192.168.1.185:5173
echo.
echo Puedes cerrar esta ventana.

endlocal
