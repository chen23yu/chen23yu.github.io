@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0studio\launch.ps1"
if errorlevel 1 pause
