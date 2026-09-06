@echo off
REM Do NOT use: cmd /k "long\path\with(parens)\script.bat"
REM Parentheses in folder names break cmd parsing.
cd /d "%~dp0"
title Xiaohuasheng Calendar Build
call "%~dp0build-windows-run.bat"
echo.
echo Window stays open. Press any key to close.
pause >nul
