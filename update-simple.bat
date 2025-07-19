@echo off
title MultiMC Hub - Simple Updater
color 0B

echo.
echo ========================================
echo    MultiMC Hub - Simple Update Tool
echo ========================================
echo.
echo This tool will update MultiMC Hub to the latest version.
echo.

REM Check if git is available
echo Checking if Git is installed...
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Git is not installed!
    echo.
    echo Please install Git from: https://git-scm.com/
    echo Then run this updater again.
    echo.
    echo Press any key to close...
    pause >nul
    exit /b 1
)

echo Git is installed. Checking for updates...
echo.

REM Fetch latest changes
echo Fetching latest changes from GitHub...
git fetch origin main
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to fetch updates!
    echo.
    echo Please check your internet connection.
    echo.
    echo Press any key to close...
    pause >nul
    exit /b 1
)

echo Fetch completed successfully!
echo.

REM Check if we need to update
echo Checking if update is needed...
for /f "tokens=*" %%i in ('git rev-parse HEAD') do set LOCAL=%%i
for /f "tokens=*" %%i in ('git rev-parse origin/main') do set REMOTE=%%i

echo Current version: %LOCAL%
echo Latest version:  %REMOTE%
echo.

if "%LOCAL%"=="%REMOTE%" (
    echo MultiMC Hub is already up to date!
    echo.
    echo Press any key to close...
    pause >nul
    exit /b 0
)

echo Update is available!
echo.
set /p UPDATE_CHOICE="Would you like to update now? (y/n): "

if /i "%UPDATE_CHOICE%"=="y" (
    echo.
    echo Updating MultiMC Hub...
    echo.
    
    REM Pull latest changes
    git pull origin main
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: Failed to pull updates!
        echo.
        echo Press any key to close...
        pause >nul
        exit /b 1
    )
    
    echo Update completed successfully!
    echo.
    echo Installing any new dependencies...
    echo This may take a few minutes...
    echo.
    
    npm install
    if %errorlevel% neq 0 (
        echo.
        echo WARNING: Some dependencies failed to install.
        echo The app may still work, but some features might be limited.
        echo.
    ) else (
        echo Dependencies installed successfully!
        echo.
    )
    
    echo.
    echo ========================================
    echo    Update Complete!
    echo ========================================
    echo.
    echo MultiMC Hub has been updated successfully!
    echo.
    echo What's new in this update:
    echo - Fixed port conflicts and initialization issues
    echo - Added better error handling
    echo - Updated dependencies to remove warnings
    echo - Improved server startup process
    echo - Fixed Windows batch file closing issues
    echo.
    echo You can now run MultiMC Hub normally.
    echo.
) else (
    echo.
    echo Update cancelled.
    echo.
)

echo Press any key to close this window...
pause >nul 