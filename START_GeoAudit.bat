@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title GeoAudit Studio

echo ================================================
echo            GeoAudit Studio - START
echo ================================================
echo.

where python >nul 2>&1
if not errorlevel 1 goto run_python

where py >nul 2>&1
if not errorlevel 1 goto run_py

echo ERROR: Python was not found on this computer.
echo You previously ran python -m http.server, so if this appears,
echo restart Windows or check that Python is still available.
echo.
pause
goto end

:run_python
python "%~dp0server.py"
if errorlevel 1 pause
goto end

:run_py
py -3 "%~dp0server.py"
if errorlevel 1 pause
goto end

:end
endlocal
