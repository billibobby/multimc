@echo off
title MultiMC Hub - Windows Troubleshooter
color 0C

echo.
echo ========================================
echo    MultiMC Hub - Windows Troubleshooter
echo ========================================
echo.
echo This tool will check for common issues and fix them.
echo.

REM Check if Node.js is installed
echo [1/6] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is NOT installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Choose the LTS version (recommended).
    echo.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo ✅ Node.js is installed: %NODE_VERSION%
)

REM Check if npm is working
echo.
echo [2/6] Checking npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not working properly!
    echo.
    echo Try restarting your computer and running this again.
    echo.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo ✅ npm is working: %NPM_VERSION%
)

REM Check if package.json exists
echo.
echo [3/6] Checking project files...
if not exist "package.json" (
    echo ❌ package.json not found!
    echo.
    echo Please make sure you're in the correct MultiMC Hub folder.
    echo.
    pause
    exit /b 1
) else (
    echo ✅ package.json found
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo ❌ node_modules not found!
    echo.
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Failed to install dependencies!
        echo.
        echo Try running as administrator or check your internet connection.
        echo.
        pause
        exit /b 1
    ) else (
        echo ✅ Dependencies installed successfully
    )
) else (
    echo ✅ node_modules found
)

REM Check for port conflicts
echo.
echo [4/6] Checking for port conflicts...
echo Checking ports 3001-3003 and 25565...

REM Check port 3001
netstat -an | find "3001" >nul 2>&1
if %errorlevel% equ 0 (
    echo ❌ Port 3001 is in use
    set PORT_3001_IN_USE=1
) else (
    echo ✅ Port 3001 is available
)

REM Check port 3002
netstat -an | find "3002" >nul 2>&1
if %errorlevel% equ 0 (
    echo ❌ Port 3002 is in use
    set PORT_3002_IN_USE=1
) else (
    echo ✅ Port 3002 is available
)

REM Check port 3003
netstat -an | find "3003" >nul 2>&1
if %errorlevel% equ 0 (
    echo ❌ Port 3003 is in use
    set PORT_3003_IN_USE=1
) else (
    echo ✅ Port 3003 is available
)

REM Check port 25565 (Minecraft default)
netstat -an | find "25565" >nul 2>&1
if %errorlevel% equ 0 (
    echo ❌ Port 25565 is in use (Minecraft default port)
    set PORT_25565_IN_USE=1
) else (
    echo ✅ Port 25565 is available
)

REM Check Java
echo.
echo [5/6] Checking Java...
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Java is NOT installed!
    echo.
    echo Please install Java from: https://adoptium.net/
    echo Choose the latest LTS version.
    echo.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('java -version 2^>^&1 ^| findstr "version"') do set JAVA_VERSION=%%i
    echo ✅ Java is installed: %JAVA_VERSION%
)

REM Test the application
echo.
echo [6/6] Testing application startup...
echo.
echo Starting MultiMC Hub in test mode...
echo (This will show any startup errors)
echo.

REM Try to start the app with error output
node src/main.js 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ❌ Application failed to start!
    echo.
    echo Common solutions:
    echo 1. Make sure no other applications are using the required ports
    echo 2. Try running as administrator
    echo 3. Check if your antivirus is blocking the application
    echo 4. Make sure all dependencies are installed correctly
    echo.
    pause
    exit /b 1
) else (
    echo.
    echo ✅ Application started successfully!
    echo.
    echo The app should now be running normally.
    echo.
)

echo.
echo ========================================
echo    Troubleshooting Complete!
echo ========================================
echo.
if defined PORT_3001_IN_USE (
    echo ⚠️  Port 3001 is in use - MultiMC Hub will use an alternative port
)
if defined PORT_3002_IN_USE (
    echo ⚠️  Port 3002 is in use - MultiMC Hub will use an alternative port
)
if defined PORT_3003_IN_USE (
    echo ⚠️  Port 3003 is in use - MultiMC Hub will use an alternative port
)
if defined PORT_25565_IN_USE (
    echo ⚠️  Port 25565 is in use - You may need to change Minecraft server port
)
echo.
echo If you're still having issues:
echo 1. Try running as administrator
echo 2. Check Windows Defender/Antivirus settings
echo 3. Make sure no other Minecraft servers are running
echo 4. Restart your computer and try again
echo.
pause 