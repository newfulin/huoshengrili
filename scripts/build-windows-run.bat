@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

echo ========================================
echo  Xiaohuasheng Calendar - Windows Build
echo ========================================
echo.
echo Project dir:
cd
echo.

set "TMPDIR=%TEMP%\xiaohuasheng-setup"
if not exist "%TMPDIR%" mkdir "%TMPDIR%"

REM ---- Node.js ----
where node >nul 2>&1
if errorlevel 1 goto InstallNode
echo [OK] Node.js found
node -v
goto CheckRust

:InstallNode
echo [..] Node.js not found, installing...
where winget >nul 2>&1
if errorlevel 1 goto DownloadNode
echo [..] winget install OpenJS.NodeJS.LTS ...
winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
if errorlevel 1 goto DownloadNode
goto ReloadPath

:DownloadNode
echo [..] Downloading Node.js MSI ...
set "NODE_MSI=%TMPDIR%\node-lts.msi"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi' -OutFile $env:TEMP\xiaohuasheng-setup\node-lts.msi } catch { Write-Host $_; exit 1 }"
if errorlevel 1 (
  echo [FAIL] Cannot download Node.js. Install manually: https://nodejs.org
  goto EndFail
)
echo [..] Installing Node.js MSI (may need admin)...
msiexec /i "%NODE_MSI%" /qb /norestart
goto ReloadPath

:CheckRust
where rustc >nul 2>&1
if errorlevel 1 goto InstallRust
echo [OK] Rust found
rustc --version
goto CheckMsvc

:InstallRust
echo [..] Rust not found, downloading rustup-init.exe ...
set "RUSTUP=%TMPDIR%\rustup-init.exe"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe' -OutFile $env:TEMP\xiaohuasheng-setup\rustup-init.exe } catch { Write-Host $_; exit 1 }"
if errorlevel 1 (
  echo [FAIL] Cannot download rustup. Install manually: https://rustup.rs
  goto EndFail
)
echo [..] Installing Rust (may take several minutes, please wait)...
"%RUSTUP%" -y --default-toolchain stable
if errorlevel 1 (
  echo [FAIL] rustup install failed
  goto EndFail
)
if exist "%USERPROFILE%\.cargo\bin" set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
goto CheckMsvc

:ReloadPath
echo [..] Refreshing PATH for this window...
if exist "%USERPROFILE%\.cargo\bin" set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
if exist "%ProgramFiles%\nodejs" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%LOCALAPPDATA%\Programs\node" set "PATH=%LOCALAPPDATA%\Programs\node;%PATH%"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo [NEED RESTART] Node installed but not in PATH yet.
  echo Close this window, then double-click build-windows.bat AGAIN.
  goto EndOk
)
where rustc >nul 2>&1
if errorlevel 1 (
  if exist "%USERPROFILE%\.cargo\bin\rustc.exe" set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
)
where rustc >nul 2>&1
if errorlevel 1 (
  echo.
  echo [NEED RESTART] Rust installed but not in PATH yet.
  echo Close this window, then double-click build-windows.bat AGAIN.
  goto EndOk
)
goto CheckMsvc

REM ---- MSVC / VS Build Tools (required by Tauri on Windows) ----
:CheckMsvc
echo [..] Checking Visual C++ Build Tools...
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if exist "%VSWHERE%" (
  for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2^>nul`) do (
    if not "%%i"=="" (
      echo [OK] Visual C++ tools found: %%i
      goto DoBuild
    )
  )
)
where link.exe >nul 2>&1
if not errorlevel 1 (
  echo [OK] link.exe found
  goto DoBuild
)

echo [WARN] MSVC Build Tools NOT found.
echo        Tauri needs them. Installing Visual Studio 2022 Build Tools...
echo        This is large (1GB+) and needs network + admin. Please wait.
where winget >nul 2>&1
if errorlevel 1 goto DownloadMsvc
winget install -e --id Microsoft.VisualStudio.2022.BuildTools --accept-package-agreements --accept-source-agreements --override "--wait --passive --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
if errorlevel 1 (
  echo [WARN] winget failed, try official bootstrapper...
  goto DownloadMsvc
)
echo [OK] Build Tools install finished. Continue build...
goto DoBuild

:DownloadMsvc
echo [..] Downloading vs_BuildTools.exe ...
set "BOOT=%TMPDIR%\vs_BuildTools.exe"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'https://aka.ms/vs/17/release/vs_buildtools.exe' -OutFile $env:TEMP\xiaohuasheng-setup\vs_BuildTools.exe } catch { Write-Host $_; exit 1 }"
if errorlevel 1 goto MsvcManual
echo [..] Running installer (passive, please wait)...
"%BOOT%" --wait --passive --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended
if errorlevel 1 goto MsvcManual
echo [OK] Build Tools install finished. Continue build...
goto DoBuild

:MsvcManual
echo.
echo [NEED ACTION] Auto-install failed. Do ONE of:
echo   1) Double-click scripts\install-msvc.bat
echo   2) Manual: https://visualstudio.microsoft.com/visual-cpp-build-tools/
echo      Check: Desktop development with C++
echo Then run build-windows.bat again.
echo.
goto EndFail

:DoBuild
echo.
echo [1/3] npm install ...
call npm install
if errorlevel 1 (
  echo [FAIL] npm install failed
  goto EndFail
)

echo [2/3] tauri build nsis ...
call npx tauri build --bundles nsis
if errorlevel 1 (
  echo [FAIL] build failed.
  echo If linker/MSVC errors: install VS Build Tools C++ workload, then re-run.
  echo If WebView2 errors: https://developer.microsoft.com/microsoft-edge/webview2/
  goto EndFail
)

echo.
echo [3/3] DONE. Installer folder:
echo src-tauri\target\release\bundle\nsis\
dir /b "src-tauri\target\release\bundle\nsis\*.exe" 2>nul
if exist "src-tauri\target\release\bundle\nsis" explorer "src-tauri\target\release\bundle\nsis"
goto EndOk

:EndFail
echo.
echo ========== FAILED ==========
echo Read messages above.
echo.
pause
exit /b 1

:EndOk
echo.
echo ========== DONE ==========
echo You can close this window.
echo.
pause
exit /b 0
