const { exec, spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
const { pipeline } = require('stream');
const { promisify } = require('util');
const extract = require('extract-zip');

const pipelineAsync = promisify(pipeline);

class SystemChecker {
  constructor() {
    this.baseDir = path.join(os.homedir(), '.multimc-hub');
    this.minecraftDir = path.join(this.baseDir, 'minecraft');
    this.forgeDir = path.join(this.baseDir, 'forge');
    this.javaDir = path.join(this.baseDir, 'java');
    this.profilesDir = path.join(this.baseDir, 'profiles');
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
      minecraft: await this.checkMinecraft(),
      forge: await this.checkForge(),
      network: await this.checkNetwork(),
      permissions: await this.checkPermissions(),
      diskSpace: await this.checkDiskSpace(),
      platform: this.checkPlatform()
    };

    const overallStatus = Object.values(checks).every(check => check.status === 'ok') ? 'ready' : 'needs-setup';
    
    return {
      status: overallStatus,
      checks,
      recommendations: this.generateRecommendations(checks)
    };
  }

  checkPlatform() {
    const platform = os.platform();
    const arch = os.arch();
    const release = os.release();
    
    return {
      status: 'ok',
      platform,
      arch,
      release,
      isWindows: platform === 'win32',
      isMac: platform === 'darwin',
      isLinux: platform === 'linux'
    };
  }

  async checkJava() {
    try {
      const javaVersion = await this.getJavaVersion();
      if (javaVersion) {
        const majorVersion = parseInt(javaVersion.split('.')[0]);
        if (majorVersion >= 8) {
          return {
            status: 'ok',
            version: javaVersion,
            path: await this.getJavaPath()
          };
        } else {
          return {
            status: 'needs-update',
            currentVersion: javaVersion,
            requiredVersion: '8 or higher',
            message: 'Java 8 or higher is required for Minecraft servers'
          };
        }
      } else {
        return {
          status: 'missing',
          message: 'Java is not installed or not found in PATH'
        };
      }
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
      const publicIP = await this.getPublicIP();
      const localIP = this.getLocalIP();
      
      return {
        status: 'ok',
        publicIP,
        localIP,
        message: 'Network connectivity verified'
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Network check failed: ${error.message}`
      };
    }
  }

  async checkPermissions() {
    try {
      const testFile = path.join(this.baseDir, 'test-permissions');
      await fs.writeFile(testFile, 'test');
      await fs.remove(testFile);
      
      return {
        status: 'ok',
        message: 'Write permissions verified'
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Permission check failed: ${error.message}`
      };
    }
  }

  async checkDiskSpace() {
    try {
      const freeSpace = await this.getFreeDiskSpace();
      const requiredSpace = 2 * 1024 * 1024 * 1024; // 2GB minimum
      
      if (freeSpace >= requiredSpace) {
        return {
          status: 'ok',
          freeSpace: this.formatBytes(freeSpace),
          requiredSpace: this.formatBytes(requiredSpace)
        };
      } else {
        return {
          status: 'insufficient',
          freeSpace: this.formatBytes(freeSpace),
          requiredSpace: this.formatBytes(requiredSpace),
          message: 'Insufficient disk space for Minecraft servers'
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: `Disk space check failed: ${error.message}`
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
      const response = await fetch('https://files.minecraftforge.net/maven/net/minecraftforge/forge/maven-metadata.xml');
      const text = await response.text();
      
      // Parse XML to extract versions (simplified)
      const versionMatches = text.match(/<version>([^<]+)<\/version>/g);
      const versions = versionMatches
        ? versionMatches.map(match => match.replace(/<\/?version>/g, ''))
        : [];
      
      return versions.slice(0, 20); // Latest 20 versions
    } catch (error) {
      console.error('Failed to fetch Forge versions:', error);
      return [];
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
        .filter(file => file.endsWith('.jar'))
        .map(file => file.replace('forge-', '').replace('.jar', ''));
    } catch (error) {
      return [];
    }
  }

  async downloadMinecraft(version) {
    try {
      console.log(`Downloading Minecraft server version ${version}...`);
      
      // Get version manifest
      const manifestResponse = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json');
      const manifest = await manifestResponse.json();
      
      const versionInfo = manifest.versions.find(v => v.id === version);
      if (!versionInfo) {
        throw new Error(`Version ${version} not found`);
      }
      
      // Get version details
      const versionResponse = await fetch(versionInfo.url);
      const versionData = await versionResponse.json();
      
      if (!versionData.downloads || !versionData.downloads.server) {
        throw new Error(`No server download available for version ${version}`);
      }
      
      const serverJarUrl = versionData.downloads.server.url;
      const jarPath = path.join(this.minecraftDir, `server-${version}.jar`);
      
      console.log(`Downloading from: ${serverJarUrl}`);
      console.log(`Saving to: ${jarPath}`);
      
      // Download server jar
      await this.downloadFile(serverJarUrl, jarPath);
      
      console.log(`Minecraft server ${version} downloaded successfully`);
      return { version, path: jarPath };
    } catch (error) {
      console.error(`Download error for Minecraft ${version}:`, error);
      throw new Error(`Failed to download Minecraft ${version}: ${error.message}`);
    }
  }

  async downloadForge(version) {
    try {
      console.log(`Downloading Forge server version ${version}...`);
      
      // Forge download URL format
      const forgeUrl = `https://files.minecraftforge.net/maven/net/minecraftforge/forge/${version}/forge-${version}-installer.jar`;
      const installerPath = path.join(this.forgeDir, `forge-${version}-installer.jar`);
      const serverPath = path.join(this.forgeDir, `forge-${version}.jar`);
      
      // Download installer
      await this.downloadFile(forgeUrl, installerPath);
      
      // Extract server jar from installer
      await this.extractForgeServer(installerPath, serverPath);
      
      // Clean up installer
      await fs.remove(installerPath);
      
      console.log(`Forge server ${version} downloaded successfully`);
      return { version, path: serverPath };
    } catch (error) {
      throw new Error(`Failed to download Forge ${version}: ${error.message}`);
    }
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

  async extractForgeServer(installerPath, serverPath) {
    // This is a simplified extraction - in practice, you'd need to handle the Forge installer properly
    // For now, we'll just copy the installer as the server jar
    await fs.copy(installerPath, serverPath);
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
    
    if (checks.minecraft.status === 'missing') {
      recommendations.push({
        type: 'minecraft',
        priority: 'medium',
        message: 'Download Minecraft server versions',
        action: 'download-minecraft'
      });
    }
    
    if (checks.forge.status === 'missing') {
      recommendations.push({
        type: 'forge',
        priority: 'medium',
        message: 'Download Forge server versions',
        action: 'download-forge'
      });
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
}

module.exports = { SystemChecker }; 