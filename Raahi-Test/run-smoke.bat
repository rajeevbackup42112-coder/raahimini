@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  call npm install
  if errorlevel 1 exit /b 1
)
node src/smoke.mjs
set EXITCODE=%ERRORLEVEL%
echo.
if %EXITCODE%==0 (
  echo RAAHI SMOKE: PASS
) else (
  echo RAAHI SMOKE: FAIL - see reports folder
)
pause
exit /b %EXITCODE%
