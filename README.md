# MultiMC Hub 🎮

A powerful desktop application for multi-hosting Minecraft servers with live updates and seamless host transfer between friends. Perfect for gaming groups who want to share server hosting responsibilities!

## ✨ Features

### 🚀 **Multi-Hosting Capabilities**
- **Easy Host Transfer**: Transfer server hosting between friends with one click
- **Host Takeover**: Take over hosting from another friend when they go offline
- **Geographic Flexibility**: Host from anywhere - North Carolina to California and beyond!
- **Real-time Updates**: Live status updates and notifications

### 👥 **Friend Management**
- **User Profiles**: Set your display name and see your friends' names
- **Friend Detection**: Automatically detect other users on your network
- **Platform Recognition**: See what platform your friends are using (Windows/Mac/Linux)
- **Online Status**: Real-time online/offline status for all connected friends

### 🎯 **Server Management**
- **Vanilla & Forge Support**: Run both vanilla Minecraft and Forge modded servers
- **Version Management**: Download and manage multiple Minecraft server versions
- **Automatic Setup**: One-click server creation with optimal settings
- **Server Monitoring**: Real-time server status and player count

### 🔧 **System Intelligence**
- **Deep System Analysis**: Automatic detection of Java, disk space, and network
- **Dependency Management**: Auto-download missing Minecraft and Forge versions
- **Cross-Platform**: Works seamlessly on Windows, Mac, and Linux
- **Smart Recommendations**: Get suggestions for optimal setup

### 🎨 **Modern Interface**
- **Clean, Dark Theme**: Beautiful, modern UI that's easy on the eyes
- **Responsive Design**: Works great on different screen sizes
- **Intuitive Navigation**: Easy-to-use tabs and controls
- **Real-time Updates**: Live status indicators and notifications

## 🖥️ **Cross-Platform Support**

### Windows
- **Easy Installation**: Run `start.bat` for automatic setup
- **NSIS Installer**: Professional installation with desktop shortcuts
- **Portable Version**: No installation required option

### macOS
- **Native App**: Full macOS integration
- **DMG Package**: Easy drag-and-drop installation
- **Apple Silicon**: Optimized for both Intel and Apple Silicon Macs

### Linux
- **AppImage**: Universal Linux package
- **Deb Package**: Native Ubuntu/Debian support
- **Shell Script**: Easy startup with `start.sh`

## 🚀 **Quick Start**

### Prerequisites
- **Node.js 16+** - [Download here](https://nodejs.org/)
- **Java 8+** - [Download here](https://adoptium.net/)
- **Network Connection** - For peer discovery and updates

### Installation

#### Windows
```batch
# Download and extract the application
# Double-click start.bat to run
start.bat
```

#### macOS
```bash
# Download the DMG file
# Drag to Applications folder
# Or use the shell script:
chmod +x start.sh
./start.sh
```

#### Linux
```bash
# Make executable and run
chmod +x start.sh
./start.sh
```

### First Time Setup

1. **Launch the Application**
   - The app will automatically check your system
   - Create your user profile with your name

2. **Set Your Profile**
   - Click "Edit Profile" in the sidebar
   - Enter your display name
   - Your platform will be detected automatically

3. **Download Dependencies**
   - Go to the Downloads tab
   - Download your preferred Minecraft version
   - Forge versions coming soon!

4. **Start Your First Server**
   - Go to the Servers tab
   - Click "Start New Server"
   - Choose your settings and launch!

## 👥 **Friend Connection**

### Automatic Discovery
- Friends on the same network are automatically detected
- See their names, platforms, and online status
- No manual configuration required

### Host Transfer
1. **Request Transfer**: Click "Transfer Host" on any server
2. **Select Friend**: Choose who should take over
3. **Automatic Handoff**: Server transfers seamlessly

### Host Takeover
1. **Detect Offline Host**: App shows when a friend goes offline
2. **Take Over**: Click "Take Over Host" to continue the server
3. **Seamless Transition**: Players can continue playing without interruption

## 🛠️ **Advanced Features**

### Server Configuration
- **Custom Ports**: Set any port for your servers
- **Player Limits**: Configure max players per server
- **Memory Settings**: Optimize server performance
- **World Management**: Import/export server worlds

### Network Settings
- **Discovery Port**: Customize peer discovery (default: 3001)
- **Communication Port**: Customize messaging (default: 3002)
- **Firewall Configuration**: Automatic port detection and setup

### System Monitoring
- **Resource Usage**: Monitor CPU, memory, and disk usage
- **Network Status**: Real-time network connectivity
- **Java Version**: Automatic Java detection and validation
- **Disk Space**: Monitor available storage for servers

## 📁 **File Structure**

```
multimc-hub/
├── src/
│   ├── main.js              # Main Electron process
│   ├── server/
│   │   └── ServerManager.js # Server lifecycle management
│   ├── network/
│   │   └── NetworkManager.js # Peer discovery and communication
│   ├── utils/
│   │   └── SystemChecker.js # System requirements checking
│   └── renderer/
│       ├── index.html       # Main UI
│       ├── styles.css       # Styling
│       └── renderer.js      # Frontend logic
├── assets/
│   └── icon.png            # Application icon
├── start.sh               # Linux/macOS startup script
├── start.bat              # Windows startup script
└── package.json           # Project configuration
```

## 🔧 **Development**

### Building from Source
```bash
# Clone the repository
git clone https://github.com/yourusername/multimc-hub.git
cd multimc-hub

# Install dependencies
npm install

# Start development mode
npm run dev

# Build for distribution
npm run build

# Build for specific platform
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

### Architecture
- **Electron**: Cross-platform desktop framework
- **Node.js**: Backend server management
- **Express**: Web API for profile management
- **Socket.io**: Real-time communication
- **UDP Discovery**: Peer-to-peer network discovery

## 🐛 **Troubleshooting**

### Common Issues

#### "Java not found"
- Install Java 8 or higher from [Adoptium](https://adoptium.net/)
- Ensure Java is in your system PATH

#### "No friends detected"
- Check that all friends are on the same network
- Ensure firewall allows ports 3001-3003
- Verify all friends have the app running

#### "Server won't start"
- Check available disk space (minimum 2GB)
- Verify Java installation
- Check port availability (default 25565)

#### "Can't transfer host"
- Ensure both users are online
- Check network connectivity
- Verify server is running properly

### Logs and Debugging
- Application logs: `~/.multimc-hub/logs/`
- Server logs: `~/.multimc-hub/servers/[server-id]/logs/`
- Network logs: Check browser console (F12)

## 🤝 **Contributing**

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 **Acknowledgments**

- **Mojang**: For Minecraft server files
- **Forge Team**: For modded server support
- **Electron Team**: For the amazing desktop framework
- **Our Community**: For feedback and testing

## 📞 **Support**

- **Issues**: [GitHub Issues](https://github.com/yourusername/multimc-hub/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/multimc-hub/discussions)
- **Wiki**: [Documentation](https://github.com/yourusername/multimc-hub/wiki)

---

**Made with ❤️ for the Minecraft community**

*MultiMC Hub - Where friends become server admins together!* 