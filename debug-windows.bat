@echo off
title MultiMC Hub - Debug Tool
color 0E

echo.
echo ========================================
echo    MultiMC Hub - Debug Tool
echo ========================================
echo.
echo This tool will help identify why the app is closing instantly.
echo It will stay open and show all errors.
echo.

REM Create a log file
set LOGFILE=debug-log.txt
echo MultiMC Hub Debug Log - %date% %time% > %LOGFILE%

echo [DEBUG] Starting debug process... >> %LOGFILE%
echo [DEBUG] Current directory: %CD% >> %LOGFILE%

REM Check if we're in the right directory
echo.
echo [1/8] Checking current directory...
echo Current directory: %CD%
echo [DEBUG] Checking current directory... >> %LOGFILE%

if not exist "package.json" (
    echo ❌ ERROR: package.json not found!
    echo ❌ ERROR: package.json not found! >> %LOGFILE%
    echo.
    echo Please make sure you're in the MultiMC Hub folder.
    echo.
    echo Press any key to close...
    pause >nul
    exit /b 1
) else (
    echo ✅ package.json found
    echo [DEBUG] package.json found >> %LOGFILE%
)

REM Check Node.js
echo.
echo [2/8] Checking Node.js...
echo [DEBUG] Checking Node.js... >> %LOGFILE%

node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Node.js is not installed!
    echo ❌ ERROR: Node.js is not installed! >> %LOGFILE%
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo.
    echo Press any key to close...
    pause >nul
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo ✅ Node.js is installed: %NODE_VERSION%
    echo [DEBUG] Node.js version: %NODE_VERSION% >> %LOGFILE%
)

REM Check npm
echo.
echo [3/8] Checking npm...
echo [DEBUG] Checking npm... >> %LOGFILE%

npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: npm is not working!
    echo ❌ ERROR: npm is not working! >> %LOGFILE%
    echo.
    echo Try restarting your computer.
    echo.
    echo Press any key to close...
    pause >nul
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo ✅ npm is working: %NPM_VERSION%
    echo [DEBUG] npm version: %NPM_VERSION% >> %LOGFILE%
)

REM Check node_modules
echo.
echo [4/8] Checking dependencies...
echo [DEBUG] Checking dependencies... >> %LOGFILE%

if not exist "node_modules" (
    echo ❌ ERROR: node_modules not found!
    echo ❌ ERROR: node_modules not found! >> %LOGFILE%
    echo.
    echo Installing dependencies...
    echo [DEBUG] Installing dependencies... >> %LOGFILE%
    
    npm install
    if %errorlevel% neq 0 (
        echo ❌ ERROR: Failed to install dependencies!
        echo ❌ ERROR: Failed to install dependencies! >> %LOGFILE%
        echo.
        echo Try running as administrator.
        echo.
        echo Press any key to close...
        pause >nul
        exit /b 1
    ) else (
        echo ✅ Dependencies installed successfully
        echo [DEBUG] Dependencies installed successfully >> %LOGFILE%
    )
) else (
    echo ✅ node_modules found
    echo [DEBUG] node_modules found >> %LOGFILE%
)

REM Check if main.js exists
echo.
echo [5/8] Checking application files...
echo [DEBUG] Checking application files... >> %LOGFILE%

if not exist "src\main.js" (
    echo ❌ ERROR: src\main.js not found!
    echo ❌ ERROR: src\main.js not found! >> %LOGFILE%
    echo.
    echo The application files are missing.
    echo Please download the complete MultiMC Hub files.
    echo.
    echo Press any key to close...
    pause >nul
    exit /b 1
) else (
    echo ✅ src\main.js found
    echo [DEBUG] src\main.js found >> %LOGFILE%
)

REM Check package.json content
echo.
echo [6/8] Checking package.json...
echo [DEBUG] Checking package.json... >> %LOGFILE%

echo [DEBUG] Reading package.json... >> %LOGFILE%
type package.json | find "scripts" >> %LOGFILE% 2>&1

REM Try to run npm start with error capture
echo.
echo [7/8] Testing npm start...
echo [DEBUG] Testing npm start... >> %LOGFILE%

echo Testing npm start (this may take a moment)...
echo [DEBUG] Running npm start... >> %LOGFILE%

REM Run npm start and capture output
npm start > npm-output.txt 2>&1
set NPM_EXIT_CODE=%errorlevel%

echo [DEBUG] npm start exit code: %NPM_EXIT_CODE% >> %LOGFILE%

if %NPM_EXIT_CODE% neq 0 (
    echo ❌ ERROR: npm start failed with exit code %NPM_EXIT_CODE%
    echo ❌ ERROR: npm start failed with exit code %NPM_EXIT_CODE% >> %LOGFILE%
    echo.
    echo The last 20 lines of npm output:
    echo [DEBUG] Showing npm output... >> %LOGFILE%
    echo.
    echo ========================================
    echo NPM OUTPUT:
    echo ========================================
    if exist "npm-output.txt" (
        powershell "Get-Content npm-output.txt | Select-Object -Last 20"
        echo [DEBUG] npm output saved to npm-output.txt >> %LOGFILE%
    ) else (
        echo No output file created
        echo [DEBUG] No output file created >> %LOGFILE%
    )
    echo ========================================
    echo.
) else (
    echo ✅ npm start completed successfully
    echo [DEBUG] npm start completed successfully >> %LOGFILE%
)

REM Check for common issues
echo.
echo [8/8] Checking for common issues...
echo [DEBUG] Checking for common issues... >> %LOGFILE%

REM Check if Electron is installed
echo Checking if Electron is installed...
npm list electron >> %LOGFILE% 2>&1
if %errorlevel% neq 0 (
    echo ❌ WARNING: Electron may not be installed properly
    echo ❌ WARNING: Electron may not be installed properly >> %LOGFILE%
) else (
    echo ✅ Electron appears to be installed
    echo [DEBUG] Electron appears to be installed >> %LOGFILE%
)

REM Check for port conflicts
echo Checking for port conflicts...
netstat -an | find "3001" >nul 2>&1
if %errorlevel% equ 0 (
    echo ❌ WARNING: Port 3001 is in use
    echo ❌ WARNING: Port 3001 is in use >> %LOGFILE%
)
netstat -an | find "3002" >nul 2>&1
if %errorlevel% equ 0 (
    echo ❌ WARNING: Port 3002 is in use
    echo ❌ WARNING: Port 3002 is in use >> %LOGFILE%
)
netstat -an | find "3003" >nul 2>&1
if %errorlevel% equ 0 (
    echo ❌ WARNING: Port 3003 is in use
    echo ❌ WARNING: Port 3003 is in use >> %LOGFILE%
)

echo.
echo ========================================
echo    Debug Complete!
echo ========================================
echo.
echo Debug log saved to: %LOGFILE%
echo.
echo If npm start failed, the error details are above.
echo.
echo Common solutions:
echo 1. Run as administrator
echo 2. Check your antivirus settings
echo 3. Make sure no other applications are using the ports
echo 4. Try restarting your computer
echo.
echo Press any key to close...
pause >nul 