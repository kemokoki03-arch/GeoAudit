@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title GeoAudit Studio - Portable Setup

set "PYEXE="

where python >nul 2>&1
if not errorlevel 1 (
  for /f "delims=" %%P in ('where python') do if not defined PYEXE set "PYEXE=%%P"
)

if not defined PYEXE (
  where py >nul 2>&1
  if not errorlevel 1 (
    py -3 -c "import sys; print(sys.executable)" > "%TEMP%\geoaudit_python.txt" 2>nul
    set /p PYEXE=<"%TEMP%\geoaudit_python.txt"
    del /q "%TEMP%\geoaudit_python.txt" >nul 2>&1
  )
)

if defined PYEXE goto run

echo.
echo GeoAudit needs Python only once on this computer.
echo Installing Python automatically using Windows Package Manager...
echo.

where winget >nul 2>&1
if errorlevel 1 goto no_winget

winget install --id Python.Python.3.13 -e --scope user --accept-package-agreements --accept-source-agreements --silent

if exist "%LocalAppData%\Programs\Python\Python313\python.exe" set "PYEXE=%LocalAppData%\Programs\Python\Python313\python.exe"
if exist "%LocalAppData%\Programs\Python\Python313-32\python.exe" set "PYEXE=%LocalAppData%\Programs\Python\Python313-32\python.exe"

if not defined PYEXE (
  where python >nul 2>&1
  if not errorlevel 1 for /f "delims=" %%P in ('where python') do if not defined PYEXE set "PYEXE=%%P"
)

if not defined PYEXE goto install_failed

:run
echo Starting GeoAudit Studio...
"%PYEXE%" "%~dp0server.py"
if errorlevel 1 pause
goto end

:no_winget
echo.
echo Windows Package Manager ^(winget^) is not available on this PC.
echo Install Python 3 from python.org once, then run this file again.
start "" "https://www.python.org/downloads/windows/"
pause
goto end

:install_failed
echo.
echo Python installation finished but Windows has not refreshed the path yet.
echo Close this window and double-click INSTALL_AND_START_GeoAudit.bat again.
pause

:end
endlocal
