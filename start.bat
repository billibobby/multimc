@echo off
title MultiMC Hub Launcher
color 0A

echo.
echo ========================================
echo    MultiMC Hub - Minecraft Server Hub
echo ========================================
echo.
echo Starting MultiMC Hub...
echo.

REM Check if Node.js is installed
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
)

REM Check if npm is available
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm is not available!
    echo.
    echo Please ensure Node.js is properly installed.
    echo.
    pause
    exit /b 1
)

REM Check if dependencies are installed
if not exist "node_modules" (
    echo Installing dependencies...
    echo This may take a few minutes on first run...
    echo.
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies!
        echo.
        echo Try running as administrator or check your internet connection.
        echo.
        pause
        exit /b 1
    )
    echo Dependencies installed successfully!
    echo.
)

REM Check for updates
echo Checking for updates...
git fetch origin main >nul 2>&1
if %errorlevel% equ 0 (
    git status --porcelain >nul 2>&1
    if %errorlevel% equ 0 (
        LOCAL=$(git rev-parse HEAD)
        REMOTE=$(git rev-parse origin/main)
        if not "%LOCAL%"=="%REMOTE%" (
            echo.
            echo ========================================
            echo           UPDATE AVAILABLE!
            echo ========================================
            echo.
            echo A new version of MultiMC Hub is available.
            echo.
            set /p UPDATE_CHOICE="Would you like to update now? (y/n): "
            if /i "%UPDATE_CHOICE%"=="y" (
                echo.
                echo Updating MultiMC Hub...
                git pull origin main
                if %errorlevel% equ 0 (
                    echo Update completed successfully!
                    echo.
                    echo Installing any new dependencies...
                    npm install
                    echo.
                    echo Update finished! Starting MultiMC Hub...
                    echo.
                ) else (
                    echo Update failed! Starting with current version...
                    echo.
                )
            ) else (
                echo Starting with current version...
                echo.
            )
        ) else (
            echo MultiMC Hub is up to date!
            echo.
        )
    )
) else (
    echo Could not check for updates (no internet connection or git not available)
    echo Starting MultiMC Hub...
    echo.
)

REM Check for port conflicts
echo Checking for port conflicts...
netstat -an | find "3001" >nul 2>&1
if %errorlevel% equ 0 (
    echo WARNING: Port 3001 is in use - MultiMC Hub will use alternative ports
)
netstat -an | find "3002" >nul 2>&1
if %errorlevel% equ 0 (
    echo WARNING: Port 3002 is in use - MultiMC Hub will use alternative ports
)
netstat -an | find "3003" >nul 2>&1
if %errorlevel% equ 0 (
    echo WARNING: Port 3003 is in use - MultiMC Hub will use alternative ports
)

REM Start the application
echo Launching MultiMC Hub...
echo.
echo Please wait while the application loads...
echo.
echo If the app doesn't start or you see errors:
echo 1. Run troubleshoot-windows.bat to diagnose issues
echo 2. Try running as administrator
echo 3. Check if your antivirus is blocking the app
echo.
echo Press Ctrl+C to stop the app when it's running.
echo.
echo ========================================
echo.

npm start

REM If we get here, the app has closed
echo.
echo MultiMC Hub has been closed.
echo.
pause 