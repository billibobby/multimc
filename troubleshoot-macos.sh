#!/bin/bash

# MultiMC Hub - macOS Troubleshooter
# This script will check for common issues and fix them

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}    MultiMC Hub - macOS Troubleshooter${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Clear screen and show header
clear
print_header
print_status "This tool will check for common issues and fix them."
echo ""

# Check if Node.js is installed
echo "[1/6] Checking Node.js..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is NOT installed!"
    echo ""
    echo "Please install Node.js from: https://nodejs.org/"
    echo "Choose the LTS version (recommended)."
    echo ""
    read -p "Press Enter to exit..."
    exit 1
else
    NODE_VERSION=$(node --version)
    print_status "Node.js is installed: $NODE_VERSION"
fi

# Check if npm is working
echo ""
echo "[2/6] Checking npm..."
if ! command -v npm &> /dev/null; then
    print_error "npm is not working properly!"
    echo ""
    echo "Try restarting your computer and running this again."
    echo ""
    read -p "Press Enter to exit..."
    exit 1
else
    NPM_VERSION=$(npm --version)
    print_status "npm is working: $NPM_VERSION"
fi

# Check if package.json exists
echo ""
echo "[3/6] Checking project files..."
if [ ! -f "package.json" ]; then
    print_error "package.json not found!"
    echo ""
    echo "Please make sure you're in the correct MultiMC Hub folder."
    echo ""
    read -p "Press Enter to exit..."
    exit 1
else
    print_status "package.json found"
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_error "node_modules not found!"
    echo ""
    print_status "Installing dependencies..."
    if npm install; then
        print_status "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies!"
        echo ""
        echo "Try checking your internet connection or run as administrator."
        echo ""
        read -p "Press Enter to exit..."
        exit 1
    fi
else
    print_status "node_modules found"
fi

# Check for port conflicts
echo ""
echo "[4/6] Checking for port conflicts..."
echo "Checking ports 3001-3003 and 25565..."

# Check port 3001
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_warning "Port 3001 is in use"
    PORT_3001_IN_USE=1
else
    print_status "Port 3001 is available"
fi

# Check port 3002
if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_warning "Port 3002 is in use"
    PORT_3002_IN_USE=1
else
    print_status "Port 3002 is available"
fi

# Check port 3003
if lsof -Pi :3003 -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_warning "Port 3003 is in use"
    PORT_3003_IN_USE=1
else
    print_status "Port 3003 is available"
fi

# Check port 25565 (Minecraft default)
if lsof -Pi :25565 -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_warning "Port 25565 is in use (Minecraft default port)"
    PORT_25565_IN_USE=1
else
    print_status "Port 25565 is available"
fi

# Check Java
echo ""
echo "[5/6] Checking Java..."
if ! command -v java &> /dev/null; then
    print_error "Java is NOT installed!"
    echo ""
    echo "Please install Java from: https://adoptium.net/"
    echo "Choose the latest LTS version."
    echo ""
    read -p "Press Enter to exit..."
    exit 1
else
    JAVA_VERSION=$(java -version 2>&1 | head -n 1)
    print_status "Java is installed: $JAVA_VERSION"
fi

# Test the application
echo ""
echo "[6/6] Testing application startup..."
echo ""
print_status "Starting MultiMC Hub in test mode..."
echo "(This will show any startup errors)"
echo ""

# Try to start the app with error output
if node src/main.js 2>&1; then
    echo ""
    print_status "Application started successfully!"
    echo ""
    echo "The app should now be running normally."
    echo ""
else
    echo ""
    print_error "Application failed to start!"
    echo ""
    echo "Common solutions:"
    echo "1. Make sure no other applications are using the required ports"
    echo "2. Try running with sudo (administrator privileges)"
    echo "3. Check if your firewall is blocking the application"
    echo "4. Make sure all dependencies are installed correctly"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    Troubleshooting Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ ! -z "$PORT_3001_IN_USE" ]; then
    print_warning "Port 3001 is in use - MultiMC Hub will use an alternative port"
fi
if [ ! -z "$PORT_3002_IN_USE" ]; then
    print_warning "Port 3002 is in use - MultiMC Hub will use an alternative port"
fi
if [ ! -z "$PORT_3003_IN_USE" ]; then
    print_warning "Port 3003 is in use - MultiMC Hub will use an alternative port"
fi
if [ ! -z "$PORT_25565_IN_USE" ]; then
    print_warning "Port 25565 is in use - You may need to change Minecraft server port"
fi

echo ""
echo "If you're still having issues:"
echo "1. Try running with sudo (administrator privileges)"
echo "2. Check macOS Security & Privacy settings"
echo "3. Make sure no other Minecraft servers are running"
echo "4. Restart your computer and try again"
echo ""

echo "Press Enter to close this window..."
read -p "" 