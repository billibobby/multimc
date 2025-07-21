@echo off
title MultiMC Hub - Start Test
color 0B

echo.
echo ========================================
echo    MultiMC Hub - Start Test
echo ========================================
echo.
echo This will test if MultiMC Hub can start properly.
echo.

REM Check if we're in the right place
if not exist "package.json" (
    echo ❌ ERROR: Not in MultiMC Hub folder!
    echo Please run this from the MultiMC Hub folder.
    pause
    exit /b 1
)

REM Check Node.js
echo [1/4] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found!
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do echo ✅ Node.js: %%i
)

REM Check npm
echo.
echo [2/4] Checking npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm not found!
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm --version') do echo ✅ npm: %%i
)

REM Check dependencies
echo.
echo [3/4] Checking dependencies...
if not exist "node_modules" (
    echo ❌ Dependencies not installed!
    echo Run install.bat first.
    pause
    exit /b 1
) else (
    echo ✅ Dependencies found
)

REM Test basic functionality
echo.
echo [4/4] Testing basic functionality...
echo Starting test mode...

REM Create a simple test to check if Electron loads
echo console.log('Testing Electron...'); > test-electron.js
echo try { >> test-electron.js
echo   const electron = require('electron'); >> test-electron.js
echo   console.log('✅ Electron loaded successfully'); >> test-electron.js
echo   console.log('✅ app object:', typeof electron.app); >> test-electron.js
echo   console.log('✅ BrowserWindow object:', typeof electron.BrowserWindow); >> test-electron.js
echo } catch (error) { >> test-electron.js
echo   console.error('❌ Electron failed:', error.message); >> test-electron.js
echo   process.exit(1); >> test-electron.js
echo } >> test-electron.js

node test-electron.js
if %errorlevel% neq 0 (
    echo ❌ Electron test failed!
    del test-electron.js
    pause
    exit /b 1
)

del test-electron.js

echo.
echo ========================================
echo    Test Results
echo ========================================
echo.
echo ✅ All basic tests passed!
echo.
echo MultiMC Hub should be able to start properly.
echo.
echo To start the application:
echo 1. Run start.bat
echo 2. Or use: npm start
echo.
pause 