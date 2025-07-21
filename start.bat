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
    echo ❌ ERROR: Node.js is not installed!
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
    echo ❌ ERROR: npm is not available!
    echo.
    echo Please ensure Node.js is properly installed.
    echo.
    pause
    exit /b 1
)

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ ERROR: Not in MultiMC Hub folder!
    echo.
    echo Please run this from the MultiMC Hub folder.
    echo.
    pause
    exit /b 1
)

REM Check if dependencies are installed
if not exist "node_modules" (
    echo ⚠️  Dependencies not found. Installing...
    echo This may take a few minutes on first run...
    echo.
    
    REM Try npm ci first (more reliable)
    npm ci --silent
    if %errorlevel% neq 0 (
        echo Trying npm install...
        npm install --silent
        if %errorlevel% neq 0 (
            echo ❌ ERROR: Failed to install dependencies!
            echo.
            echo Try running as administrator or check your internet connection.
            echo.
            pause
            exit /b 1
        )
    )
    echo ✅ Dependencies installed successfully!
    echo.
)

REM Check for updates (only if git is available)
git --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Checking for updates...
    git fetch origin main >nul 2>&1
    if %errorlevel% equ 0 (
        git status --porcelain >nul 2>&1
        if %errorlevel% equ 0 (
            for /f "tokens=*" %%i in ('git rev-parse HEAD') do set LOCAL=%%i
            for /f "tokens=*" %%i in ('git rev-parse origin/main 2^>nul') do set REMOTE=%%i
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
                        echo ✅ Update completed successfully!
                        echo.
                        echo Installing any new dependencies...
                        npm install --silent
                        echo ✅ Update finished! Starting MultiMC Hub...
                        echo.
                    ) else (
                        echo ⚠️  Update failed! Starting with current version...
                        echo.
                    )
                ) else (
                    echo Starting with current version...
                    echo.
                )
            ) else (
                echo ✅ MultiMC Hub is up to date!
                echo.
            )
        )
    ) else (
        echo ⚠️  Could not check for updates (no internet connection)
        echo Starting MultiMC Hub...
        echo.
    )
) else (
    echo ⚠️  Git not available - skipping update check
    echo Starting MultiMC Hub...
    echo.
)

REM Check for port conflicts
echo Checking for port conflicts...
set PORT_CONFLICTS=0

netstat -an | find "3001" >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  Port 3001 is in use - MultiMC Hub will use alternative ports
    set PORT_CONFLICTS=1
)

netstat -an | find "3002" >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  Port 3002 is in use - MultiMC Hub will use alternative ports
    set PORT_CONFLICTS=1
)

netstat -an | find "3003" >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  Port 3003 is in use - MultiMC Hub will use alternative ports
    set PORT_CONFLICTS=1
)

netstat -an | find "25565" >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  Port 25565 is in use (Minecraft default port)
    set PORT_CONFLICTS=1
)

if %PORT_CONFLICTS% equ 0 (
    echo ✅ All required ports are available
)

echo.

REM Test basic functionality before starting
echo Testing basic functionality...
node src/main-simple.js --test >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Basic test failed, but attempting to start anyway...
    echo.
    echo If the app doesn't start properly:
    echo 1. Run troubleshoot-windows.bat to diagnose issues
    echo 2. Try running as administrator
    echo 3. Check if your antivirus is blocking the app
    echo.
) else (
    echo ✅ Basic functionality test passed!
    echo.
)

REM Start the application
echo ========================================
echo Launching MultiMC Hub...
echo ========================================
echo.
echo Please wait while the application loads...
echo.
echo If the app doesn't start or you see errors:
echo 1. Run troubleshoot-windows.bat to diagnose issues
echo 2. Try running as administrator
echo 3. Check if your antivirus is blocking the app
echo 4. Check the logs in the application
echo.
echo Press Ctrl+C to stop the app when it's running.
echo.

REM Start with error handling
npm start
if %errorlevel% neq 0 (
    echo.
    echo ❌ Application failed to start!
    echo.
    echo Common solutions:
    echo 1. Run troubleshoot-windows.bat
    echo 2. Try running as administrator
    echo 3. Check if your antivirus is blocking the app
    echo 4. Make sure all dependencies are installed correctly
    echo.
    pause
    exit /b 1
)

REM If we get here, the app has closed
echo.
echo MultiMC Hub has been closed.
echo.
pause 