# MultiMC Hub

A modern, cross-platform Minecraft server management application built with Electron. MultiMC Hub allows you to easily create, manage, and host Minecraft servers with support for multiple mod loaders including Vanilla, Forge, Fabric, Quilt, and NeoForge.

## Features

### 🎮 Server Management
- **Multiple Loader Support**: Vanilla, Forge, Fabric, Quilt, and NeoForge
- **Easy Server Creation**: Simple wizard to create servers with custom configurations
- **Automatic Downloads**: Downloads required Minecraft versions and mod loaders automatically
- **Server Validation**: Checks for required files before starting servers
- **Process Management**: Start, stop, and monitor server processes

### 🌐 Network Features
- **P2P Networking**: Direct peer-to-peer connections for server hosting
- **Server Discovery**: Find and connect to servers hosted by other users
- **Host Transfer**: Seamlessly transfer server hosting between peers
- **Real-time Status**: Live updates of server and network status

### 📁 File Management
- **Installation Scanner**: Scan your PC for existing Minecraft installations
- **Asset Copying**: Copy Minecraft assets and versions from existing installations
- **Mod Management**: Upload, manage, and configure mods for your servers
- **Backup & Restore**: Save and restore server configurations

### 🛠️ System Integration
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Java Detection**: Automatic Java installation detection and validation
- **Port Management**: Check port availability and manage conflicts
- **System Monitoring**: Real-time system status and recommendations

## Installation

### Prerequisites
- **Node.js** 18.0.0 or higher
- **Java** 8 or higher (for running Minecraft servers)
- **Git** (for cloning the repository)

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

### Build for Distribution

```bash
# Build for current platform
npm run build

# Build for all platforms
npm run build:all
```

## Usage

### Creating Your First Server

1. **Launch MultiMC Hub**
2. **Click "Create Server"** in the Servers tab
3. **Choose a loader**: Vanilla, Forge, Fabric, Quilt, or NeoForge
4. **Select a version**: Choose from available Minecraft versions
5. **Configure settings**: Set port, max players, and other options
6. **Click "Start Server"**: The app will download required files and start the server

### Using the Installation Scanner

1. **Go to Downloads tab**
2. **Click "Scan for Minecraft Installations"**
3. **Review found installations**: The scanner will detect MultiMC, standard Minecraft, and other installations
4. **Copy assets**: Click "Copy Assets" to copy Minecraft assets to the app
5. **Copy versions**: Click "Copy Version" to copy specific Minecraft versions

### Managing Mods

1. **Select a server** in the Servers tab
2. **Click "Manage Mods"**
3. **Upload mods**: Click "Upload Mod" to add JAR files
4. **Configure mods**: Arrange load order and configure settings
5. **Restart server**: Apply changes by restarting the server

## Project Structure

```
multimc/
├── src/
│   ├── main.js                 # Main Electron process
│   ├── network/
│   │   └── NetworkManager.js   # P2P networking
│   ├── renderer/
│   │   ├── index.html         # Main UI
│   │   ├── renderer.js        # Frontend logic
│   │   └── styles.css         # Styling
│   ├── server/
│   │   └── ServerManager.js   # Server management
│   └── utils/
│       ├── LoaderManager.js   # Mod loader management
│       ├── Logger.js          # Logging system
│       └── SystemChecker.js   # System validation
├── assets/                    # Application assets
├── package.json              # Dependencies and scripts
└── README.md                 # This file
```

## Supported Loaders

### Vanilla
- **Description**: Official Minecraft server
- **Mod Support**: No
- **Versions**: All official Minecraft releases

### Forge
- **Description**: Popular mod loader for Minecraft
- **Mod Support**: Yes
- **Versions**: 1.16.5+, latest stable releases

### Fabric
- **Description**: Lightweight mod loader
- **Mod Support**: Yes
- **Versions**: 1.16.5+, latest stable releases

### Quilt
- **Description**: Fork of Fabric with additional features
- **Mod Support**: Yes
- **Versions**: 1.18.2+, latest stable releases

### NeoForge
- **Description**: Fork of Forge with modern features
- **Mod Support**: Yes
- **Versions**: 1.20.1+, latest stable releases

## Configuration

### Server Configuration
Server configurations are stored in `~/.multimc-hub/config/servers.json` and include:
- Server name and type
- Minecraft and loader versions
- Port and player limits
- Auto-start settings
- Mod configurations

### Network Configuration
Network settings are managed automatically but can be customized:
- Peer discovery settings
- Connection timeouts
- Host transfer preferences

## Troubleshooting

### Common Issues

**Server won't start**
- Check that Java is installed and accessible
- Verify required files are downloaded
- Check port availability
- Review server logs for errors

**Downloads fail**
- Check internet connection
- Verify firewall settings
- Try using the Installation Scanner to copy from existing installations

**Network issues**
- Check firewall settings
- Verify port forwarding (if hosting)
- Ensure peers are online and accessible

### Getting Help

1. **Check the logs**: Use the Logs tab to view detailed error information
2. **System status**: Review the System tab for recommendations
3. **Create an issue**: Report bugs and request features on GitHub

## Development

### Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Test thoroughly**
5. **Submit a pull request**

### Development Setup

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

### Architecture

- **Main Process**: Electron main process handles system operations
- **Renderer Process**: Frontend UI and user interactions
- **IPC Communication**: Secure communication between processes
- **Modular Design**: Separate managers for different functionalities

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **MultiMC**: Inspiration for the project name and concept
- **Electron**: Cross-platform desktop application framework
- **Minecraft Community**: For the amazing modding ecosystem
- **Mod Loader Teams**: Forge, Fabric, Quilt, and NeoForge teams

## Roadmap

- [ ] **Plugin System**: Support for custom plugins and extensions
- [ ] **Server Templates**: Pre-configured server setups
- [ ] **Cloud Integration**: Backup to cloud storage
- [ ] **Mobile Companion**: Mobile app for remote management
- [ ] **Advanced Networking**: NAT traversal and relay servers
- [ ] **Performance Monitoring**: Detailed server performance metrics

---

**MultiMC Hub** - Making Minecraft server management simple and powerful! 🎮 