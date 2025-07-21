# 🪟 MultiMC Hub - Windows Setup Guide

## 🚀 Quick Start for Windows

### 📋 Prerequisites
- **Windows 10 or 11** (64-bit)
- **Node.js 16+** - Download from [nodejs.org](https://nodejs.org/)
- **Java 8+** (optional, for Minecraft servers) - Download from [adoptium.net](https://adoptium.net/)

---

## 🔧 Installation Steps

### Step 1: Download and Extract
1. Download the MultiMC Hub ZIP file from GitHub
2. Extract to a folder (e.g., `C:\MultiMC Hub`)
3. Open the folder in File Explorer

### Step 2: Install Dependencies
1. **Right-click** on `install-windows.bat`
2. Select **"Run as administrator"**
3. Follow the installation prompts
4. Wait for dependencies to install

### Step 3: Start the Application
1. Run `start-windows.bat` (or double-click it)
2. The application will launch automatically

---

## 🛠️ Troubleshooting

### ❌ If install-windows.bat doesn't work:
1. Make sure you have **Node.js installed**
2. Try running as **administrator**
3. Check your **internet connection**
4. Try running `npm install` manually

### ❌ If start-windows.bat doesn't work:
1. Run `troubleshoot-windows-simple.bat`
2. Check if Node.js is installed: `node --version`
3. Check if npm is available: `npm --version`
4. Try running `npm start` manually

### ❌ If nothing happens when you click the files:
1. **Right-click** the file
2. Select **"Run as administrator"**
3. If that doesn't work, open **Command Prompt as administrator**
4. Navigate to the folder: `cd "C:\path\to\multimc"`
5. Run the commands manually

---

## 📁 Important Files

### ✅ **Use These Files:**
- `install-windows.bat` - **Install dependencies**
- `start-windows.bat` - **Start the application**
- `troubleshoot-windows-simple.bat` - **Fix problems**

### ❌ **Don't Use These Files (for protection only):**
- `install.bat` - Repository protection file
- `start.bat` - Repository protection file
- `troubleshoot-windows.bat` - Repository protection file

---

## 🔍 Manual Commands

If the batch files don't work, try these commands in Command Prompt:

```cmd
REM Check Node.js
node --version

REM Check npm
npm --version

REM Install dependencies
npm install

REM Start the application
npm start
```

---

## 🆘 Getting Help

### 📞 If You Need Support:
1. **Check this guide** first
2. **Run troubleshoot-windows-simple.bat**
3. **Report issues** on GitHub (Issues tab)
4. **Check the main README.md** for more information

### 🔗 Useful Links:
- **Node.js Download**: https://nodejs.org/
- **Java Download**: https://adoptium.net/
- **GitHub Repository**: https://github.com/billibobby/multimc

---

## ✅ Success Checklist

- [ ] Node.js installed and working
- [ ] Dependencies installed (`npm install` completed)
- [ ] Application starts (`npm start` works)
- [ ] MultiMC Hub window appears
- [ ] No error messages

**If all items are checked, you're ready to use MultiMC Hub!** 🎉 