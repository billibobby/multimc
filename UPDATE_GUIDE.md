# 📥 MultiMC Hub - Update Guide

## 🔄 How to Get Updates

### 🚫 **Important Notice**
**This repository is PROTECTED. Users cannot modify the code or submit changes.**
**Updates are provided through official releases only.**

---

## 📦 **Getting Updates**

### ✅ **Method 1: GitHub Releases (Recommended)**

1. **Go to Releases Page**
   - Visit: `https://github.com/billibobby/multimc/releases`
   - Or click "Releases" in the repository

2. **Download Latest Version**
   - Find the latest release (e.g., v1.1.0)
   - Download the appropriate file for your OS:
     - **Windows**: `.exe` or `.zip` file
     - **macOS**: `.dmg` file
     - **Linux**: `.AppImage`, `.deb`, or `.rpm` file

3. **Install the Update**
   - **Windows**: Run the `.exe` installer or extract the `.zip`
   - **macOS**: Open the `.dmg` and drag to Applications
   - **Linux**: Use package manager or run the `.AppImage`

### ✅ **Method 2: Auto-Updater (In-App)**

1. **Check for Updates**
   - Open MultiMC Hub
   - Go to Settings → Updates
   - Click "Check for Updates"

2. **Download and Install**
   - If an update is available, click "Download"
   - The app will automatically install the update
   - Restart the application

### ✅ **Method 3: Manual Download**

1. **Visit Repository**
   - Go to: `https://github.com/billibobby/multimc`
   - Click "Releases" on the right side

2. **Choose Your Platform**
   - **Windows**: Download `MultiMC-Hub-Setup-x.x.x.exe`
   - **macOS**: Download `MultiMC-Hub-x.x.x.dmg`
   - **Linux**: Download `MultiMC-Hub-x.x.x.AppImage`

---

## 🔒 **Security & Verification**

### 🛡️ **Official Releases Only**
- ✅ **Only download** from official GitHub releases
- ✅ **All releases** are signed by @billibobby
- ✅ **Verified** and **secure** downloads
- ❌ **Never download** from unofficial sources

### 🔐 **Release Verification**
- **Release Author**: @billibobby (Repository Owner)
- **Release Source**: Official GitHub repository
- **Release Signing**: All releases are digitally signed
- **Release Integrity**: Checksums provided for verification

---

## 📋 **Update Process**

### 🔄 **How Updates Work**
1. **You make changes** to the code (only you can)
2. **You create a new version tag** (e.g., v1.1.0)
3. **GitHub Actions automatically**:
   - Builds the application
   - Creates a new release
   - Uploads installers for all platforms
   - Signs the release

4. **Users can download** the new version
5. **Repository remains protected** - no external changes

### 🏷️ **Version Tagging**
When you want to release an update:

```bash
# Create a new version tag
git tag v1.1.0

# Push the tag to trigger release
git push origin v1.1.0
```

This automatically creates a new release with all platform installers.

---

## 🎯 **User Benefits**

### ✅ **What Users Get**
- **Regular updates** with new features
- **Bug fixes** and improvements
- **Security updates** and patches
- **Cross-platform support** (Windows, macOS, Linux)
- **Verified downloads** from official source

### ✅ **What Users Can Do**
- **Download updates** from releases
- **Report bugs** via Issues
- **Suggest features** via Issues
- **Fork** for personal use
- **Use the application** according to license

### 🚫 **What Users Cannot Do**
- **Submit code changes** (repository protected)
- **Create pull requests** (automatically closed)
- **Modify the repository** (read-only for users)
- **Bypass security** measures

---

## 📊 **Update Schedule**

### 🔄 **Release Frequency**
- **Major Updates**: When significant features are added
- **Minor Updates**: When bugs are fixed or improvements made
- **Security Updates**: When vulnerabilities are patched
- **Hotfixes**: For critical issues

### 📅 **Update Process**
1. **Development**: You work on new features/fixes
2. **Testing**: You test the changes thoroughly
3. **Tagging**: You create a version tag
4. **Release**: GitHub Actions automatically builds and releases
5. **Distribution**: Users can download the update

---

## 🛡️ **Repository Protection Status**

### 🔒 **Active Protections**
- ✅ **Repository is read-only** for all users except owner
- ✅ **No external contributions** accepted
- ✅ **All changes require** owner approval
- ✅ **Updates provided** through official releases only

### 🎯 **Result**
- **Users get updates** without modifying your repository
- **Repository stays protected** from unauthorized changes
- **You maintain full control** over all code and releases
- **Security is maintained** throughout the process

---

## 📞 **Support**

### 🆘 **If You Need Help**
- **Report bugs**: Use the Issues tab
- **Request features**: Use the Issues tab
- **Ask questions**: Use the Issues tab
- **Get updates**: Download from Releases page

### 🔐 **Security Issues**
- **DO NOT** create public issues for security problems
- **Contact @billibobby** privately for security reports
- **Follow** the security policy in `.github/SECURITY.md`

---

## 🎉 **Summary**

**Your MultiMC Hub repository is fully protected while still providing updates to users:**

- ✅ **Users can get updates** through official releases
- ✅ **Repository remains protected** from external changes
- ✅ **You maintain full control** over all code and releases
- ✅ **Security is maintained** throughout the process
- ✅ **Updates are automated** when you create version tags

**This is the perfect balance of protection and accessibility!** 🛡️📦 