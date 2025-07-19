@echo off
chcp 65001 >nul
echo 🚀 Starting MultiMC Hub with External Hosting...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 16+ first.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

REM Check Node.js version
for /f "tokens=1,2 delims=." %%a in ('node --version') do set NODE_VERSION=%%a
set NODE_VERSION=%NODE_VERSION:~1%
if %NODE_VERSION% LSS 16 (
    echo ❌ Node.js version 16+ is required. Current version: 
    node --version
    echo Please update Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js version: 
node --version

REM Check if package.json exists
if not exist "package.json" (
    echo ❌ package.json not found. Are you in the correct directory?
    pause
    exit /b 1
)

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    
    if %errorlevel% neq 0 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
    
    echo ✅ Dependencies installed successfully
) else (
    echo ✅ Dependencies already installed
)

REM Install Electron dependencies
echo 🔧 Installing Electron dependencies...
npm run postinstall

if %errorlevel% neq 0 (
    echo ❌ Failed to install Electron dependencies
    pause
    exit /b 1
)

echo ✅ Electron dependencies installed

REM Check if this is a git repository
if not exist ".git" (
    echo 📝 Initializing git repository...
    git init
    git add .
    git commit -m "Initial commit: MultiMC Hub with External Hosting"
    echo ✅ Git repository initialized
    echo 💡 Don't forget to add your GitHub remote:
    echo    git remote add origin https://github.com/YOUR_USERNAME/multimc.git
    echo    git push -u origin main
)

REM Start the application
echo 🎮 Starting MultiMC Hub...
echo 📱 The application will open in a new window
echo 🌐 External hosting feature is available in the 'External Hosting' tab
echo.
echo Press Ctrl+C to stop the application
echo.

npm run dev 