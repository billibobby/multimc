#!/bin/bash

# MultiMC Hub - Simple Updater for macOS
# This script updates MultiMC Hub to the latest version

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
    echo -e "${BLUE}    MultiMC Hub - Simple Update Tool${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Clear screen and show header
clear
print_header
print_status "This tool will update MultiMC Hub to the latest version."
echo ""

# Check if git is available
print_status "Checking if Git is installed..."
if ! command -v git &> /dev/null; then
    print_error "Git is not installed!"
    echo ""
    echo "Please install Git from: https://git-scm.com/"
    echo "Then run this updater again."
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

print_status "Git is installed. Checking for updates..."
echo ""

# Fetch latest changes
print_status "Fetching latest changes from GitHub..."
if ! git fetch origin main; then
    print_error "Failed to fetch updates!"
    echo ""
    echo "Please check your internet connection."
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

print_status "Fetch completed successfully!"
echo ""

# Check if we need to update
print_status "Checking if update is needed..."
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

echo "Current version: $LOCAL"
echo "Latest version:  $REMOTE"
echo ""

if [ "$LOCAL" == "$REMOTE" ]; then
    print_status "MultiMC Hub is already up to date!"
    echo ""
    read -p "Press Enter to exit..."
    exit 0
fi

print_status "Update is available!"
echo ""
read -p "Would you like to update now? (y/n): " UPDATE_CHOICE

if [[ $UPDATE_CHOICE =~ ^[Yy]$ ]]; then
    echo ""
    print_status "Updating MultiMC Hub..."
    echo ""
    
    # Pull latest changes
    if ! git pull origin main; then
        print_error "Failed to pull updates!"
        echo ""
        read -p "Press Enter to exit..."
        exit 1
    fi
    
    print_status "Update completed successfully!"
    echo ""
    print_status "Installing any new dependencies..."
    echo "This may take a few minutes..."
    echo ""
    
    if npm install; then
        print_status "Dependencies installed successfully!"
        echo ""
    else
        print_warning "Some dependencies failed to install."
        echo "The app may still work, but some features might be limited."
        echo ""
    fi
    
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}    Update Complete!${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    print_status "MultiMC Hub has been updated successfully!"
    echo ""
    echo "What's new in this update:"
    echo "- Fixed port conflicts and initialization issues"
    echo "- Added better error handling"
    echo "- Updated dependencies to remove warnings"
    echo "- Improved server startup process"
    echo "- Fixed Windows batch file closing issues"
    echo ""
    echo "You can now run MultiMC Hub normally."
    echo ""
else
    echo ""
    print_status "Update cancelled."
    echo ""
fi

echo "Press Enter to close this window..."
read -p "" 