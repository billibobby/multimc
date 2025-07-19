# GitHub Setup & Project Startup Guide

## 🚀 Quick Start

### 1. Initialize Git Repository
```bash
# Navigate to your project directory
cd /path/to/multimc

# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: MultiMC Hub with External Hosting"

# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/multimc.git

# Push to GitHub
git push -u origin main
```

### 2. Install Dependencies
```bash
# Install Node.js dependencies
npm install

# Install Electron dependencies
npm run postinstall
```

### 3. Start the Application
```bash
# Development mode
npm run dev

# Or production build
npm run build
npm start
```

## 📁 Project Structure

```
multimc/
├── src/
│   ├── main.js                    # Main Electron process
│   ├── server/
│   │   ├── ServerManager.js       # Local server management
│   │   └── ExternalHostingManager.js # External hosting feature
│   ├── network/
│   │   └── NetworkManager.js      # Network discovery
│   ├── utils/
│   │   ├── LoaderManager.js       # Minecraft loader management
│   │   ├── Logger.js              # Logging system
│   │   └── SystemChecker.js       # System requirements
│   └── renderer/
│       ├── index.html             # Main UI
│       ├── renderer.js            # Frontend logic
│       └── styles.css             # Styling
├── assets/                        # Icons and resources
├── package.json                   # Dependencies and scripts
├── README.md                      # Project documentation
├── EXTERNAL_HOSTING.md           # External hosting documentation
└── test-external-hosting.html    # Test file for external hosting
```

## 🔧 Development Commands

### Available Scripts
```bash
# Development
npm run dev              # Start in development mode
npm run start            # Start the application

# Building
npm run build            # Build for current platform
npm run build:win        # Build for Windows
npm run build:mac        # Build for macOS
npm run build:linux      # Build for Linux

# Publishing
npm run publish          # Publish to GitHub releases
npm run dist             # Create distribution files
```

### Development Workflow
1. **Start development server**: `npm run dev`
2. **Make changes** to your code
3. **Test functionality** in the app
4. **Commit changes**: `git add . && git commit -m "Description"`
5. **Push to GitHub**: `git push`

## 🌟 New Features Added

### External Hosting System
- **Free hosting services**: Aternos, Minehut, PloudOS, Server.pro
- **Modded server support**: Forge and Fabric compatibility
- **Smart recommendations**: Based on server configuration
- **Setup wizard**: Step-by-step guidance
- **Service monitoring**: Real-time status checking

### Key Features
- ✅ **No port forwarding required**
- ✅ **Free hosting options**
- ✅ **Modded server support**
- ✅ **Easy setup process**
- ✅ **Service recommendations**
- ✅ **Account management**

## 🎮 How to Use External Hosting

### For Vanilla Servers
1. Open MultiMC Hub
2. Go to "External Hosting" tab
3. Click "Start Setup Guide"
4. Choose server configuration
5. Select recommended service
6. Follow setup instructions

### For Modded Servers
1. Select "Forge" or "Fabric" server type
2. Choose from available modpacks
3. Configure server settings
4. Use recommended service (Aternos for best modded support)

## 🐛 Troubleshooting

### Common Issues
- **Dependencies not found**: Run `npm install`
- **Electron not found**: Run `npm run postinstall`
- **Build errors**: Check Node.js version (requires 16+)
- **External hosting not working**: Check internet connection

### Getting Help
- Check the logs in the application
- Review `EXTERNAL_HOSTING.md` for detailed documentation
- Test with `test-external-hosting.html`

## 📝 Next Steps

### Immediate Actions
1. **Set up GitHub repository**
2. **Install dependencies**
3. **Test the application**
4. **Verify external hosting works**

### Future Enhancements
- Direct API integration with hosting services
- Automated server creation
- Real-time server monitoring
- Plugin management
- Server backup/restore

## 🎯 Success Criteria

Your MultiMC Hub is ready when:
- ✅ Application starts without errors
- ✅ All tabs work correctly
- ✅ External hosting tab shows available services
- ✅ Setup wizard guides users through process
- ✅ Modded server options are available

## 🚀 Ready to Launch!

Your enhanced MultiMC Hub with external hosting is now ready for users who need free hosting without port forwarding! 