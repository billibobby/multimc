@echo off
title MultiMC Hub Updater
color 0B

echo.
echo ========================================
echo    MultiMC Hub - Update Tool
echo ========================================
echo.
echo Checking for updates...
echo.

REM Check if git is available
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Git is not installed!
    echo.
    echo Please install Git from: https://git-scm.com/
    echo Then run this updater again.
    echo.
    pause
    exit /b 1
)

REM Check if we're in a git repository
git status >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: This is not a git repository!
    echo.
    echo Please download the full MultiMC Hub from:
    echo https://github.com/billibobby/multimc
    echo.
    pause
    exit /b 1
)

REM Fetch latest changes
echo Fetching latest changes from GitHub...
git fetch origin main
if %errorlevel% neq 0 (
    echo ERROR: Failed to fetch updates!
    echo.
    echo Please check your internet connection.
    echo.
    pause
    exit /b 1
)

REM Check if we're up to date
git status --porcelain >nul 2>&1
if %errorlevel% equ 0 (
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/main)
    if "%LOCAL%"=="%REMOTE%" (
        echo MultiMC Hub is already up to date!
        echo.
        pause
        exit /b 0
    )
)

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
    
    REM Pull latest changes
    git pull origin main
    if %errorlevel% neq 0 (
        echo ERROR: Failed to pull updates!
        echo.
        pause
        exit /b 1
    )
    
    echo Update completed successfully!
    echo.
    echo Installing any new dependencies...
    npm install
    if %errorlevel% neq 0 (
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
    echo.
    echo You can now run MultiMC Hub normally.
    echo.
) else (
    echo Update cancelled.
    echo.
)

pause 