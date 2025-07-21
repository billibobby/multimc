@echo off
title MultiMC Hub - Windows Launcher
color 0A

echo.
echo ========================================
echo    MultiMC Hub - Windows Launcher
echo ========================================
echo.

REM Check if Node.js is installed
echo [1/4] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please download and install Node.js from:
    echo https://nodejs.org/
    echo.
    echo After installing Node.js, run this launcher again.
    echo.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do echo OK: Node.js %%i
)

REM Check if npm is available
echo.
echo [2/4] Checking npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm is not available!
    echo.
    echo Please ensure Node.js is properly installed.
    echo.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm --version') do echo OK: npm %%i
)

REM Check if we're in the right directory
echo.
echo [3/4] Checking project files...
if not exist "package.json" (
    echo ERROR: Not in MultiMC Hub folder!
    echo Please run this from the MultiMC Hub folder.
    pause
    exit /b 1
) else (
    echo OK: Found package.json
)

REM Check if node_modules exists
echo.
echo [4/4] Checking dependencies...
if not exist "node_modules" (
    echo WARNING: Dependencies not installed. Installing now...
    echo This may take a few minutes...
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
echo ========================================
echo    Starting MultiMC Hub...
echo ========================================
echo.

REM Start the application
echo Starting MultiMC Hub...
npm start

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to start MultiMC Hub!
    echo.
    echo Try running: npm start
    pause
    exit /b 1
)

echo.
echo MultiMC Hub has been closed.
pause 