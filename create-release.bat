@echo off
title MultiMC Hub - Release Creator
color 0A

echo.
echo ========================================
echo    MultiMC Hub - Release Creator
echo ========================================
echo.

REM Check if version is provided
if "%1"=="" (
    echo ❌ Error: Please provide a version number
    echo.
    echo Usage: create-release.bat v1.0.0
    echo Example: create-release.bat v1.1.0
    echo.
    echo This will:
    echo 1. Create a new version tag
    echo 2. Push the tag to GitHub
    echo 3. Trigger automatic release creation
    echo 4. Build installers for all platforms
    echo.
    pause
    exit /b 1
)

set VERSION=%1

echo 📋 Release Information:
echo   Version: %VERSION%
echo   Repository: billibobby/multimc
echo   Owner: @billibobby
echo.

REM Confirm release
set /p CONFIRM="🤔 Are you sure you want to create release %VERSION%? (y/N): "
if /i not "%CONFIRM%"=="y" (
    echo ❌ Release cancelled
    pause
    exit /b 1
)

echo.
echo 🔧 Creating release %VERSION%...

REM Check if we're on main branch
for /f "tokens=*" %%i in ('git branch --show-current') do set CURRENT_BRANCH=%%i
if not "%CURRENT_BRANCH%"=="main" (
    echo ⚠️  Warning: You're not on the main branch (currently on %CURRENT_BRANCH%)
    set /p CONTINUE="🤔 Continue anyway? (y/N): "
    if /i not "%CONTINUE%"=="y" (
        echo ❌ Release cancelled
        pause
        exit /b 1
    )
)

REM Check if there are uncommitted changes
git status --porcelain >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  Warning: You have uncommitted changes
    git status --short
    echo.
    set /p COMMIT="🤔 Commit changes before creating release? (y/N): "
    if /i "%COMMIT%"=="y" (
        echo 📝 Committing changes...
        git add .
        git commit -m "🔧 Prepare for release %VERSION%"
        git push origin main
    ) else (
        echo ❌ Please commit or stash your changes before creating a release
        pause
        exit /b 1
    )
)

REM Create and push tag
echo 🏷️  Creating version tag %VERSION%...
git tag %VERSION%

echo 📤 Pushing tag to GitHub...
git push origin %VERSION%

echo.
echo ✅ Release process started!
echo.
echo 📋 What happens next:
echo 1. GitHub Actions will automatically:
echo    - Build the application
echo    - Create installers for all platforms
echo    - Create a new release on GitHub
echo    - Upload all files to the release
echo.
echo 2. Users can download the update from:
echo    https://github.com/billibobby/multimc/releases
echo.
echo 3. The repository remains protected:
echo    - No external changes allowed
echo    - Only you can modify the code
echo    - Users get updates without access to source
echo.
echo 🔗 Monitor the release process:
echo    https://github.com/billibobby/multimc/actions
echo.
echo 🎉 Release %VERSION% is being created automatically!
echo.
pause 