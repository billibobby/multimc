# MultiMC Hub - Windows Setup Guide

## 🚀 Quick Start for Windows Users

### Prerequisites
- **Windows 10 or 11** (64-bit)
- **Node.js 16+** - Download from [nodejs.org](https://nodejs.org/)
- **Java 8+** (optional, for Minecraft servers) - Download from [adoptium.net](https://adoptium.net/)

### Installation Steps

#### 1. Download and Extract
1. Download the MultiMC Hub ZIP file
2. Extract to a folder (e.g., `C:\MultiMC Hub`)
3. Open the folder in File Explorer

#### 2. Run the Installer
1. **Right-click** on `install.bat`
2. Select **"Run as administrator"**
3. Follow the installation prompts
4. Wait for dependencies to install

#### 3. Start the Application
1. Run `start.bat` (or double-click it)
2. The application will launch automatically

## 🔧 Troubleshooting

### Common Issues

#### ❌ "Node.js is not installed"
**Solution:**
1. Download Node.js from [nodejs.org](https://nodejs.org/)
2. Choose the LTS version
3. Run the installer as administrator
4. Restart your computer
5. Try running `install.bat` again

#### ❌ "npm is not available"
**Solution:**
1. Reinstall Node.js
2. Make sure to check "Add to PATH" during installation
3. Restart your computer

#### ❌ "Failed to install dependencies"
**Solutions:**
1. **Run as administrator** - Right-click `install.bat` → "Run as administrator"
2. **Check internet connection** - Make sure you can access npmjs.com
3. **Disable antivirus temporarily** - Some antivirus software blocks npm
4. **Clear npm cache** - Run `npm cache clean --force` in Command Prompt

#### ❌ "Electron failed to load"
**Solutions:**
1. Run `troubleshoot-windows.bat` to diagnose issues
2. Try running as administrator
3. Check if your antivirus is blocking the application
4. Reinstall dependencies: `npm install`

#### ❌ "Port conflicts"
**Solutions:**
1. Close other applications using ports 3001-3003
2. MultiMC Hub will automatically use alternative ports
3. Check if Minecraft servers are running on port 25565

### Testing Your Installation

#### Quick Test
1. Run `test-start.bat` to verify basic functionality
2. If it passes, your installation is working

#### Full Test
1. Run `troubleshoot-windows.bat` for comprehensive diagnostics
2. This will check all components and fix common issues

## 📁 File Structure

```
MultiMC Hub/
├── install.bat              # Installation script
├── start.bat                # Startup script
├── test-start.bat           # Quick test
├── troubleshoot-windows.bat # Comprehensive troubleshooting
├── package.json             # Project configuration
├── src/                     # Source code
├── assets/                  # Application assets
└── README.md               # This file
```

## 🎮 Using MultiMC Hub

### First Launch
1. The application will open with a login screen
2. Create an account or log in
3. Navigate through the tabs to explore features

### Key Features
- **Dashboard** - System status and quick actions
- **Servers** - Create and manage Minecraft servers
- **External Hosting** - Free hosting without port forwarding
- **Downloads** - Install Minecraft versions and mods
- **Network** - Connect with other users
- **Settings** - Configure the application

### External Hosting (No Port Forwarding)
1. Go to "External Hosting" tab
2. Click "Start Setup Guide"
3. Choose your server configuration
4. Select a free hosting service
5. Follow the setup instructions

## 🔒 Security Notes

### Antivirus Software
- Some antivirus software may flag Electron applications
- Add the MultiMC Hub folder to your antivirus exclusions
- Or temporarily disable real-time protection during installation

### Firewall
- MultiMC Hub may ask for firewall permissions
- Allow the application through your firewall
- This is needed for network features

## 📞 Getting Help

### If You're Still Having Issues
1. **Run troubleshoot-windows.bat** - This will diagnose and fix most issues
2. **Check the logs** - Look in the application's Logs tab
3. **Try running as administrator** - Right-click scripts → "Run as administrator"
4. **Restart your computer** - This can fix PATH and permission issues

### Common Error Messages
- `TypeError: Cannot read properties of undefined` - Run `troubleshoot-windows.bat`
- `Port already in use` - Close other applications or let MultiMC Hub use alternative ports
- `npm ERR!` - Check internet connection and try running as administrator

## 🆘 Emergency Recovery

### If Nothing Works
1. **Complete reinstall:**
   - Delete the entire MultiMC Hub folder
   - Download fresh copy
   - Run `install.bat` as administrator

2. **System requirements check:**
   - Windows 10/11 64-bit
   - Node.js 16+ installed
   - At least 2GB free RAM
   - 500MB free disk space

3. **Alternative installation:**
   - Install Node.js manually
   - Open Command Prompt as administrator
   - Navigate to MultiMC Hub folder
   - Run `npm install`
   - Run `npm start`

## ✅ Success Indicators

Your installation is working when:
- ✅ `test-start.bat` passes all checks
- ✅ `troubleshoot-windows.bat` shows no errors
- ✅ Application launches without error messages
- ✅ All tabs are accessible
- ✅ External hosting services are listed

## 🎯 Next Steps

After successful installation:
1. **Explore the features** - Try creating a server or using external hosting
2. **Join the community** - Connect with other users through the Network tab
3. **Customize settings** - Configure the application to your preferences
4. **Check for updates** - The application will notify you of updates

---

**Need more help?** Check the main README.md for detailed documentation about all features. 