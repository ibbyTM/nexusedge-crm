@echo off
:: Connect the local CRM to your real HighLevel account: connect.bat pit-your-token
if "%~1"=="" (
  echo Usage: connect.bat pit-your-private-integration-token
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\connect.ps1" -Token "%~1"
pause
