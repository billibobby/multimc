@echo off
title MultiMC Hub - Test Start
color 0B

echo.
echo ========================================
echo    MultiMC Hub - Test Start
echo ========================================
echo.
echo This will test starting the app step by step.
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
echo Step 1: Testing Node.js...
node --version
if %errorlevel% neq 0 (
    echo ERROR: Node.js not working!
    pause
    exit /b 1
)

echo.
echo Step 2: Testing npm...
npm --version
if %errorlevel% neq 0 (
    echo ERROR: npm not working!
    pause
    exit /b 1
)

echo.
echo Step 3: Testing Electron...
npx electron --version
if %errorlevel% neq 0 (
    echo ERROR: Electron not working!
    pause
    exit /b 1
)

echo.
echo Step 4: Testing main.js...
if not exist "src\main.js" (
    echo ERROR: main.js not found!
    pause
    exit /b 1
)

echo.
echo Step 5: Starting the app...
echo.
echo If the app starts, you should see an Electron window.
echo If it fails, the error will be shown below.
echo.
echo Press Ctrl+C to stop the app when it's running.
echo.

npm start

echo.
echo App has stopped or failed to start.
echo.
pause 