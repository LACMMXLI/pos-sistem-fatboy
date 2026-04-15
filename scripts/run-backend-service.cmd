@echo off
setlocal EnableExtensions

cd /d "%~dp0..\backend"
if errorlevel 1 exit /b 1

set "FATBOY_PROJECT_ROOT=%~dp0.."
set "FATBOY_BACKEND_ROOT=%CD%"
set "ELECTRON_DESKTOP=false"
node scripts\service-launcher.cjs
exit /b %errorlevel%
