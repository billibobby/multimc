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

// Polyfill for fetch if not available (Node.js < 18)
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

class LoaderManager {
  constructor() {
    this.baseDir = path.join(os.homedir(), '.multimc-hub');
    this.loadersDir = path.join(this.baseDir, 'loaders');
    
    // Define supported loaders
    this.supportedLoaders = {
      vanilla: {
        name: 'Vanilla',
        description: 'Official Minecraft server',
        icon: 'fas fa-cube',
        color: '#4CAF50',
        supportsMods: false,
        versionFormat: 'simple'
      },
      forge: {
        name: 'Forge',
        description: 'Popular mod loader for Minecraft',
        icon: 'fas fa-tools',
        color: '#FF6B35',
        supportsMods: true,
        versionFormat: 'minecraft-forge',
        apiUrl: 'https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml',
        downloadUrl: 'https://maven.minecraftforge.net/net/minecraftforge/forge/{version}/forge-{version}-installer.jar'
      },
      fabric: {
        name: 'Fabric',
        description: 'Lightweight mod loader',
        icon: 'fas fa-scroll',
        color: '#00C853',
        supportsMods: true,
        versionFormat: 'minecraft-loader',
        apiUrl: 'https://meta.fabricmc.net/v2/versions/loader',
        downloadUrl: 'https://maven.fabricmc.net/net/fabricmc/fabric-loader/{loader}/fabric-loader-{loader}.jar'
      },
      quilt: {
        name: 'Quilt',
        description: 'Fork of Fabric with additional features',
        icon: 'fas fa-quilt',
        color: '#9C27B0',
        supportsMods: true,
        versionFormat: 'minecraft-loader',
        apiUrl: 'https://meta.quiltmc.org/v3/versions/loader',
        downloadUrl: 'https://maven.quiltmc.org/repository/release/org/quiltmc/quilt-loader/{loader}/quilt-loader-{loader}.jar'
      },
      neoforge: {
        name: 'NeoForge',
        description: 'Fork of Forge with modern features',
        icon: 'fas fa-rocket',
        color: '#2196F3',
        supportsMods: true,
        versionFormat: 'minecraft-forge',
        apiUrl: 'https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml',
        downloadUrl: 'https://maven.neoforged.net/releases/net/neoforged/neoforge/{version}/neoforge-{version}-installer.jar'
      }
    };
    
    this.ensureDirectories();
  }

  ensureDirectories() {
    // Create base directories for each loader
    Object.keys(this.supportedLoaders).forEach(loader => {
      if (loader !== 'vanilla') {
        const loaderDir = path.join(this.loadersDir, loader);
        fs.ensureDirSync(loaderDir);
      }
    });
  }

  async checkAllLoaders() {
    const results = {};
    
    for (const [loaderId, loaderInfo] of Object.entries(this.supportedLoaders)) {
      try {
        console.log(`Checking ${loaderInfo.name} loader...`);
        if (loaderId === 'vanilla') {
          results[loaderId] = await this.checkVanilla();
        } else {
          results[loaderId] = await this.checkLoader(loaderId, loaderInfo);
        }
        console.log(`${loaderInfo.name} check completed:`, results[loaderId].status);
      } catch (error) {
        console.error(`Error checking ${loaderInfo.name}:`, error);
        results[loaderId] = {
          status: 'error',
          message: `Error checking ${loaderInfo.name}: ${error.message}`,
          availableVersions: [],
          installedVersions: []
        };
      }
    }
    
    return results;
  }

  async checkVanilla() {
    try {
      const minecraftDir = path.join(this.baseDir, 'minecraft');
      const files = await fs.readdir(minecraftDir);
      const installedVersions = files
        .filter(file => file.endsWith('.jar') && file.startsWith('server-'))
        .map(file => file.replace('server-', '').replace('.jar', ''));
      
      return {
        status: installedVersions.length > 0 ? 'ok' : 'missing',
        availableVersions: await this.getAvailableMinecraftVersions(),
        installedVersions,
        message: installedVersions.length === 0 ? 'No vanilla server versions installed' : null
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Error checking vanilla: ${error.message}`
      };
    }
  }

  async checkLoader(loaderId, loaderInfo) {
    try {
      const loaderDir = path.join(this.loadersDir, loaderId);
      const availableVersions = await this.getAvailableLoaderVersions(loaderId, loaderInfo);
      const installedVersions = await this.getInstalledLoaderVersions(loaderId);
      
      console.log(`${loaderInfo.name} check - Available: ${availableVersions.length}, Installed: ${installedVersions.length}`);
      
      return {
        status: installedVersions.length > 0 ? 'ok' : 'missing',
        availableVersions,
        installedVersions,
        message: installedVersions.length === 0 ? `No ${loaderInfo.name} server versions installed` : null
      };
    } catch (error) {
      console.error(`Error checking ${loaderInfo.name}:`, error);
      return {
        status: 'error',
        message: `Error checking ${loaderInfo.name}: ${error.message}`
      };
    }
  }

  async getAvailableMinecraftVersions() {
    try {
      const response = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json');
      const data = await response.json();
      return data.versions
        .filter(v => v.type === 'release')
        .slice(0, 50) // Show more vanilla versions
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

  async getAvailableLoaderVersions(loaderId, loaderInfo) {
    try {
      console.log(`Fetching available versions for ${loaderInfo.name}...`);
      let versions;
      switch (loaderId) {
        case 'forge':
          versions = await this.getAvailableForgeVersions(loaderInfo);
          break;
        case 'fabric':
          versions = await this.getAvailableFabricVersions(loaderInfo);
          break;
        case 'quilt':
          versions = await this.getAvailableQuiltVersions(loaderInfo);
          break;
        case 'neoforge':
          versions = await this.getAvailableNeoForgeVersions(loaderInfo);
          break;
        default:
          versions = [];
      }
      console.log(`Found ${versions.length} available versions for ${loaderInfo.name}`);
      return versions;
    } catch (error) {
      console.error(`Failed to fetch ${loaderInfo.name} versions:`, error);
      console.log(`Using fallback versions for ${loaderInfo.name}`);
      return this.getFallbackVersions(loaderId);
    }
  }

  async getAvailableForgeVersions(loaderInfo) {
    const response = await fetch(loaderInfo.apiUrl);
    const text = await response.text();
    
    const versionMatches = text.match(/<version>([^<]+)<\/version>/g);
    if (!versionMatches) return [];
    
    const versions = versionMatches
      .map(match => match.replace(/<\/?version>/g, ''))
      .filter(version => {
        // Filter for stable versions and common Minecraft versions
        const mcVersion = version.split('-')[0];
        const forgeVersion = version.split('-')[1];
        
        // Include more Minecraft versions and filter out alpha/beta versions
        const supportedMCVersions = [
          '1.21.1', '1.21', '1.20.4', '1.20.3', '1.20.2', '1.20.1', '1.20',
          '1.19.4', '1.19.3', '1.19.2', '1.19.1', '1.19',
          '1.18.2', '1.18.1', '1.18',
          '1.17.1', '1.17',
          '1.16.5', '1.16.4', '1.16.3', '1.16.2', '1.16.1', '1.16'
        ];
        
        return supportedMCVersions.includes(mcVersion) && 
               !forgeVersion.includes('alpha') && 
               !forgeVersion.includes('beta') &&
               !forgeVersion.includes('snapshot');
      })
      .sort((a, b) => {
        const aParts = a.split('-');
        const bParts = b.split('-');
        const aMC = aParts[0];
        const bMC = bParts[0];
        
        if (aMC !== bMC) {
          return bMC.localeCompare(aMC);
        }
        
        return b.localeCompare(a);
      });
    
    // Return all versions, not just 15
    return versions.map(version => ({
      id: version,
      minecraftVersion: version.split('-')[0],
      loaderVersion: version.split('-')[1] || version,
      type: 'release',
      releaseTime: new Date().toISOString()
    }));
  }

  async getAvailableFabricVersions(loaderInfo) {
    try {
      console.log('Fetching Fabric versions from:', loaderInfo.apiUrl);
      const response = await fetch(loaderInfo.apiUrl);
      const data = await response.json();
      
      console.log('Raw Fabric API response:', data.slice(0, 5));
      
      // Get ALL stable loader versions (no artificial limit)
      const loaderVersions = data
        .filter(v => v.stable)
        .map(v => v.version)
        .sort((a, b) => {
          // Sort loader versions numerically
          const aParts = a.split('.').map(Number);
          const bParts = b.split('.').map(Number);
          
          for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aVal = aParts[i] || 0;
            const bVal = bParts[i] || 0;
            if (aVal !== bVal) {
              return bVal - aVal; // Newer versions first
            }
          }
          return 0;
        });
      
      console.log(`Found ${loaderVersions.length} Fabric loader versions:`, loaderVersions);
      
      // Get game versions (comprehensive list including more versions)
      const gameVersions = [
        '1.21.1', '1.21', '1.20.4', '1.20.3', '1.20.2', '1.20.1', '1.20',
        '1.19.4', '1.19.3', '1.19.2', '1.19.1', '1.19',
        '1.18.2', '1.18.1', '1.18',
        '1.17.1', '1.17',
        '1.16.5', '1.16.4', '1.16.3', '1.16.2', '1.16.1', '1.16'
      ];
      
      const versions = [];
      for (const gameVersion of gameVersions) {
        // Include ALL loader versions for each game version (no artificial limit)
        for (const loaderVersion of loaderVersions) {
          versions.push({
            id: `${gameVersion}-${loaderVersion}`,
            minecraftVersion: gameVersion,
            loaderVersion: loaderVersion,
            type: 'release',
            releaseTime: new Date().toISOString()
          });
        }
      }
      
      console.log(`Generated ${versions.length} Fabric version combinations`);
      
      // Also add some common specific versions that might be missing
      const additionalVersions = [
        '1.20.4-0.16.10', '1.20.4-0.15.0', '1.20.4-0.14.24', '1.20.4-0.14.21', '1.20.4-0.14.20',
        '1.20.1-0.16.10', '1.20.1-0.15.0', '1.20.1-0.14.24', '1.20.1-0.14.21', '1.20.1-0.14.20',
        '1.19.4-0.16.10', '1.19.4-0.15.0', '1.19.4-0.14.21', '1.19.4-0.14.20', '1.19.4-0.14.19',
        '1.19.2-0.16.10', '1.19.2-0.15.0', '1.19.2-0.14.21', '1.19.2-0.14.20', '1.19.2-0.14.19',
        '1.18.2-0.16.10', '1.18.2-0.15.0', '1.18.2-0.14.21', '1.18.2-0.14.20', '1.18.2-0.14.19'
      ];
      
      // Add additional versions if they're not already included
      for (const versionId of additionalVersions) {
        const [mcVersion, loaderVersion] = versionId.split('-');
        const exists = versions.some(v => v.id === versionId);
        if (!exists) {
          versions.push({
            id: versionId,
            minecraftVersion: mcVersion,
            loaderVersion: loaderVersion,
            type: 'release',
            releaseTime: new Date().toISOString()
          });
        }
      }
      
      console.log(`Final Fabric versions count: ${versions.length}`);
      return versions;
      
    } catch (error) {
      console.error('Error fetching Fabric versions:', error);
      // Return comprehensive fallback versions
      return this.getFallbackVersions('fabric');
    }
  }

  async getAvailableQuiltVersions(loaderInfo) {
    const response = await fetch(loaderInfo.apiUrl);
    const data = await response.json();
    
    // Get loader versions (filter out beta versions, show more)
    const loaderVersions = data
      .filter(v => !v.version.includes('beta') && !v.version.includes('alpha'))
      .slice(0, 15) // Show more loader versions
      .map(v => v.version);
    
    // Get game versions (more versions)
    const gameVersions = [
      '1.21.1', '1.21', '1.20.4', '1.20.3', '1.20.2', '1.20.1', '1.20',
      '1.19.4', '1.19.3', '1.19.2', '1.19.1', '1.19',
      '1.18.2', '1.18.1', '1.18',
      '1.17.1', '1.17',
      '1.16.5', '1.16.4', '1.16.3', '1.16.2', '1.16.1', '1.16'
    ];
    
    const versions = [];
    for (const gameVersion of gameVersions) {
      for (const loaderVersion of loaderVersions.slice(0, 5)) { // More combinations
        versions.push({
          id: `${gameVersion}-${loaderVersion}`,
          minecraftVersion: gameVersion,
          loaderVersion: loaderVersion,
          type: 'release',
          releaseTime: new Date().toISOString()
        });
      }
    }
    
    return versions;
  }

  async getAvailableNeoForgeVersions(loaderInfo) {
    const response = await fetch(loaderInfo.apiUrl);
    const text = await response.text();
    
    const versionMatches = text.match(/<version>([^<]+)<\/version>/g);
    if (!versionMatches) return [];
    
    const versions = versionMatches
      .map(match => match.replace(/<\/?version>/g, ''))
      .filter(version => {
        // NeoForge uses format like "20.2.3-beta" where 20.2 corresponds to Minecraft 1.20.2
        const parts = version.split('.');
        if (parts.length >= 2) {
          const major = parseInt(parts[0]);
          const minor = parseInt(parts[1]);
          // Map NeoForge version to Minecraft version (20.2 = 1.20.2)
          const mcVersion = `1.${major}.${minor}`;
          
          // Support more Minecraft versions
          const supportedMCVersions = [
            '1.21.1', '1.21', '1.20.4', '1.20.3', '1.20.2', '1.20.1', '1.20',
            '1.19.4', '1.19.3', '1.19.2', '1.19.1', '1.19',
            '1.18.2', '1.18.1', '1.18',
            '1.17.1', '1.17',
            '1.16.5', '1.16.4', '1.16.3', '1.16.2', '1.16.1', '1.16'
          ];
          
          return supportedMCVersions.includes(mcVersion) && 
                 !version.includes('alpha') && 
                 !version.includes('snapshot');
        }
        return false;
      })
      .sort((a, b) => {
        const aParts = a.split('.');
        const bParts = b.split('.');
        const aMajor = parseInt(aParts[0]);
        const bMajor = parseInt(bParts[0]);
        const aMinor = parseInt(aParts[1]);
        const bMinor = parseInt(bParts[1]);
        
        if (aMajor !== bMajor) {
          return bMajor - aMajor;
        }
        
        if (aMinor !== bMinor) {
          return bMinor - aMinor;
        }
        
        return b.localeCompare(a);
      });
    
    // Return all versions, not just 15
    return versions.map(version => {
      const parts = version.split('.');
      const major = parseInt(parts[0]);
      const minor = parseInt(parts[1]);
      const mcVersion = `1.${major}.${minor}`;
      return {
        id: version,
        minecraftVersion: mcVersion,
        loaderVersion: version,
        type: 'release',
        releaseTime: new Date().toISOString()
      };
    });
  }

  getFallbackVersions(loaderId) {
    const fallbackVersions = {
      forge: [
        { id: '1.20.4-49.0.3', minecraftVersion: '1.20.4', loaderVersion: '49.0.3', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.20.1-47.2.0', minecraftVersion: '1.20.1', loaderVersion: '47.2.0', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.19.4-45.2.0', minecraftVersion: '1.19.4', loaderVersion: '45.2.0', type: 'release', releaseTime: new Date().toISOString() }
      ],
      fabric: [
        // 1.20.4 versions
        { id: '1.20.4-0.16.10', minecraftVersion: '1.20.4', loaderVersion: '0.16.10', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.20.4-0.15.0', minecraftVersion: '1.20.4', loaderVersion: '0.15.0', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.20.4-0.14.24', minecraftVersion: '1.20.4', loaderVersion: '0.14.24', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.20.4-0.14.21', minecraftVersion: '1.20.4', loaderVersion: '0.14.21', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.20.4-0.14.20', minecraftVersion: '1.20.4', loaderVersion: '0.14.20', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.20.4-0.14.19', minecraftVersion: '1.20.4', loaderVersion: '0.14.19', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.20.4-0.14.18', minecraftVersion: '1.20.4', loaderVersion: '0.14.18', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.20.4-0.14.17', minecraftVersion: '1.20.4', loaderVersion: '0.14.17', type: 'release', releaseTime: new Date().toISOString() },
        
        // 1.20.1 versions
        { id: '1.20.1-0.16.10', minecraftVersion: '1.20.1', loaderVersion: '0.16.10', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.20.1-0.15.0', minecraftVersion: '1.20.1', loaderVersion: '0.15.0', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.20.1-0.14.24', minecraftVersion: '1.20.1', loaderVersion: '0.14.24', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.20.1-0.14.21', minecraftVersion: '1.20.1', loaderVersion: '0.14.21', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.20.1-0.14.20', minecraftVersion: '1.20.1', loaderVersion: '0.14.20', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.20.1-0.14.19', minecraftVersion: '1.20.1', loaderVersion: '0.14.19', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.20.1-0.14.18', minecraftVersion: '1.20.1', loaderVersion: '0.14.18', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.20.1-0.14.17', minecraftVersion: '1.20.1', loaderVersion: '0.14.17', type: 'release', releaseTime: new Date().toISOString() },
        
        // 1.19.4 versions
        { id: '1.19.4-0.16.10', minecraftVersion: '1.19.4', loaderVersion: '0.16.10', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.19.4-0.15.0', minecraftVersion: '1.19.4', loaderVersion: '0.15.0', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.19.4-0.14.21', minecraftVersion: '1.19.4', loaderVersion: '0.14.21', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.19.4-0.14.20', minecraftVersion: '1.19.4', loaderVersion: '0.14.20', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.19.4-0.14.19', minecraftVersion: '1.19.4', loaderVersion: '0.14.19', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.19.4-0.14.18', minecraftVersion: '1.19.4', loaderVersion: '0.14.18', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.19.4-0.14.17', minecraftVersion: '1.19.4', loaderVersion: '0.14.17', type: 'release', releaseTime: new Date().toISOString() },
        
        // 1.19.2 versions
        { id: '1.19.2-0.16.10', minecraftVersion: '1.19.2', loaderVersion: '0.16.10', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.19.2-0.15.0', minecraftVersion: '1.19.2', loaderVersion: '0.15.0', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.19.2-0.14.21', minecraftVersion: '1.19.2', loaderVersion: '0.14.21', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.19.2-0.14.20', minecraftVersion: '1.19.2', loaderVersion: '0.14.20', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.19.2-0.14.19', minecraftVersion: '1.19.2', loaderVersion: '0.14.19', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.19.2-0.14.18', minecraftVersion: '1.19.2', loaderVersion: '0.14.18', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.19.2-0.14.17', minecraftVersion: '1.19.2', loaderVersion: '0.14.17', type: 'release', releaseTime: new Date().toISOString() },
        
        // 1.18.2 versions
        { id: '1.18.2-0.16.10', minecraftVersion: '1.18.2', loaderVersion: '0.16.10', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.18.2-0.15.0', minecraftVersion: '1.18.2', loaderVersion: '0.15.0', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.18.2-0.14.21', minecraftVersion: '1.18.2', loaderVersion: '0.14.21', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.18.2-0.14.20', minecraftVersion: '1.18.2', loaderVersion: '0.14.20', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.18.2-0.14.19', minecraftVersion: '1.18.2', loaderVersion: '0.14.19', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.18.2-0.14.18', minecraftVersion: '1.18.2', loaderVersion: '0.14.18', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.18.2-0.14.17', minecraftVersion: '1.18.2', loaderVersion: '0.14.17', type: 'release', releaseTime: new Date().toISOString() }
      ],
      quilt: [
        { id: '1.20.4-0.23.1', minecraftVersion: '1.20.4', loaderVersion: '0.23.1', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.20.1-0.23.1', minecraftVersion: '1.20.1', loaderVersion: '0.23.1', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.19.4-0.20.2', minecraftVersion: '1.19.4', loaderVersion: '0.20.2', type: 'release', releaseTime: new Date().toISOString() }
      ],
      neoforge: [
        { id: '1.20.4-20.4.80-beta', minecraftVersion: '1.20.4', loaderVersion: '20.4.80-beta', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.20.1-20.4.80-beta', minecraftVersion: '1.20.1', loaderVersion: '20.4.80-beta', type: 'release', releaseTime: new Date().toISOString() },
        { id: '1.19.4-20.4.80-beta', minecraftVersion: '1.19.4', loaderVersion: '20.4.80-beta', type: 'release', releaseTime: new Date().toISOString() }
      ]
    };
    
    return fallbackVersions[loaderId] || [];
  }

  async getInstalledLoaderVersions(loaderId) {
    try {
      const loaderDir = path.join(this.loadersDir, loaderId);
      const files = await fs.readdir(loaderDir);
      
      console.log(`Checking for installed ${loaderId} files in: ${loaderDir}`);
      console.log(`Found files:`, files);
      
      let installedVersions = [];
      
      switch (loaderId) {
        case 'fabric':
          // Look for fabric-* directories that contain server files
          const fabricDirs = files.filter(file => 
            !file.includes('.') && file.startsWith('fabric-')
          );
          
          // Check each directory for server files
          for (const dir of fabricDirs) {
            const versionMatch = dir.match(/fabric-(.+)/);
            if (versionMatch) {
              const version = versionMatch[1];
              const dirPath = path.join(loaderDir, dir);
              
              try {
                const dirFiles = await fs.readdir(dirPath);
                // Check if directory contains server files
                const hasServerJar = dirFiles.some(file => 
                  file === 'server-1.20.1.jar' || 
                  file === 'server-1.19.4.jar' || 
                  file === 'server-1.20.4.jar' ||
                  file.includes('fabric-server')
                );
                
                if (hasServerJar) {
                  installedVersions.push(version);
                }
              } catch (error) {
                console.error(`Error checking fabric directory ${dir}:`, error);
              }
            }
          }
          break;
          
        case 'forge':
          // Look for forge-*.jar files
          const forgeJars = files.filter(file => 
            file.endsWith('.jar') && file.startsWith('forge-') && !file.includes('installer')
          );
          forgeJars.forEach(file => {
            const versionMatch = file.match(/forge-(.+?)\.jar/);
            if (versionMatch) {
              installedVersions.push(versionMatch[1]);
            }
          });
          break;
          
        case 'quilt':
          // Look for quilt-*.jar files
          const quiltJars = files.filter(file => 
            file.endsWith('.jar') && file.startsWith('quilt-') && !file.includes('loader')
          );
          quiltJars.forEach(file => {
            const versionMatch = file.match(/quilt-(.+?)\.jar/);
            if (versionMatch) {
              installedVersions.push(versionMatch[1]);
            }
          });
          break;
          
        case 'neoforge':
          // Look for neoforge-*.jar files
          const neoforgeJars = files.filter(file => 
            file.endsWith('.jar') && file.startsWith('neoforge-') && !file.includes('installer')
          );
          neoforgeJars.forEach(file => {
            const versionMatch = file.match(/neoforge-(.+?)\.jar/);
            if (versionMatch) {
              installedVersions.push(versionMatch[1]);
            }
          });
          break;
          
        default:
          // Fallback to original logic
          installedVersions = files
            .filter(file => file.endsWith('.jar') && file.startsWith(`${loaderId}-`))
            .map(file => file.replace(`${loaderId}-`, '').replace('.jar', ''));
      }
      
      console.log(`Installed ${loaderId} versions:`, installedVersions);
      return installedVersions;
    } catch (error) {
      console.error(`Error checking installed ${loaderId} versions:`, error);
      return [];
    }
  }

  async downloadLoader(loaderId, version) {
    try {
      const loaderInfo = this.supportedLoaders[loaderId];
      if (!loaderInfo) {
        throw new Error(`Unsupported loader: ${loaderId}`);
      }

      console.log(`Downloading ${loaderInfo.name} server version ${version}...`);
      
      const loaderDir = path.join(this.loadersDir, loaderId);
      await fs.ensureDir(loaderDir);
      
      let result;
      switch (loaderId) {
        case 'forge':
          result = await this.downloadForge(version, loaderInfo);
          break;
        case 'fabric':
          result = await this.downloadFabric(version, loaderInfo);
          break;
        case 'quilt':
          result = await this.downloadQuilt(version, loaderInfo);
          break;
        case 'neoforge':
          result = await this.downloadNeoForge(version, loaderInfo);
          break;
        default:
          throw new Error(`Download not implemented for ${loaderId}`);
      }
      
      console.log(`${loaderInfo.name} server ${version} downloaded successfully`);
      return result;
    } catch (error) {
      console.error(`Failed to download ${loaderId} ${version}:`, error);
      throw new Error(`Failed to download ${loaderId} ${version}: ${error.message}`);
    }
  }

  async downloadForge(version, loaderInfo) {
    const [minecraftVersion, forgeVersion] = version.split('-');
    if (!minecraftVersion || !forgeVersion) {
      throw new Error(`Invalid Forge version format: ${version}. Expected format: MCVERSION-FORGEVERSION`);
    }
    
    const installerUrl = loaderInfo.downloadUrl.replace('{version}', version);
    const installerPath = path.join(this.loadersDir, 'forge', `forge-${version}-installer.jar`);
    
    console.log(`Downloading installer from: ${installerUrl}`);
    await this.downloadFile(installerUrl, installerPath, (progress, status) => {
      // Send progress update to main process if available
      if (global.mainWindow && !global.mainWindow.isDestroyed()) {
        global.mainWindow.webContents.send('download-progress', { progress, status });
      }
    });
    
    const serverJarPath = path.join(this.loadersDir, 'forge', `forge-${version}.jar`);
    await this.extractForgeServer(installerPath, serverJarPath, version);
    
    await fs.remove(installerPath);
    
    return { version, path: serverJarPath, minecraftVersion, loaderVersion: forgeVersion };
  }

  async downloadFabric(version, loaderInfo) {
    const [minecraftVersion, loaderVersion] = version.split('-');
    if (!minecraftVersion || !loaderVersion) {
      throw new Error(`Invalid Fabric version format: ${version}. Expected format: MCVERSION-LOADERVERSION`);
    }
    
    console.log(`Downloading Fabric server ${version}...`);
    
    // Download Minecraft server first
    const minecraftDir = path.join(this.baseDir, 'minecraft');
    const minecraftJarPath = path.join(minecraftDir, `server-${minecraftVersion}.jar`);
    
    if (!await fs.pathExists(minecraftJarPath)) {
      console.log(`Downloading Minecraft server ${minecraftVersion}...`);
      await this.downloadMinecraft(minecraftVersion);
    }
    
    // Get the latest stable Fabric installer
    const installerResponse = await fetch('https://meta.fabricmc.net/v2/versions/installer');
    const installers = await installerResponse.json();
    const stableInstaller = installers.find(installer => installer.stable);
    
    if (!stableInstaller) {
      throw new Error('No stable Fabric installer found');
    }
    
    // Download Fabric installer
    const installerPath = path.join(this.loadersDir, 'fabric', `fabric-installer-${stableInstaller.version}.jar`);
    console.log(`Downloading Fabric installer from: ${stableInstaller.url}`);
    await this.downloadFile(stableInstaller.url, installerPath, (progress, status) => {
      // Send progress update to main process if available
      if (global.mainWindow && !global.mainWindow.isDestroyed()) {
        global.mainWindow.webContents.send('download-progress', { progress, status });
      }
    });
    
    // Create server directory
    const serverDir = path.join(this.loadersDir, 'fabric', `fabric-${version}`);
    await fs.ensureDir(serverDir);
    
    // Copy Minecraft server JAR to server directory
    const serverJarPath = path.join(serverDir, `server-${minecraftVersion}.jar`);
    await fs.copy(minecraftJarPath, serverJarPath);
    
    // Run Fabric installer to create server
    const { spawn } = require('child_process');
    const javaPath = await this.getJavaPath();
    
    if (!javaPath) {
      throw new Error('Java not found. Please install Java to create Fabric servers.');
    }
    
    return new Promise((resolve, reject) => {
      const installerProcess = spawn(javaPath, [
        '-jar', installerPath,
        'server',
        '-mcversion', minecraftVersion,
        '-loader', loaderVersion,
        '-dir', serverDir
      ], { cwd: serverDir });
      
      let output = '';
      let errorOutput = '';
      
      installerProcess.stdout.on('data', (data) => {
        output += data.toString();
        console.log('Fabric installer:', data.toString());
        
        // Send progress update for installer process
        if (global.mainWindow && !global.mainWindow.isDestroyed()) {
          global.mainWindow.webContents.send('download-progress', { 
            progress: 50, // Installer is roughly 50% of the process
            status: 'Installing Fabric server...'
          });
        }
      });
      
      installerProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error('Fabric installer error:', data.toString());
      });
      
      installerProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`Fabric server ${version} created successfully`);
          
          // Find the generated server JAR
          const files = fs.readdirSync(serverDir);
          const serverJar = files.find(file => file.includes('fabric-server') && file.endsWith('.jar'));
          
          if (serverJar) {
            const finalServerJarPath = path.join(serverDir, serverJar);
            resolve({
              version,
              path: finalServerJarPath,
              minecraftVersion,
              loaderVersion,
              serverDir: serverDir
            });
          } else {
            reject(new Error('Fabric server JAR not found after installation'));
          }
        } else {
          reject(new Error(`Fabric installer failed with code ${code}: ${errorOutput}`));
        }
      });
      
      installerProcess.on('error', (error) => {
        reject(new Error(`Failed to run Fabric installer: ${error.message}`));
      });
    });
  }

  async downloadQuilt(version, loaderInfo) {
    const [minecraftVersion, loaderVersion] = version.split('-');
    if (!minecraftVersion || !loaderVersion) {
      throw new Error(`Invalid Quilt version format: ${version}. Expected format: MCVERSION-LOADERVERSION`);
    }
    
    // Download Minecraft server first
    const minecraftDir = path.join(this.baseDir, 'minecraft');
    const minecraftJarPath = path.join(minecraftDir, `server-${minecraftVersion}.jar`);
    
    if (!await fs.pathExists(minecraftJarPath)) {
      await this.downloadMinecraft(minecraftVersion);
    }
    
    // Download Quilt loader
    const loaderUrl = loaderInfo.downloadUrl.replace('{loader}', loaderVersion);
    const loaderPath = path.join(this.loadersDir, 'quilt', `quilt-loader-${loaderVersion}.jar`);
    
    console.log(`Downloading Quilt loader from: ${loaderUrl}`);
    await this.downloadFile(loaderUrl, loaderPath, (progress, status) => {
      // Send progress update to main process if available
      if (global.mainWindow && !global.mainWindow.isDestroyed()) {
        global.mainWindow.webContents.send('download-progress', { progress, status });
      }
    });
    
    // Create Quilt server JAR (this is a simplified approach)
    const serverJarPath = path.join(this.loadersDir, 'quilt', `quilt-${version}.jar`);
    await fs.copy(minecraftJarPath, serverJarPath);
    
    return { version, path: serverJarPath, minecraftVersion, loaderVersion };
  }

  async downloadNeoForge(version, loaderInfo) {
    // NeoForge version format is just the loader version (e.g., "20.4.80-beta")
    // We need to determine the Minecraft version from the NeoForge version
    const neoforgeVersion = version;
    
    // Extract Minecraft version from NeoForge version (e.g., "20.4.80-beta" -> "1.20.4")
    const versionParts = neoforgeVersion.split('.');
    if (versionParts.length < 2) {
      throw new Error(`Invalid NeoForge version format: ${version}. Expected format like "20.4.80-beta"`);
    }
    
    const major = parseInt(versionParts[0]);
    const minor = parseInt(versionParts[1]);
    const minecraftVersion = `1.${major}.${minor}`;
    
    console.log(`NeoForge version: ${neoforgeVersion}, Minecraft version: ${minecraftVersion}`);
    
    // Download Minecraft server first if needed
    const minecraftDir = path.join(this.baseDir, 'minecraft');
    const minecraftJarPath = path.join(minecraftDir, `server-${minecraftVersion}.jar`);
    
    if (!await fs.pathExists(minecraftJarPath)) {
      console.log(`Downloading Minecraft server ${minecraftVersion}...`);
      await this.downloadMinecraft(minecraftVersion);
    }
    
    // Construct the full version string for the download URL
    const fullVersion = `${minecraftVersion}-${neoforgeVersion}`;
    const installerUrl = loaderInfo.downloadUrl.replace('{version}', fullVersion);
    const installerPath = path.join(this.loadersDir, 'neoforge', `neoforge-${fullVersion}-installer.jar`);
    
    console.log(`Downloading installer from: ${installerUrl}`);
    await this.downloadFile(installerUrl, installerPath, (progress, status) => {
      // Send progress update to main process if available
      if (global.mainWindow && !global.mainWindow.isDestroyed()) {
        global.mainWindow.webContents.send('download-progress', { progress, status });
      }
    });
    
    const serverJarPath = path.join(this.loadersDir, 'neoforge', `neoforge-${fullVersion}.jar`);
    await this.extractNeoForgeServer(installerPath, serverJarPath, fullVersion);
    
    await fs.remove(installerPath);
    
    return { version: fullVersion, path: serverJarPath, minecraftVersion, loaderVersion: neoforgeVersion };
  }

  async downloadMinecraft(version) {
    try {
      console.log(`Downloading Minecraft server version ${version}...`);
      
      const manifestResponse = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json');
      const manifest = await manifestResponse.json();
      
      const versionInfo = manifest.versions.find(v => v.id === version);
      if (!versionInfo) {
        throw new Error(`Version ${version} not found`);
      }
      
      const versionResponse = await fetch(versionInfo.url);
      const versionData = await versionResponse.json();
      
      if (!versionData.downloads || !versionData.downloads.server) {
        throw new Error(`No server download available for version ${version}`);
      }
      
      const serverJarUrl = versionData.downloads.server.url;
      const minecraftDir = path.join(this.baseDir, 'minecraft');
      const jarPath = path.join(minecraftDir, `server-${version}.jar`);
      
      console.log(`Downloading from: ${serverJarUrl}`);
      console.log(`Saving to: ${jarPath}`);
      
      await this.downloadFile(serverJarUrl, jarPath, (progress, status) => {
        // Send progress update to main process if available
        if (global.mainWindow && !global.mainWindow.isDestroyed()) {
          global.mainWindow.webContents.send('download-progress', { progress, status });
        }
      });
      
      console.log(`Minecraft server ${version} downloaded successfully`);
      return { version, path: jarPath };
    } catch (error) {
      console.error(`Download error for Minecraft ${version}:`, error);
      throw new Error(`Failed to download Minecraft ${version}: ${error.message}`);
    }
  }

  async downloadFile(url, filePath, onProgress) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(filePath);
      
      const request = url.startsWith('https') ? https : http;
      request.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        
        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;
        
        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (onProgress && totalSize) {
            const progress = Math.round((downloadedSize / totalSize) * 100);
            onProgress(progress, `Downloading... ${progress}%`);
          }
        });
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve();
        });
        
        file.on('error', (err) => {
          fs.unlink(filePath, () => {}); // Delete the file async, but don't check the result
          reject(err);
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  }

  async extractForgeServer(installerPath, serverJarPath, version) {
    try {
      const extractDir = path.join(this.loadersDir, 'forge', `temp-${version}`);
      await fs.ensureDir(extractDir);
      
      await extract(installerPath, { dir: extractDir });
      
      const files = await fs.readdir(extractDir);
      const serverJarFile = files.find(file => 
        file.includes('server') && file.endsWith('.jar') && !file.includes('installer')
      );
      
      if (!serverJarFile) {
        const jarFile = files.find(file => file.endsWith('.jar') && !file.includes('installer'));
        if (jarFile) {
          await fs.copy(path.join(extractDir, jarFile), serverJarPath);
        } else {
          throw new Error('No server JAR found in Forge installer');
        }
      } else {
        await fs.copy(path.join(extractDir, serverJarFile), serverJarPath);
      }
      
      await fs.remove(extractDir);
      
    } catch (error) {
      console.error('Failed to extract Forge server:', error);
      await fs.copy(installerPath, serverJarPath);
      console.log('Using installer as server jar (fallback method)');
    }
  }

  async extractNeoForgeServer(installerPath, serverJarPath, version) {
    try {
      const extractDir = path.join(this.loadersDir, 'neoforge', `temp-${version}`);
      await fs.ensureDir(extractDir);
      
      await extract(installerPath, { dir: extractDir });
      
      const files = await fs.readdir(extractDir);
      const serverJarFile = files.find(file => 
        file.includes('server') && file.endsWith('.jar') && !file.includes('installer')
      );
      
      if (!serverJarFile) {
        const jarFile = files.find(file => file.endsWith('.jar') && !file.includes('installer'));
        if (jarFile) {
          await fs.copy(path.join(extractDir, jarFile), serverJarPath);
        } else {
          throw new Error('No server JAR found in NeoForge installer');
        }
      } else {
        await fs.copy(path.join(extractDir, serverJarFile), serverJarPath);
      }
      
      await fs.remove(extractDir);
      
    } catch (error) {
      console.error('Failed to extract NeoForge server:', error);
      await fs.copy(installerPath, serverJarPath);
      console.log('Using installer as server jar (fallback method)');
    }
  }

  getLoaderInfo(loaderId) {
    return this.supportedLoaders[loaderId] || null;
  }

  getSupportedLoaders() {
    return this.supportedLoaders;
  }

  async getJavaPath() {
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      const command = process.platform === 'win32' ? 'where java' : 'which java';
      exec(command, (error, stdout) => {
        if (error) {
          resolve(null);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }
}

module.exports = { LoaderManager }; 