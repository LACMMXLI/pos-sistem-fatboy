@echo off
node "%~dp0windows-service.cjs" start
exit /b %errorlevel%
