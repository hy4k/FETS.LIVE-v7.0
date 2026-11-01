@echo off
setlocal
title FETS LIVE - build signed Android update
cd /d "%~dp0"
echo FETS LIVE - existing app update, version code 35
echo This builds a signed bundle locally. It does not publish to Google Play.
echo.
powershell.exe -NoProfile -File "%~dp0scripts\android\build-release.ps1"
if errorlevel 1 (
  echo.
  echo Build stopped. Share the error text, without passwords, for help.
) else (
  echo.
  echo The signed AAB is in fets-point\android\app\build\outputs\bundle\release.
)
pause
