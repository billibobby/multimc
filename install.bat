@echo off
title MultiMC Hub - Windows Installer
color 0A

echo.
echo ========================================
echo    Welcome to MultiMC Hub!
echo ========================================
echo.
echo This installer will help you set up everything needed.
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: This installer is not running as administrator.
    echo Some features may not work properly.
    echo.
    echo To run as administrator:
    echo 1. Right-click on this file
    echo 2. Select "Run as administrator"
    echo.
    set /p CONTINUE="Continue anyway? (y/n): "
    if /i not "%CONTINUE%"=="y" (
        echo Installation cancelled.
        pause
        exit /b 1
    )
    echo.
)

echo Step 1: Checking system requirements...
echo.

REM Check Node.js
echo Checking for Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed!
    echo.
    echo Please download and install Node.js from:
    echo https://nodejs.org/
    echo.
    echo Choose the LTS version (recommended).
    echo After installing Node.js, run this installer again.
    echo.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo ✅ Node.js is installed: %NODE_VERSION%
)

REM Check npm
echo.
echo Checking for npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not available!
    echo.
    echo Please ensure Node.js is properly installed.
    echo.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo ✅ npm is available: %NPM_VERSION%
)

REM Check Git
echo.
echo Checking for Git...
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Git is not installed (optional but recommended)
    echo.
    echo Git is used for updates and version control.
    echo You can install it from: https://git-scm.com/
    echo.
    set /p CONTINUE="Continue without Git? (y/n): "
    if /i not "%CONTINUE%"=="y" (
        echo Installation cancelled.
        pause
        exit /b 1
    )
    echo.
) else (
    for /f "tokens=*" %%i in ('git --version') do set GIT_VERSION=%%i
    echo ✅ Git is installed: %GIT_VERSION%
)

REM Check Java
echo.
echo Checking for Java...
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Java is not installed (required for Minecraft servers)
    echo.
    echo Java is needed to run Minecraft servers.
    echo You can install it from: https://adoptium.net/
    echo.
    set /p CONTINUE="Continue without Java? (y/n): "
    if /i not "%CONTINUE%"=="y" (
        echo Installation cancelled.
        pause
        exit /b 1
    )
    echo.
) else (
    for /f "tokens=*" %%i in ('java -version 2^>^&1 ^| findstr "version"') do set JAVA_VERSION=%%i
    echo ✅ Java is installed: %JAVA_VERSION%
)

echo.
echo Step 2: Installing MultiMC Hub dependencies...
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ package.json not found!
    echo.
    echo Please make sure you're in the MultiMC Hub folder.
    echo.
    pause
    exit /b 1
)

REM Clean install if node_modules exists
if exist "node_modules" (
    echo Found existing node_modules folder.
    set /p CLEAN="Do you want to perform a clean install? (y/n): "
    if /i "%CLEAN%"=="y" (
        echo Removing existing node_modules...
        rmdir /s /q node_modules
        if exist "package-lock.json" (
            del package-lock.json
        )
        echo Clean install ready.
        echo.
    )
)

REM Install dependencies
echo Installing Node.js packages...
echo This may take a few minutes...
echo.

REM Use npm ci for more reliable installs
npm ci --silent
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies with npm ci!
    echo.
    echo Trying with npm install...
    npm install --silent
    if %errorlevel% neq 0 (
        echo ❌ Failed to install dependencies!
        echo.
        echo Common solutions:
        echo 1. Run as administrator
        echo 2. Check your internet connection
        echo 3. Try disabling antivirus temporarily
        echo 4. Clear npm cache: npm cache clean --force
        echo.
        pause
        exit /b 1
    )
)

echo ✅ Dependencies installed successfully!
echo.

REM Install Electron dependencies
echo Installing Electron dependencies...
npm run postinstall --silent
if %errorlevel% neq 0 (
    echo ⚠️  Electron dependencies installation had issues
    echo This might not affect basic functionality.
    echo.
)

echo.
echo Step 3: Testing installation...
echo.

REM Test the simple version first
echo Testing basic functionality...
node src/main-simple.js --test >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Basic test failed, but continuing...
    echo.
) else (
    echo ✅ Basic functionality test passed!
    echo.
)

echo.
echo ========================================
echo    Installation Complete!
echo ========================================
echo.
echo MultiMC Hub has been installed successfully!
echo.
echo To start the application:
echo 1. Run start.bat
echo 2. Or use: npm start
echo.
echo If you encounter issues:
echo 1. Run troubleshoot-windows.bat
echo 2. Try running as administrator
echo 3. Check the documentation
echo.
echo Press any key to close this installer...
pause >nul 