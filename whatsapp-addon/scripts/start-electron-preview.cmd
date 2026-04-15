@echo off
setlocal
set ELECTRON_RUN_AS_NODE=
set WHATSAPP_ADDON_RENDERER_URL=http://127.0.0.1:4180
call wait-on http://127.0.0.1:4180
if errorlevel 1 exit /b %errorlevel%
call electron .
