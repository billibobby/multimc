#!/bin/bash

# MultiMC Hub Updater for macOS
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
    echo -e "${BLUE}    MultiMC Hub - Update Tool${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Clear screen and show header
clear
print_header
print_status "Checking for updates..."
echo ""

# Check if git is available
if ! command -v git &> /dev/null; then
    print_error "Git is not installed!"
    echo ""
    echo "Please install Git from: https://git-scm.com/"
    echo "Then run this updater again."
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# Check if we're in a git repository
if ! git status &> /dev/null; then
    print_error "This is not a git repository!"
    echo ""
    echo "Please download the full MultiMC Hub from:"
    echo "https://github.com/billibobby/multimc"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

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

# Check if we're up to date
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" == "$REMOTE" ]; then
    print_status "MultiMC Hub is already up to date!"
    echo ""
    read -p "Press Enter to exit..."
    exit 0
fi

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
    echo ""
    echo "You can now run MultiMC Hub normally."
    echo ""
else
    print_status "Update cancelled."
    echo ""
fi

read -p "Press Enter to exit..." 