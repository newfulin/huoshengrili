@echo off
setlocal EnableExtensions
echo ========================================
echo  Install Visual C++ Build Tools
echo ========================================
echo.
echo This is REQUIRED for Tauri Windows build.
echo Size is large (about 1GB+). Need network + admin.
echo.

set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if exist "%VSWHERE%" (
  for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2^>nul`) do (
    if not "%%i"=="" (
      echo [OK] Already installed:
      echo %%i
      echo.
      pause
      exit /b 0
    )
  )
)

set "TMPDIR=%TEMP%\xiaohuasheng-setup"
if not exist "%TMPDIR%" mkdir "%TMPDIR%"

where winget >nul 2>&1
if errorlevel 1 goto DownloadBootstrapper

echo [1/2] winget install Visual Studio 2022 Build Tools ...
echo       Workload: VCTools (C++)
winget install -e --id Microsoft.VisualStudio.2022.BuildTools --accept-package-agreements --accept-source-agreements --override "--wait --passive --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
if errorlevel 1 (
  echo [WARN] winget failed, try official bootstrapper...
  goto DownloadBootstrapper
)
goto Verify

:DownloadBootstrapper
echo [1/2] Downloading vs_BuildTools.exe ...
set "BOOT=%TMPDIR%\vs_BuildTools.exe"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'https://aka.ms/vs/17/release/vs_buildtools.exe' -OutFile $env:TEMP\xiaohuasheng-setup\vs_BuildTools.exe } catch { Write-Host $_; exit 1 }"
if errorlevel 1 (
  echo [FAIL] Download failed.
  echo Install manually: https://visualstudio.microsoft.com/visual-cpp-build-tools/
  echo Check: Desktop development with C++
  pause
  exit /b 1
)

echo [2/2] Installing (passive UI, please wait, can take long)...
"%BOOT%" --wait --passive --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended
if errorlevel 1 (
  echo [FAIL] Installer returned error.
  echo Try manual install and check "Desktop development with C++"
  echo https://visualstudio.microsoft.com/visual-cpp-build-tools/
  pause
  exit /b 1
)

:Verify
echo.
echo [..] Verifying...
if exist "%VSWHERE%" (
  for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2^>nul`) do (
    if not "%%i"=="" (
      echo [OK] Visual C++ Build Tools ready:
      echo %%i
      echo.
      echo Next: double-click build-windows.bat
      pause
      exit /b 0
    )
  )
)

echo [WARN] Install finished but VC tools not detected yet.
echo Restart PC, then run build-windows.bat again.
echo If still failing, open Visual Studio Installer and ensure
echo "Desktop development with C++" is checked.
echo.
pause
exit /b 0
