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

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ ERROR: Not in MultiMC Hub folder!
    echo.
    echo Please run this from the MultiMC Hub folder.
    echo.
    pause
    exit /b 1
)

REM Check if Node.js is installed
echo [1/8] Checking Node.js...
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
echo [2/8] Checking npm...
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
echo [3/8] Checking project files...
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
    echo This may take a few minutes...
    echo.
    
    REM Try npm ci first
    npm ci --silent
    if %errorlevel% neq 0 (
        echo npm ci failed, trying npm install...
        npm install --silent
        if %errorlevel% neq 0 (
            echo ❌ Failed to install dependencies!
            echo.
            echo Try running as administrator or check your internet connection.
            echo.
            pause
            exit /b 1
        ) else (
            echo ✅ Dependencies installed successfully with npm install
        )
    ) else (
        echo ✅ Dependencies installed successfully with npm ci
    )
) else (
    echo ✅ node_modules found
)

REM Check for port conflicts
echo.
echo [4/8] Checking for port conflicts...
echo Checking ports 3001-3003 and 25565...

set PORT_CONFLICTS=0

REM Check port 3001
netstat -an | find "3001" >nul 2>&1
if %errorlevel% equ 0 (
    echo ❌ Port 3001 is in use
    set PORT_3001_IN_USE=1
    set PORT_CONFLICTS=1
) else (
    echo ✅ Port 3001 is available
)

REM Check port 3002
netstat -an | find "3002" >nul 2>&1
if %errorlevel% equ 0 (
    echo ❌ Port 3002 is in use
    set PORT_3002_IN_USE=1
    set PORT_CONFLICTS=1
) else (
    echo ✅ Port 3002 is available
)

REM Check port 3003
netstat -an | find "3003" >nul 2>&1
if %errorlevel% equ 0 (
    echo ❌ Port 3003 is in use
    set PORT_3003_IN_USE=1
    set PORT_CONFLICTS=1
) else (
    echo ✅ Port 3003 is available
)

REM Check port 25565 (Minecraft default)
netstat -an | find "25565" >nul 2>&1
if %errorlevel% equ 0 (
    echo ❌ Port 25565 is in use (Minecraft default port)
    set PORT_25565_IN_USE=1
    set PORT_CONFLICTS=1
) else (
    echo ✅ Port 25565 is available
)

REM Check Java
echo.
echo [5/8] Checking Java...
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Java is NOT installed!
    echo.
    echo Java is needed to run Minecraft servers.
    echo You can install it from: https://adoptium.net/
    echo.
    set /p CONTINUE="Continue without Java? (y/n): "
    if /i not "%CONTINUE%"=="y" (
        pause
        exit /b 1
    )
    echo.
) else (
    for /f "tokens=*" %%i in ('java -version 2^>^&1 ^| findstr "version"') do set JAVA_VERSION=%%i
    echo ✅ Java is installed: %JAVA_VERSION%
)

REM Check Electron installation
echo.
echo [6/8] Checking Electron installation...
npx electron --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Electron is not properly installed!
    echo.
    echo Reinstalling Electron dependencies...
    npm run postinstall --silent
    if %errorlevel% neq 0 (
        echo ❌ Failed to reinstall Electron!
        echo.
        echo Try running as administrator.
        echo.
        pause
        exit /b 1
    ) else (
        echo ✅ Electron reinstalled successfully
    )
) else (
    for /f "tokens=*" %%i in ('npx electron --version') do set ELECTRON_VERSION=%%i
    echo ✅ Electron is installed: %ELECTRON_VERSION%
)

REM Test basic functionality
echo.
echo [7/8] Testing basic functionality...
echo.
echo Testing Electron loading...
node src/main-simple.js --test >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Basic functionality test failed!
    echo.
    echo This indicates a problem with the Electron installation.
    echo.
    echo Trying to fix...
    echo.
    
    REM Try to reinstall dependencies
    echo Reinstalling all dependencies...
    rmdir /s /q node_modules
    del package-lock.json
    npm install --silent
    
    if %errorlevel% neq 0 (
        echo ❌ Failed to reinstall dependencies!
        echo.
        echo Please try:
        echo 1. Running as administrator
        echo 2. Checking your internet connection
        echo 3. Disabling antivirus temporarily
        echo.
        pause
        exit /b 1
    ) else (
        echo ✅ Dependencies reinstalled successfully
        echo.
        echo Testing again...
        node src/main-simple.js --test >nul 2>&1
        if %errorlevel% neq 0 (
            echo ❌ Still failing after reinstall!
            echo.
            pause
            exit /b 1
        ) else (
            echo ✅ Test passed after reinstall!
        )
    )
) else (
    echo ✅ Basic functionality test passed!
)

REM Test the full application
echo.
echo [8/8] Testing full application startup...
echo.
echo Starting MultiMC Hub in test mode...
echo (This will show any startup errors)
echo.

REM Try to start the app with error output
timeout /t 3 /nobreak >nul
npm start
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
if %PORT_CONFLICTS% equ 1 (
    echo ⚠️  Some ports are in use:
    if defined PORT_3001_IN_USE echo   - Port 3001 (MultiMC Hub will use alternative)
    if defined PORT_3002_IN_USE echo   - Port 3002 (MultiMC Hub will use alternative)
    if defined PORT_3003_IN_USE echo   - Port 3003 (MultiMC Hub will use alternative)
    if defined PORT_25565_IN_USE echo   - Port 25565 (You may need to change Minecraft server port)
    echo.
    echo MultiMC Hub will automatically use alternative ports.
    echo.
)

echo ✅ All checks completed successfully!
echo.
echo If you're still having issues:
echo 1. Try running as administrator
echo 2. Check Windows Defender/Antivirus settings
echo 3. Make sure no other Minecraft servers are running
echo 4. Restart your computer and try again
echo 5. Check the application logs for specific errors
echo.
echo Press any key to close this window...
pause >nul 