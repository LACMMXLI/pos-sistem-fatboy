@echo off
node "%~dp0windows-service.cjs" stop
exit /b %errorlevel%
