#!/bin/bash

# MultiMC Hub Launcher for macOS
# This script provides a user-friendly way to launch MultiMC Hub

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
    echo -e "${BLUE}    MultiMC Hub - Minecraft Server Hub${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Clear screen and show header
clear
print_header
print_status "Starting MultiMC Hub..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed!"
    echo ""
    echo "Please download and install Node.js from:"
    echo "https://nodejs.org/"
    echo ""
    echo "After installing Node.js, run this launcher again."
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    print_error "npm is not available!"
    echo ""
    echo "Please ensure Node.js is properly installed."
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    echo "This may take a few minutes on first run..."
    echo ""
    
    if npm install; then
        print_status "Dependencies installed successfully!"
        echo ""
    else
        print_error "Failed to install dependencies!"
        echo ""
        read -p "Press Enter to exit..."
        exit 1
    fi
fi

# Check for updates
print_status "Checking for updates..."
if command -v git &> /dev/null; then
    # Fetch latest changes
    git fetch origin main > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        # Check if we're behind the remote
        LOCAL=$(git rev-parse HEAD)
        REMOTE=$(git rev-parse origin/main)
        
        if [ "$LOCAL" != "$REMOTE" ]; then
            echo ""
            echo -e "${BLUE}========================================${NC}"
            echo -e "${BLUE}           UPDATE AVAILABLE!${NC}"
            echo -e "${BLUE}========================================${NC}"
            echo ""
            echo "A new version of MultiMC Hub is available."
            echo ""
            read -p "Would you like to update now? (y/n): " UPDATE_CHOICE
            
            if [[ $UPDATE_CHOICE =~ ^[Yy]$ ]]; then
                echo ""
                print_status "Updating MultiMC Hub..."
                
                if git pull origin main; then
                    print_status "Update completed successfully!"
                    echo ""
                    print_status "Installing any new dependencies..."
                    npm install
                    echo ""
                    print_status "Update finished! Starting MultiMC Hub..."
                    echo ""
                else
                    print_warning "Update failed! Starting with current version..."
                    echo ""
                fi
            else
                print_status "Starting with current version..."
                echo ""
            fi
        else
            print_status "MultiMC Hub is up to date!"
            echo ""
        fi
    fi
else
    print_warning "Could not check for updates (git not available)"
    print_status "Starting MultiMC Hub..."
    echo ""
fi

# Start the application
print_status "Launching MultiMC Hub..."
echo ""
echo "Please wait while the application loads..."
echo ""
echo -e "${BLUE}========================================${NC}"
echo ""

npm start

# If we get here, the app has closed
echo ""
print_status "MultiMC Hub has been closed."
echo ""
read -p "Press Enter to exit..." 