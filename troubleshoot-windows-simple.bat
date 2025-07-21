@echo off
title MultiMC Hub - Windows Troubleshooter
color 0C

echo.
echo ========================================
echo    MultiMC Hub - Windows Troubleshooter
echo ========================================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo ERROR: Not in MultiMC Hub folder!
    echo.
    echo Please run this from the MultiMC Hub folder.
    echo.
    pause
    exit /b 1
)

echo Step 1: Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is NOT installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Choose the LTS version (recommended).
    echo.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do echo OK: Node.js %%i
)

echo.
echo Step 2: Checking npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm is NOT available!
    echo.
    echo Please ensure Node.js is properly installed.
    echo.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm --version') do echo OK: npm %%i
)

echo.
echo Step 3: Checking dependencies...
if not exist "node_modules" (
    echo WARNING: Dependencies not found. Installing...
    npm install --silent
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies!
        echo.
        echo Try running: npm install
        pause
        exit /b 1
    ) else (
        echo OK: Dependencies installed successfully
    )
) else (
    echo OK: Dependencies found
)

echo.
echo Step 4: Checking Electron...
npx electron --version >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: Electron not found. Installing...
    npm install electron --save-dev --silent
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install Electron!
        pause
        exit /b 1
    ) else (
        echo OK: Electron installed successfully
    )
) else (
    for /f "tokens=*" %%i in ('npx electron --version') do echo OK: Electron %%i
)

echo.
echo Step 5: Testing application...
echo.
echo Testing if the application can start...
echo (This will open a test window - close it to continue)
echo.

timeout /t 3 /nobreak >nul

npm start

echo.
echo ========================================
echo    Troubleshooting Complete!
echo ========================================
echo.
echo If the application started successfully, everything is working!
echo.
echo If you encountered issues:
echo 1. Make sure you have Node.js installed
echo 2. Try running: npm install
echo 3. Try running: npm start
echo 4. Check the README.md file for more help
echo.
pause 