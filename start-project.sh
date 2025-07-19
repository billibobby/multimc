#!/bin/bash

# MultiMC Hub Startup Script
echo "🚀 Starting MultiMC Hub with External Hosting..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    echo "Download from: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16+ is required. Current version: $(node -v)"
    echo "Please update Node.js from: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Are you in the correct directory?"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
    
    echo "✅ Dependencies installed successfully"
else
    echo "✅ Dependencies already installed"
fi

# Install Electron dependencies
echo "🔧 Installing Electron dependencies..."
npm run postinstall

if [ $? -ne 0 ]; then
    echo "❌ Failed to install Electron dependencies"
    exit 1
fi

echo "✅ Electron dependencies installed"

# Check if this is a git repository
if [ ! -d ".git" ]; then
    echo "📝 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit: MultiMC Hub with External Hosting"
    echo "✅ Git repository initialized"
    echo "💡 Don't forget to add your GitHub remote:"
    echo "   git remote add origin https://github.com/YOUR_USERNAME/multimc.git"
    echo "   git push -u origin main"
fi

# Start the application
echo "🎮 Starting MultiMC Hub..."
echo "📱 The application will open in a new window"
echo "🌐 External hosting feature is available in the 'External Hosting' tab"
echo ""
echo "Press Ctrl+C to stop the application"
echo ""

npm run dev 