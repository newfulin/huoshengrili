@echo off
REM Avoid cmd /k with paths that contain parentheses like buildkit(5)
cd /d "%~dp0"
title Install VS Build Tools
call "%~dp0install-msvc-run.bat"
echo.
echo Window stays open. Press any key to close.
pause >nul
