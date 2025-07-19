@echo off
title MultiMC Hub Installer
color 0B

echo.
echo ========================================
echo    MultiMC Hub - Installation Wizard
echo ========================================
echo.
echo Welcome to MultiMC Hub!
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
    pause
)

echo Step 1: Checking system requirements...
echo.

REM Check if Node.js is installed
echo Checking for Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is not installed.
    echo.
    echo Installing Node.js...
    echo.
    echo Please wait while we download and install Node.js...
    echo.
    
    REM Download Node.js installer
    powershell -Command "& {Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.10.0/node-v20.10.0-x64.msi' -OutFile 'nodejs-installer.msi'}"
    
    if exist "nodejs-installer.msi" (
        echo Installing Node.js...
        msiexec /i nodejs-installer.msi /quiet /norestart
        
        REM Wait for installation
        timeout /t 30 /nobreak >nul
        
        REM Clean up installer
        del nodejs-installer.msi
        
        echo Node.js installation completed!
        echo.
        
        REM Refresh environment variables
        call refreshenv.cmd >nul 2>&1
    ) else (
        echo Failed to download Node.js installer.
        echo.
        echo Please manually install Node.js from:
        echo https://nodejs.org/
        echo.
        pause
        exit /b 1
    )
) else (
    echo Node.js is already installed.
)

REM Check if Git is installed
echo.
echo Checking for Git...
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Git is not installed.
    echo.
    echo Installing Git...
    echo.
    
    REM Download Git installer
    powershell -Command "& {Invoke-WebRequest -Uri 'https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/Git-2.43.0-64-bit.exe' -OutFile 'git-installer.exe'}"
    
    if exist "git-installer.exe" (
        echo Installing Git...
        git-installer.exe /VERYSILENT /NORESTART
        
        REM Wait for installation
        timeout /t 30 /nobreak >nul
        
        REM Clean up installer
        del git-installer.exe
        
        echo Git installation completed!
        echo.
        
        REM Refresh environment variables
        call refreshenv.cmd >nul 2>&1
    ) else (
        echo Failed to download Git installer.
        echo.
        echo Please manually install Git from:
        echo https://git-scm.com/
        echo.
        pause
        exit /b 1
    )
) else (
    echo Git is already installed.
)

echo.
echo Step 2: Installing MultiMC Hub dependencies...
echo.

REM Install dependencies
if not exist "node_modules" (
    echo Installing Node.js packages...
    echo This may take a few minutes...
    echo.
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies!
        echo.
        pause
        exit /b 1
    )
    echo Dependencies installed successfully!
    echo.
) else (
    echo Dependencies are already installed.
    echo.
)

echo.
echo Step 3: Creating desktop shortcut...
echo.

REM Create desktop shortcut
echo Creating desktop shortcut...
powershell -Command "& {$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\MultiMC Hub.lnk'); $Shortcut.TargetPath = '%~dp0start.bat'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.Description = 'MultiMC Hub - Minecraft Server Management'; $Shortcut.Save()}"

if exist "%USERPROFILE%\Desktop\MultiMC Hub.lnk" (
    echo Desktop shortcut created successfully!
) else (
    echo Failed to create desktop shortcut.
)

echo.
echo Step 4: Setting up auto-startup...
echo.

REM Ask if user wants to add to startup
set /p STARTUP_CHOICE="Would you like MultiMC Hub to start automatically when you log in? (y/n): "
if /i "%STARTUP_CHOICE%"=="y" (
    echo Adding to startup...
    powershell -Command "& {$WshShell = New-Object -comObject WScript.Shell; $Startup = $WshShell.SpecialFolders('Startup'); $Shortcut = $WshShell.CreateShortcut($Startup + '\MultiMC Hub.lnk'); $Shortcut.TargetPath = '%~dp0start.bat'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.Description = 'MultiMC Hub - Minecraft Server Management'; $Shortcut.Save()}"
    echo Added to startup successfully!
) else (
    echo Skipping startup configuration.
)

echo.
echo ========================================
echo    Installation Complete!
echo ========================================
echo.
echo MultiMC Hub has been successfully installed!
echo.
echo What's next:
echo 1. Double-click the "MultiMC Hub" shortcut on your desktop
echo 2. Or run "start.bat" in this folder
echo.
echo The application will:
echo - Check for updates automatically
echo - Install any missing dependencies
echo - Launch the MultiMC Hub interface
echo.
echo Thank you for installing MultiMC Hub!
echo.
pause 