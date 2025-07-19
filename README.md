# MultiMC Hub

A modern, cross-platform Minecraft server management application built with Electron. MultiMC Hub allows you to easily create, manage, and host Minecraft servers with support for multiple server types including Vanilla, Forge, Fabric, Quilt, and NeoForge.

## Features

### 🚀 Server Management
- **Multiple Server Types**: Support for Vanilla, Forge, Fabric, Quilt, and NeoForge servers
- **Easy Server Creation**: Simple wizard to create new servers with automatic version detection
- **Server Monitoring**: Real-time status monitoring and log viewing
- **Mod Management**: Upload and manage mods for modded servers
- **Auto-start**: Configure servers to start automatically when the application launches

### 🌐 Network Features
- **Peer Discovery**: Automatically discover other MultiMC Hub users on your network
- **Server Sharing**: Share your servers with other users on the network
- **Host Takeover**: Take over hosting of servers from other users
- **Real-time Updates**: Live updates of server and network status

### 📦 Version Management
- **Automatic Downloads**: Download Minecraft and mod loader versions automatically
- **Version Detection**: Automatically detect available and installed versions
- **Multiple Versions**: Support for multiple Minecraft versions and mod loaders
- **Offline Support**: Work with locally installed versions

### 🛠️ System Integration
- **Cross-platform**: Works on Windows, macOS, and Linux
- **Java Detection**: Automatic Java version detection and validation
- **System Monitoring**: Monitor system resources and requirements
- **Log Management**: Comprehensive logging and debugging tools

## Installation

### Prerequisites
- **Node.js** (v16 or higher)
- **Java** (v8 or higher)
- **Git** (for updates)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/multimc-hub.git
   cd multimc-hub
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the application**
   ```bash
   npm start
   ```

### Platform-Specific Installation

#### Windows
1. Download and install [Node.js](https://nodejs.org/)
2. Download and install [Java](https://adoptium.net/)
3. Run `start.bat` or use the commands above

#### macOS
1. Install [Homebrew](https://brew.sh/) (if not already installed)
2. Install Node.js: `brew install node`
3. Install Java: `brew install --cask temurin`
4. Run `start.sh` or use the commands above

#### Linux
1. Install Node.js and Java using your package manager
2. Run `start.sh` or use the commands above

## Usage

### Creating Your First Server

1. **Launch MultiMC Hub**
2. **Click "Start New Server"** on the Dashboard
3. **Choose Server Type**:
   - **Vanilla**: Official Minecraft server (no mods)
   - **Forge**: Popular mod loader with extensive mod support
   - **Fabric**: Lightweight mod loader with modern features
   - **Quilt**: Fork of Fabric with additional features
   - **NeoForge**: Modern fork of Forge
4. **Select Version**: Choose from available versions
5. **Configure Settings**: Set server name, port, and max players
6. **Start Server**: Click "Start Server" to launch

### Managing Servers

- **View Status**: See real-time server status on the Dashboard
- **View Logs**: Access server logs for debugging
- **Manage Mods**: Upload and manage mods for modded servers
- **Network Sharing**: Share servers with other users on your network

### Network Features

- **Discover Peers**: Automatically find other MultiMC Hub users
- **Join Servers**: Connect to servers hosted by other users
- **Take Over Hosting**: Take over hosting of servers from other users

## Configuration

### Server Settings
- **Port**: Default 25565 (can be changed)
- **Max Players**: Default 20 (configurable)
- **Auto-start**: Enable to start servers automatically
- **Memory**: Configure server memory allocation

### Network Settings
- **Discovery Port**: Default 3001 (auto-adjusted if in use)
- **Communication Port**: Default 3002 (auto-adjusted if in use)
- **Web Interface**: Default 3003 (auto-adjusted if in use)

## Troubleshooting

### Common Issues

#### Port Conflicts
If you see "port in use" errors, MultiMC Hub will automatically try alternative ports. This is normal and the application will work fine.

#### Java Not Found
1. Ensure Java is installed and in your PATH
2. Restart MultiMC Hub after installing Java
3. Check the System Status panel for Java detection

#### Server Won't Start
1. Check the server logs for error messages
2. Ensure you have sufficient memory available
3. Verify the selected version is compatible with your Java version

#### Network Issues
1. Check your firewall settings
2. Ensure ports 3001-3004 are not blocked
3. Try restarting the application

### Debug Mode
Click the "Debug Status" button in the System Status panel to get detailed information about:
- System status and detected components
- Available and installed versions
- Network connectivity
- Server status

## Development

### Project Structure
```
multimc/
├── src/
│   ├── main.js              # Main Electron process
│   ├── renderer/            # Renderer process (UI)
│   ├── server/              # Server management
│   ├── network/             # Network functionality
│   └── utils/               # Utility functions
├── assets/                  # Application assets
├── start.bat               # Windows launcher
├── start.sh                # Unix launcher
└── package.json            # Project configuration
```

### Building
```bash
# Install dependencies
npm install

# Build for development
npm run dev

# Build for production
npm run build

# Package for distribution
npm run package
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: Report bugs and request features on [GitHub Issues](https://github.com/yourusername/multimc-hub/issues)
- **Discussions**: Join discussions on [GitHub Discussions](https://github.com/yourusername/multimc-hub/discussions)
- **Wiki**: Check the [Wiki](https://github.com/yourusername/multimc-hub/wiki) for detailed documentation

## Changelog

### Version 1.0.0
- Initial release
- Support for Vanilla, Forge, Fabric, Quilt, and NeoForge servers
- Network peer discovery and server sharing
- Automatic version detection and downloads
- Cross-platform support (Windows, macOS, Linux)
- Real-time server monitoring and log viewing
- Mod management for modded servers
- System status monitoring and validation

## Acknowledgments

- **Minecraft**: Mojang Studios for Minecraft
- **Forge**: Minecraft Forge team
- **Fabric**: Fabric team
- **Quilt**: Quilt team
- **NeoForge**: NeoForge team
- **Electron**: Electron team for the framework
- **Node.js**: Node.js team for the runtime 