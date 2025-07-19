#!/bin/bash

# MultiMC Hub Startup Script

echo "🚀 Starting MultiMC Hub..."
echo "📋 Checking prerequisites..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16 or higher."
    exit 1
fi

# Check if Java is installed
if ! command -v java &> /dev/null; then
    echo "⚠️  Java is not installed. Minecraft servers require Java 8 or higher."
    echo "   Please install Java to use server features."
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "✅ Starting application..."
npm start 