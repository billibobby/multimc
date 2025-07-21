@echo off
title MultiMC Hub - Windows Installer
color 0A

echo.
echo ========================================
echo    MultiMC Hub - Windows Installer
echo ========================================
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

REM Check if Node.js is installed
echo [1/3] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
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
    for /f "tokens=*" %%i in ('node --version') do echo OK: Node.js %%i
)

REM Check if npm is available
echo.
echo [2/3] Checking npm...
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
echo [3/3] Checking project files...
if not exist "package.json" (
    echo ERROR: Not in MultiMC Hub folder!
    echo Please run this from the MultiMC Hub folder.
    pause
    exit /b 1
) else (
    echo OK: Found package.json
)

echo.
echo Step 2: Installing dependencies...
echo.

REM Install dependencies
echo Installing Node.js dependencies...
echo This may take a few minutes...
npm install --silent

if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies!
    echo.
    echo Trying with npm install...
    npm install --silent
    if %errorlevel% neq 0 (
        echo ERROR: Installation failed!
        echo.
        echo Please try:
        echo 1. Running as administrator
        echo 2. Checking your internet connection
        echo 3. Running: npm install manually
        pause
        exit /b 1
    )
)

echo.
echo Step 3: Creating startup shortcuts...
echo.

REM Create a simple startup script
echo Creating startup script...
(
echo @echo off
echo title MultiMC Hub
echo cd /d "%~dp0"
echo npm start
echo pause
) > "start-multimc.bat"

echo OK: Created start-multimc.bat

echo.
echo ========================================
echo    Installation Complete!
echo ========================================
echo.
echo MultiMC Hub has been installed successfully!
echo.
echo To start MultiMC Hub:
echo 1. Double-click start-multimc.bat
echo 2. Or run: npm start
echo.
echo If you encounter any issues:
echo 1. Run troubleshoot-windows.bat
echo 2. Check the README.md file
echo 3. Report issues on GitHub
echo.
pause 