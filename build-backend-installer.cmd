@echo off
setlocal EnableExtensions

cd /d "%~dp0"
if errorlevel 1 (
  echo No se pudo entrar al directorio del proyecto.
  exit /b 1
)

echo ==========================================
echo Generando instalador del backend Fatboy POS
echo ==========================================
echo.

call npm --prefix backend run build
if errorlevel 1 (
  echo Fallo la compilacion del backend.
  exit /b 1
)

node scripts\prepare-backend-installer.cjs
if errorlevel 1 (
  echo Fallo la preparacion del instalador.
  exit /b 1
)

if exist installer-out\FatboyPOSBackendSetup.exe del /f /q installer-out\FatboyPOSBackendSetup.exe

set "ISCC_EXE="
for %%I in (ISCC.exe) do set "ISCC_EXE=%%~$PATH:I"
if not defined ISCC_EXE if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" set "ISCC_EXE=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if not defined ISCC_EXE if exist "C:\Program Files\Inno Setup 6\ISCC.exe" set "ISCC_EXE=C:\Program Files\Inno Setup 6\ISCC.exe"
if not defined ISCC_EXE (
  echo No se encontro ISCC.exe de Inno Setup.
  echo Instala Inno Setup 6 o agrega ISCC.exe al PATH.
  exit /b 1
)

"%ISCC_EXE%" installer\backend-service.iss
if errorlevel 1 (
  echo Fallo la generacion del instalador con Inno Setup.
  exit /b 1
)

echo.
echo Instalador generado:
echo installer-out\FatboyPOSBackendSetup.exe
exit /b 0
