@echo off
:: One-time local setup on Windows. Double-click, or run: setup.bat pit-your-token
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\setup.ps1" -Token "%~1"
pause
