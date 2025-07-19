@echo off
title MultiMC Hub - Test Simple
color 0C

echo.
echo ========================================
echo    MultiMC Hub - Test Simple Version
echo ========================================
echo.
echo This will test a simplified version of the app.
echo It will show which module is causing the crash.
echo.

REM Check if we're in the right place
if not exist "package.json" (
    echo ERROR: Not in MultiMC Hub folder!
    echo Please run this from the MultiMC Hub folder.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies!
        pause
        exit /b 1
    )
)

echo.
echo Testing simplified version...
echo This will show which module is causing the crash.
echo.

REM Run the simple version
node src/main-simple.js

echo.
echo Simple version test completed.
echo.
echo If you saw error messages above, that module is causing the crash.
echo.
pause 