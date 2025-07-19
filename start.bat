@echo off
chcp 65001 >nul
echo 🚀 Starting MultiMC Hub...
echo 📋 Checking prerequisites...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 16 or higher.
    echo    Download from: https://nodejs.org/
    pause
    exit /b 1
)

REM Check if Java is installed
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Java is not installed. Minecraft servers require Java 8 or higher.
    echo    Please install Java to use server features.
    echo    Download from: https://adoptium.net/
)

REM Check if dependencies are installed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
)

echo ✅ Starting application...
npm start
pause 