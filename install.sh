#!/bin/bash

# MultiMC Hub Installer for macOS
# This script provides a user-friendly installation process

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
    echo -e "${BLUE}    MultiMC Hub - Installation Wizard${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Clear screen and show header
clear
print_header
print_status "Welcome to MultiMC Hub!"
echo "This installer will help you set up everything needed."
echo ""

# Check if running as administrator
if [ "$EUID" -ne 0 ]; then
    print_warning "This installer is not running as administrator."
    echo "Some features may not work properly."
    echo ""
    echo "To run as administrator, use:"
    echo "sudo ./install.sh"
    echo ""
    read -p "Press Enter to continue anyway..."
fi

echo "Step 1: Checking system requirements..."
echo ""

# Check if Homebrew is installed
print_status "Checking for Homebrew..."
if ! command -v brew &> /dev/null; then
    print_status "Homebrew is not installed. Installing..."
    echo ""
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    if [ $? -eq 0 ]; then
        print_status "Homebrew installed successfully!"
        echo ""
        
        # Add Homebrew to PATH
        if [[ -f "/opt/homebrew/bin/brew" ]]; then
            echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
            eval "$(/opt/homebrew/bin/brew shellenv)"
        elif [[ -f "/usr/local/bin/brew" ]]; then
            echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
            eval "$(/usr/local/bin/brew shellenv)"
        fi
    else
        print_error "Failed to install Homebrew!"
        echo "Please manually install Homebrew from:"
        echo "https://brew.sh/"
        echo ""
        exit 1
    fi
else
    print_status "Homebrew is already installed."
fi

# Check if Node.js is installed
print_status "Checking for Node.js..."
if ! command -v node &> /dev/null; then
    print_status "Node.js is not installed. Installing..."
    echo ""
    brew install node
    
    if [ $? -eq 0 ]; then
        print_status "Node.js installed successfully!"
        echo ""
    else
        print_error "Failed to install Node.js!"
        echo "Please manually install Node.js from:"
        echo "https://nodejs.org/"
        echo ""
        exit 1
    fi
else
    print_status "Node.js is already installed."
fi

# Check if Git is installed
print_status "Checking for Git..."
if ! command -v git &> /dev/null; then
    print_status "Git is not installed. Installing..."
    echo ""
    brew install git
    
    if [ $? -eq 0 ]; then
        print_status "Git installed successfully!"
        echo ""
    else
        print_error "Failed to install Git!"
        echo "Please manually install Git from:"
        echo "https://git-scm.com/"
        echo ""
        exit 1
    fi
else
    print_status "Git is already installed."
fi

echo ""
echo "Step 2: Installing MultiMC Hub dependencies..."
echo ""

# Install dependencies
if [ ! -d "node_modules" ]; then
    print_status "Installing Node.js packages..."
    echo "This may take a few minutes..."
    echo ""
    
    if npm install; then
        print_status "Dependencies installed successfully!"
        echo ""
    else
        print_error "Failed to install dependencies!"
        echo ""
        exit 1
    fi
else
    print_status "Dependencies are already installed."
    echo ""
fi

echo ""
echo "Step 3: Creating desktop shortcut..."
echo ""

# Create desktop shortcut
print_status "Creating desktop shortcut..."
cat > ~/Desktop/MultiMC\ Hub.command << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
cd "$(dirname "$0")/../Desktop/multimc"
./start.sh
EOF

chmod +x ~/Desktop/MultiMC\ Hub.command

if [ -f ~/Desktop/MultiMC\ Hub.command ]; then
    print_status "Desktop shortcut created successfully!"
else
    print_warning "Failed to create desktop shortcut."
fi

echo ""
echo "Step 4: Setting up auto-startup..."
echo ""

# Ask if user wants to add to startup
read -p "Would you like MultiMC Hub to start automatically when you log in? (y/n): " STARTUP_CHOICE

if [[ $STARTUP_CHOICE =~ ^[Yy]$ ]]; then
    print_status "Adding to startup..."
    
    # Create startup script
    cat > ~/Library/LaunchAgents/com.multimc.hub.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.multimc.hub</string>
    <key>ProgramArguments</key>
    <array>
        <string>$(pwd)/start.sh</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>WorkingDirectory</key>
    <string>$(pwd)</string>
</dict>
</plist>
EOF
    
    # Load the launch agent
    launchctl load ~/Library/LaunchAgents/com.multimc.hub.plist
    
    print_status "Added to startup successfully!"
else
    print_status "Skipping startup configuration."
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    Installation Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
print_status "MultiMC Hub has been successfully installed!"
echo ""
echo "What's next:"
echo "1. Double-click the 'MultiMC Hub' shortcut on your desktop"
echo "2. Or run './start.sh' in this folder"
echo ""
echo "The application will:"
echo "- Check for updates automatically"
echo "- Install any missing dependencies"
echo "- Launch the MultiMC Hub interface"
echo ""
echo "Thank you for installing MultiMC Hub!"
echo ""
read -p "Press Enter to exit..." 