# 🚀 MultiMC Hub - Standalone Desktop App Builder

This guide will help you build standalone desktop applications for Windows, macOS, and Linux from the MultiMC Hub project.

## 📋 Prerequisites

### For All Platforms:
- **Node.js** (v16 or higher)
- **npm** (comes with Node.js)
- **Git** (for cloning the repository)

### For Windows:
- **Windows 10/11** (64-bit)
- **Visual Studio Build Tools** (optional, for native modules)

### For macOS:
- **macOS 10.14 or higher**
- **Xcode Command Line Tools** (`xcode-select --install`)
- **Apple Developer Account** (for notarization, optional)

### For Linux:
- **Ubuntu 18.04+ / Debian 9+ / CentOS 7+**
- **Development tools**: `sudo apt-get install build-essential`

## 🛠️ Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/billibobby/multimc.git
   cd multimc
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

## 🎨 Icon Preparation

Before building, you need to create proper app icons:

### Option 1: Use the provided SVG icon
The project includes `build/icon.svg` which you can convert to the required formats:

- **Windows**: Convert to `.ico` format (multiple sizes: 16x16, 32x32, 48x48, 256x256)
- **macOS**: Convert to `.icns` format (multiple sizes: 16x16, 32x32, 128x128, 256x256, 512x512)
- **Linux**: Use `.png` format (512x512 recommended)

### Option 2: Use online converters
- **ICO**: Use online converters like convertio.co or icoconvert.com
- **ICNS**: Use tools like Image2Icon or online converters

### Option 3: Use command-line tools
```bash
# Install ImageMagick (if available)
# macOS: brew install imagemagick
# Ubuntu: sudo apt-get install imagemagick

# Convert SVG to PNG
convert build/icon.svg -resize 512x512 build/icon.png

# Convert to ICO (Windows)
convert build/icon.png -define icon:auto-resize=16,32,48,256 build/icon.ico

# Convert to ICNS (macOS) - requires additional tools
```

## 🏗️ Building the Application

### Quick Build (All Platforms)
```bash
npm run build:all
```

### Platform-Specific Builds

#### Windows
```bash
npm run build:win
```
**Output:** `dist/MultiMC Hub Setup 1.0.0.exe` (installer)
**Output:** `dist/MultiMC Hub-1.0.0-win.zip` (portable)

#### macOS
```bash
npm run build:mac
```
**Output:** `dist/MultiMC Hub-1.0.0.dmg` (installer)
**Output:** `dist/MultiMC Hub-1.0.0-mac.zip` (archive)

#### Linux
```bash
npm run build:linux
```
**Output:** `dist/MultiMC Hub-1.0.0.AppImage` (portable)
**Output:** `dist/multimc-hub_1.0.0_amd64.deb` (Debian package)

### Using the Build Script
```bash
# Build for specific platform
node scripts/build.js win
node scripts/build.js mac
node scripts/build.js linux

# Build for all platforms
node scripts/build.js all
```

## 📦 Build Output

After a successful build, you'll find the following in the `dist/` folder:

### Windows
- `MultiMC Hub Setup 1.0.0.exe` - NSIS installer
- `MultiMC Hub-1.0.0-win.zip` - Portable version
- `win-unpacked/` - Unpacked application folder

### macOS
- `MultiMC Hub-1.0.0.dmg` - DMG installer
- `MultiMC Hub-1.0.0-mac.zip` - Compressed archive
- `MultiMC Hub.app` - Application bundle

### Linux
- `MultiMC Hub-1.0.0.AppImage` - Portable AppImage
- `multimc-hub_1.0.0_amd64.deb` - Debian package
- `linux-unpacked/` - Unpacked application folder

## 🔧 Advanced Build Options

### Development Build
```bash
npm run dev
```

### Packaged Development Build
```bash
npm run pack
```

### Publishing to GitHub Releases
```bash
npm run publish
```

## 🍎 macOS Notarization (Optional)

For macOS builds to run without security warnings on modern macOS:

1. **Set environment variables:**
   ```bash
   export APPLE_ID="your-apple-id@example.com"
   export APPLE_ID_PASSWORD="your-app-specific-password"
   export APPLE_TEAM_ID="your-team-id"
   ```

2. **Build with notarization:**
   ```bash
   npm run build:mac
   ```

## 🪟 Windows Code Signing (Optional)

For Windows builds to avoid security warnings:

1. **Obtain a code signing certificate**
2. **Set environment variables:**
   ```bash
   set CSC_LINK="path/to/certificate.p12"
   set CSC_KEY_PASSWORD="certificate-password"
   ```

3. **Build with signing:**
   ```bash
   npm run build:win
   ```

## 🐛 Troubleshooting

### Common Issues

#### "electron-builder not found"
```bash
npm install --save-dev electron-builder
```

#### "Icon file not found"
Make sure you have the required icon files in the `build/` folder:
- `build/icon.ico` (Windows)
- `build/icon.icns` (macOS)
- `build/icon.png` (Linux)

#### "Permission denied" (Linux)
```bash
chmod +x dist/MultiMC\ Hub-1.0.0.AppImage
```

#### "App can't be opened" (macOS)
Right-click the app → "Open" → "Open" to bypass Gatekeeper.

### Build Errors

#### Node.js version issues
Ensure you're using Node.js 16 or higher:
```bash
node --version
```

#### Dependencies issues
Clean and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

#### Platform-specific issues
- **Windows**: Ensure you have Visual Studio Build Tools installed
- **macOS**: Install Xcode Command Line Tools
- **Linux**: Install build essentials

## 📱 Distribution

### Windows
- **Installer**: Share the `.exe` file
- **Portable**: Share the `.zip` file

### macOS
- **DMG**: Share the `.dmg` file
- **Archive**: Share the `.zip` file

### Linux
- **AppImage**: Share the `.AppImage` file
- **Debian**: Share the `.deb` file

## 🔄 Updating the App

To update the app version:

1. **Update version in package.json:**
   ```json
   {
     "version": "1.0.1"
   }
   ```

2. **Rebuild the application:**
   ```bash
   npm run build:all
   ```

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the build logs in the console
3. Check the `dist/` folder for build artifacts
4. Create an issue on GitHub with build logs

## 🎯 Next Steps

After building:

1. **Test the application** on the target platform
2. **Create a release** on GitHub with the built files
3. **Distribute** the installer/portable files to users
4. **Set up auto-updates** (optional, using electron-updater)

---

**Happy Building! 🚀** 