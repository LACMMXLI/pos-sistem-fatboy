@echo off
node "%~dp0windows-service.cjs" status
exit /b %errorlevel%
