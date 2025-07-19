const { exec, spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
const { pipeline } = require('stream');
const { promisify } = require('util');
const extract = require('extract-zip');
const { LoaderManager } = require('./LoaderManager');

const pipelineAsync = promisify(pipeline);

// Polyfill for fetch if not available (Node.js < 18)
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

class SystemChecker {
  constructor() {
    this.baseDir = path.join(os.homedir(), '.multimc-hub');
    this.minecraftDir = path.join(this.baseDir, 'minecraft');
    this.forgeDir = path.join(this.baseDir, 'forge');
    this.javaDir = path.join(this.baseDir, 'java');
    this.profilesDir = path.join(this.baseDir, 'profiles');
    this.loaderManager = new LoaderManager();
    this.ensureDirectories();
  }

  ensureDirectories() {
    fs.ensureDirSync(this.baseDir);
    fs.ensureDirSync(this.minecraftDir);
    fs.ensureDirSync(this.forgeDir);
    fs.ensureDirSync(this.javaDir);
    fs.ensureDirSync(this.profilesDir);
  }

  async checkSystem() {
    const checks = {
      java: await this.checkJava(),
      network: await this.checkNetwork(),
      permissions: await this.checkPermissions(),
      diskSpace: await this.checkDiskSpace(),
      platform: this.checkPlatform()
    };

    // Use LoaderManager for all loader checks
    const loaderChecks = await this.loaderManager.checkAllLoaders();
    Object.assign(checks, loaderChecks);

    const overallStatus = Object.values(checks).every(check => check.status === 'ok') ? 'ready' : 'needs-setup';
    
    return {
      status: overallStatus,
      checks,
      recommendations: this.generateRecommendations(checks)
    };
  }

  checkPlatform() {
    return {
      status: 'ok',
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version
    };
  }

  async checkJava() {
    try {
      const javaVersion = await this.getJavaVersion();
      const javaPath = await this.getJavaPath();
      
      return {
        status: javaVersion ? 'ok' : 'missing',
        version: javaVersion,
        path: javaPath,
        message: javaVersion ? null : 'Java not found or version too old'
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Error checking Java: ${error.message}`
      };
    }
  }

  async getJavaVersion() {
    return new Promise((resolve) => {
      const command = os.platform() === 'win32' ? 'java -version' : 'java -version';
      exec(command, (error, stdout, stderr) => {
        if (error) {
          resolve(null);
        } else {
          const versionMatch = stderr.match(/version "([^"]+)"/);
          resolve(versionMatch ? versionMatch[1] : null);
        }
      });
    });
  }

  async getJavaPath() {
    return new Promise((resolve) => {
      const command = os.platform() === 'win32' ? 'where java' : 'which java';
      exec(command, (error, stdout) => {
        if (error) {
          resolve(null);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  async checkMinecraft() {
    try {
      const availableVersions = await this.getAvailableMinecraftVersions();
      const installedVersions = await this.getInstalledMinecraftVersions();
      
      return {
        status: installedVersions.length > 0 ? 'ok' : 'missing',
        availableVersions,
        installedVersions,
        message: installedVersions.length === 0 ? 'No Minecraft server versions installed' : null
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Error checking Minecraft: ${error.message}`
      };
    }
  }

  async checkForge() {
    try {
      const availableVersions = await this.getAvailableForgeVersions();
      const installedVersions = await this.getInstalledForgeVersions();
      
      return {
        status: installedVersions.length > 0 ? 'ok' : 'missing',
        availableVersions,
        installedVersions,
        message: installedVersions.length === 0 ? 'No Forge server versions installed' : null
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Error checking Forge: ${error.message}`
      };
    }
  }

  async checkNetwork() {
    try {
      const response = await fetch('https://www.google.com', { method: 'HEAD' });
      return {
        status: response.ok ? 'ok' : 'error',
        message: response.ok ? null : 'Network connectivity issues'
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Network error: ${error.message}`
      };
    }
  }

  async checkPermissions() {
    try {
      const testDir = path.join(this.baseDir, 'test-permissions');
      await fs.ensureDir(testDir);
      await fs.writeFile(path.join(testDir, 'test.txt'), 'test');
      await fs.remove(testDir);
      
      return {
        status: 'ok',
        message: null
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Permission error: ${error.message}`
      };
    }
  }

  async checkDiskSpace() {
    try {
      const freeSpace = await this.getFreeDiskSpace();
      const requiredSpace = 100 * 1024 * 1024; // 100MB minimum (much more reasonable)
      
      return {
        status: freeSpace > requiredSpace ? 'ok' : 'insufficient',
        freeSpace: freeSpace,
        message: freeSpace > requiredSpace ? null : 'Insufficient disk space'
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Disk space check error: ${error.message}`
      };
    }
  }

  async getFreeDiskSpace() {
    return new Promise((resolve) => {
      let command;
      if (os.platform() === 'win32') {
        command = 'wmic logicaldisk get size,freespace,caption';
      } else {
        command = 'df -k .';
      }

      exec(command, (error, stdout) => {
        if (error) {
          resolve(0);
        } else {
          if (os.platform() === 'win32') {
            // Parse Windows disk space output
            const lines = stdout.split('\n');
            let totalFree = 0;
            for (const line of lines) {
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 3 && !isNaN(parts[1])) {
                totalFree += parseInt(parts[1]);
              }
            }
            resolve(totalFree * 1024); // Convert to bytes
          } else {
            // Parse Unix disk space output
            const lines = stdout.split('\n');
            const parts = lines[1].split(/\s+/);
            const freeKB = parseInt(parts[3]);
            resolve(freeKB * 1024); // Convert to bytes
          }
        }
      });
    });
  }

  async getAvailableMinecraftVersions() {
    try {
      const response = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json');
      const data = await response.json();
      return data.versions
        .filter(v => v.type === 'release')
        .slice(0, 20) // Latest 20 versions
        .map(v => ({
          id: v.id,
          type: v.type,
          url: v.url,
          releaseTime: v.releaseTime
        }));
    } catch (error) {
      console.error('Failed to fetch Minecraft versions:', error);
      return [];
    }
  }

  async getAvailableForgeVersions() {
    try {
      // Use the official Forge API to get available versions
      const response = await fetch('https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml');
      const text = await response.text();
      
      // Parse the XML to extract version information
      const versionMatches = text.match(/<version>([^<]+)<\/version>/g);
      if (!versionMatches) {
        return [];
      }
      
      const versions = versionMatches
        .map(match => match.replace(/<\/?version>/g, ''))
        .filter(version => {
          // Filter for stable versions and common Minecraft versions
          const mcVersion = version.split('-')[0];
          return ['1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.19.2', '1.18.2', '1.16.5'].includes(mcVersion);
        })
        .sort((a, b) => {
          // Sort by Minecraft version, then by Forge version
          const aParts = a.split('-');
          const bParts = b.split('-');
          const aMC = aParts[0];
          const bMC = bParts[0];
          
          if (aMC !== bMC) {
            return bMC.localeCompare(aMC); // Newer versions first
          }
          
          return b.localeCompare(a); // Newer Forge versions first
        });
      
      return versions.slice(0, 15).map(version => ({
        id: version,
        minecraftVersion: version.split('-')[0],
        forgeVersion: version.split('-')[1] || version,
        type: 'release',
        releaseTime: new Date().toISOString() // Forge doesn't provide this easily
      }));
    } catch (error) {
      console.error('Failed to fetch Forge versions:', error);
      // Return some common stable versions as fallback
      return [
        { id: '1.20.4-49.0.3', minecraftVersion: '1.20.4', forgeVersion: '49.0.3', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.20.1-47.2.0', minecraftVersion: '1.20.1', forgeVersion: '47.2.0', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.19.4-45.2.0', minecraftVersion: '1.19.4', forgeVersion: '45.2.0', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.19.2-43.3.0', minecraftVersion: '1.19.2', forgeVersion: '43.3.0', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.18.2-40.2.0', minecraftVersion: '1.18.2', forgeVersion: '40.2.0', type: 'release', releaseTime: new Date().toISOString() }
      ];
    }
  }

  async getInstalledMinecraftVersions() {
    try {
      const files = await fs.readdir(this.minecraftDir);
      return files
        .filter(file => file.endsWith('.jar'))
        .map(file => file.replace('server-', '').replace('.jar', ''));
    } catch (error) {
      return [];
    }
  }

  async getInstalledForgeVersions() {
    try {
      const files = await fs.readdir(this.forgeDir);
      return files
        .filter(file => file.endsWith('.jar') && file.startsWith('forge-'))
        .map(file => file.replace('forge-', '').replace('.jar', ''));
    } catch (error) {
      return [];
    }
  }

  async downloadMinecraft(version) {
    return await this.loaderManager.downloadMinecraft(version);
  }

  async downloadForge(version) {
    return await this.loaderManager.downloadLoader('forge', version);
  }

  async downloadFabric(version) {
    return await this.loaderManager.downloadLoader('fabric', version);
  }

  async downloadQuilt(version) {
    return await this.loaderManager.downloadLoader('quilt', version);
  }

  async downloadNeoForge(version) {
    return await this.loaderManager.downloadLoader('neoforge', version);
  }

  async downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destination);
      const request = https.get(url, (response) => {
        if (response.statusCode === 200) {
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        } else {
          reject(new Error(`HTTP ${response.statusCode}`));
        }
      });
      
      request.on('error', reject);
      file.on('error', reject);
    });
  }

  async extractForgeServer(installerPath, serverJarPath, version) {
    try {
      // Forge installers are actually JAR files that can be extracted
      const extractDir = path.join(this.forgeDir, `temp-${version}`);
      await fs.ensureDir(extractDir);
      
      // Extract the installer JAR
      await extract(installerPath, { dir: extractDir });
      
      // Look for the server JAR in the extracted files
      const files = await fs.readdir(extractDir);
      const serverJarFile = files.find(file => 
        file.includes('server') && file.endsWith('.jar') && !file.includes('installer')
      );
      
      if (!serverJarFile) {
        // If no server jar found, try to find any jar that's not the installer
        const jarFile = files.find(file => file.endsWith('.jar') && !file.includes('installer'));
        if (jarFile) {
          await fs.copy(path.join(extractDir, jarFile), serverJarPath);
        } else {
          throw new Error('No server JAR found in Forge installer');
        }
      } else {
        await fs.copy(path.join(extractDir, serverJarFile), serverJarPath);
      }
      
      // Clean up extraction directory
      await fs.remove(extractDir);
      
    } catch (error) {
      console.error('Failed to extract Forge server:', error);
      // Fallback: try to use the installer as the server jar (some versions work this way)
      await fs.copy(installerPath, serverJarPath);
      console.log('Using installer as server jar (fallback method)');
    }
  }

  async getPublicIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      return null;
    }
  }

  getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const [name, ifaces] of Object.entries(interfaces)) {
      for (const iface of ifaces) {
        if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  }

  formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  generateRecommendations(checks) {
    const recommendations = [];
    
    if (checks.java.status !== 'ok') {
      recommendations.push({
        type: 'java',
        priority: 'high',
        message: 'Install or update Java to version 8 or higher',
        action: 'download-java'
      });
    }
    
    // Check all loaders
    const loaders = this.loaderManager.getSupportedLoaders();
    for (const [loaderId, loaderInfo] of Object.entries(loaders)) {
      if (checks[loaderId] && checks[loaderId].status === 'missing') {
        recommendations.push({
          type: loaderId,
          priority: 'medium',
          message: `Download ${loaderInfo.name} server versions`,
          action: `download-${loaderId}`
        });
      }
    }
    
    if (checks.diskSpace.status === 'insufficient') {
      recommendations.push({
        type: 'disk',
        priority: 'high',
        message: 'Free up disk space (at least 2GB required)',
        action: 'cleanup-disk'
      });
    }
    
    return recommendations;
  }

  // Profile management methods
  async getCurrentProfile() {
    const profilePath = path.join(this.profilesDir, 'current.json');
    if (await fs.pathExists(profilePath)) {
      return await fs.readJson(profilePath);
    }
    return null;
  }

  async saveProfile(profile) {
    const profilePath = path.join(this.profilesDir, 'current.json');
    await fs.writeJson(profilePath, profile, { spaces: 2 });
  }

  async createDefaultProfile() {
    const defaultProfile = {
      id: require('crypto').randomUUID(),
      name: os.hostname(),
      platform: os.platform(),
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    };
    await this.saveProfile(defaultProfile);
    return defaultProfile;
  }

  /**
   * Scan for existing Minecraft installations on the system
   */
  async scanForMinecraftInstallations() {
    const installations = [];
    const commonPaths = [
      // Windows paths
      path.join(process.env.APPDATA || '', '.minecraft'),
      path.join(process.env.LOCALAPPDATA || '', 'Packages', 'Microsoft.MinecraftUWP_8wekyb3d8bbwe', 'LocalState', 'games', 'com.mojang'),
      // macOS paths
      path.join(os.homedir(), 'Library', 'Application Support', 'minecraft'),
      path.join(os.homedir(), '.minecraft'),
      // Linux paths
      path.join(os.homedir(), '.minecraft'),
      path.join(os.homedir(), '.local', 'share', 'minecraft'),
      // MultiMC paths
      path.join(os.homedir(), 'MultiMC', 'instances'),
      path.join(os.homedir(), '.local', 'share', 'multimc', 'instances'),
      // Custom paths from environment
      process.env.MINECRAFT_PATH,
      process.env.MULTIMC_PATH
    ].filter(Boolean);

    console.log('🔍 Scanning for Minecraft installations...');

    for (const basePath of commonPaths) {
      if (!basePath || !await fs.pathExists(basePath)) continue;

      try {
        console.log(`  Checking: ${basePath}`);
        
        // Check if this is a MultiMC instance folder
        if (basePath.includes('MultiMC') || basePath.includes('multimc')) {
          const instances = await this.scanMultiMCInstances(basePath);
          installations.push(...instances);
        } else {
          // Check if this is a standard Minecraft installation
          const minecraftPath = path.join(basePath, '.minecraft');
          if (await fs.pathExists(minecraftPath)) {
            const installation = await this.scanStandardMinecraft(minecraftPath);
            if (installation) installations.push(installation);
          } else {
            // Check if basePath itself is a Minecraft installation
            const installation = await this.scanStandardMinecraft(basePath);
            if (installation) installations.push(installation);
          }
        }
      } catch (error) {
        console.log(`  Error scanning ${basePath}:`, error.message);
      }
    }

    // Also scan for any .minecraft folders in common locations
    const minecraftFolders = await this.findMinecraftFolders();
    for (const minecraftPath of minecraftFolders) {
      try {
        const installation = await this.scanStandardMinecraft(minecraftPath);
        if (installation) installations.push(installation);
      } catch (error) {
        console.log(`  Error scanning ${minecraftPath}:`, error.message);
      }
    }

    console.log(`✅ Found ${installations.length} Minecraft installation(s)`);
    return installations;
  }

  /**
   * Scan MultiMC instance folders
   */
  async scanMultiMCInstances(multimcPath) {
    const installations = [];
    
    try {
      const instanceFolders = await fs.readdir(multimcPath);
      
      for (const folder of instanceFolders) {
        const instancePath = path.join(multimcPath, folder);
        const stats = await fs.stat(instancePath);
        
        if (stats.isDirectory()) {
          const instanceConfigPath = path.join(instancePath, 'instance.cfg');
          const minecraftPath = path.join(instancePath, '.minecraft');
          
          if (await fs.pathExists(minecraftPath)) {
            try {
              const installation = await this.scanStandardMinecraft(minecraftPath);
              if (installation) {
                installation.name = `MultiMC: ${folder}`;
                installation.source = 'multimc';
                installation.instancePath = instancePath;
                installations.push(installation);
              }
            } catch (error) {
              console.log(`    Error scanning MultiMC instance ${folder}:`, error.message);
            }
          }
        }
      }
    } catch (error) {
      console.log(`  Error scanning MultiMC path ${multimcPath}:`, error.message);
    }
    
    return installations;
  }

  /**
   * Scan a standard Minecraft installation
   */
  async scanStandardMinecraft(minecraftPath) {
    try {
      const versionsPath = path.join(minecraftPath, 'versions');
      const assetsPath = path.join(minecraftPath, 'assets');
      
      if (!await fs.pathExists(versionsPath)) {
        return null;
      }

      const versions = await fs.readdir(versionsPath);
      const validVersions = [];
      
      for (const version of versions) {
        const versionPath = path.join(versionsPath, version);
        const stats = await fs.stat(versionPath);
        
        if (stats.isDirectory()) {
          const jarPath = path.join(versionPath, `${version}.jar`);
          const jsonPath = path.join(versionPath, `${version}.json`);
          
          if (await fs.pathExists(jarPath) && await fs.pathExists(jsonPath)) {
            validVersions.push(version);
          }
        }
      }

      if (validVersions.length === 0) {
        return null;
      }

      return {
        name: 'Standard Minecraft',
        path: minecraftPath,
        source: 'standard',
        versions: validVersions,
        hasAssets: await fs.pathExists(assetsPath),
        lastModified: (await fs.stat(minecraftPath)).mtime
      };
    } catch (error) {
      console.log(`  Error scanning Minecraft installation ${minecraftPath}:`, error.message);
      return null;
    }
  }

  /**
   * Find .minecraft folders recursively in common locations
   */
  async findMinecraftFolders() {
    const folders = [];
    const searchPaths = [
      os.homedir(),
      path.join(os.homedir(), 'Documents'),
      path.join(os.homedir(), 'Downloads'),
      path.join(os.homedir(), 'Desktop'),
      process.env.APPDATA || '',
      process.env.LOCALAPPDATA || ''
    ].filter(Boolean);

    for (const searchPath of searchPaths) {
      if (!await fs.pathExists(searchPath)) continue;
      
      try {
        await this.findMinecraftFoldersRecursive(searchPath, folders, 0);
      } catch (error) {
        // Ignore permission errors and continue
      }
    }

    return folders;
  }

  /**
   * Recursively find .minecraft folders (with depth limit)
   */
  async findMinecraftFoldersRecursive(dir, folders, depth) {
    if (depth > 3) return; // Limit depth to avoid infinite recursion
    
    try {
      const items = await fs.readdir(dir);
      
      for (const item of items) {
        if (item === '.minecraft') {
          folders.push(path.join(dir, item));
        } else if (depth < 2) { // Only go deeper for first few levels
          const itemPath = path.join(dir, item);
          try {
            const stats = await fs.stat(itemPath);
            if (stats.isDirectory()) {
              await this.findMinecraftFoldersRecursive(itemPath, folders, depth + 1);
            }
          } catch (error) {
            // Ignore permission errors
          }
        }
      }
    } catch (error) {
      // Ignore permission errors
    }
  }

  /**
   * Copy assets from an existing Minecraft installation
   */
  async copyAssetsFromInstallation(installation, targetPath) {
    if (!installation.hasAssets) {
      console.log('⚠️  No assets found in the selected installation');
      return false;
    }

    try {
      const sourceAssetsPath = path.join(installation.path, 'assets');
      const targetAssetsPath = path.join(targetPath, 'assets');
      
      console.log(`📁 Copying assets from ${sourceAssetsPath} to ${targetAssetsPath}`);
      
      if (await fs.pathExists(targetAssetsPath)) {
        await fs.remove(targetAssetsPath);
      }
      
      await fs.copy(sourceAssetsPath, targetAssetsPath);
      console.log('✅ Assets copied successfully');
      return true;
    } catch (error) {
      console.error('❌ Error copying assets:', error);
      return false;
    }
  }

  /**
   * Copy a specific version from an existing installation
   */
  async copyVersionFromInstallation(installation, version, targetPath) {
    try {
      const sourceVersionPath = path.join(installation.path, 'versions', version);
      const targetVersionPath = path.join(targetPath, 'versions', version);
      
      console.log(`📁 Copying version ${version} from ${sourceVersionPath} to ${targetVersionPath}`);
      
      if (await fs.pathExists(targetVersionPath)) {
        await fs.remove(targetVersionPath);
      }
      
      await fs.copy(sourceVersionPath, targetVersionPath);
      console.log(`✅ Version ${version} copied successfully`);
      return true;
    } catch (error) {
      console.error(`❌ Error copying version ${version}:`, error);
      return false;
    }
  }
}

module.exports = { SystemChecker }; 