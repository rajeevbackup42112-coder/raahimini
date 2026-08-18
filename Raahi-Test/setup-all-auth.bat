@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  echo Installing lightweight test dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

echo.
echo RAAHI TEST SESSION SETUP
echo Each window below is NORMAL Google Chrome, not Playwright.
echo Sign in to Raahi with the named account, then CLOSE Chrome to continue.
echo.

for %%P in (admin-ajit driver-dipti driver-rajeev4 passenger-1 passenger-2) do (
  echo ============================================================
  echo SET UP: %%P
  echo ============================================================
  node src/setup-auth.mjs %%P
  if errorlevel 1 exit /b 1
  echo.
)

echo All five dedicated Raahi browser sessions have been captured.
echo You can now run run-smoke.bat.
pause
