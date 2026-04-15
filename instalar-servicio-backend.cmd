@echo off
setlocal EnableExtensions

cd /d "%~dp0"
if errorlevel 1 (
  echo No se pudo entrar al directorio del proyecto.
  pause
  exit /b 1
)

echo ==========================================
echo Instalando servicio del backend: FatboyPOSBackend
echo Usando el instalador actual del backend
echo ==========================================
echo.

call npm --prefix backend run build
if errorlevel 1 (
  echo Fallo la compilacion del backend.
  pause
  exit /b 1
)

echo.
call npm --prefix backend run service:install
set "EXIT_CODE=%errorlevel%"

echo.
call npm --prefix backend run service:status

echo.
if not "%EXIT_CODE%"=="0" (
  echo La instalacion o el arranque del servicio devolvio codigo %EXIT_CODE%.
  echo Si ves "Access is denied", abre esta terminal como Administrador y vuelve a ejecutar este script.
  pause
  exit /b %EXIT_CODE%
)

echo Proceso terminado correctamente.
pause
exit /b 0
