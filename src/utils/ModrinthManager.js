const { EventEmitter } = require('events');
const https = require('https');
const http = require('http');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class ModrinthManager extends EventEmitter {
  constructor() {
    super();
    this.baseUrl = 'https://api.modrinth.com/v2';
    this.cacheDir = path.join(require('os').homedir(), '.multimc-hub', 'modrinth-cache');
    this.ensureCacheDirectory();
    
    // Cache for mod data
    this.modCache = new Map();
    this.searchCache = new Map();
    this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
    
    // Rate limiting
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.lastRequestTime = 0;
    this.minRequestInterval = 100; // 100ms between requests
  }

  ensureCacheDirectory() {
    fs.ensureDirSync(this.cacheDir);
    fs.ensureDirSync(path.join(this.cacheDir, 'mods'));
    fs.ensureDirSync(path.join(this.cacheDir, 'images'));
    fs.ensureDirSync(path.join(this.cacheDir, 'files'));
  }

  async makeRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}${endpoint}`;
      const urlObj = new URL(url);
      
      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'MultiMC-Hub/1.0.0',
          'Accept': 'application/json',
          ...options.headers
        }
      };

      const protocol = urlObj.protocol === 'https:' ? https : http;
      
      const req = protocol.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const jsonData = JSON.parse(data);
              resolve(jsonData);
            } catch (error) {
              reject(new Error(`Failed to parse JSON response: ${error.message}`));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      
      req.end();
    });
  }

  async rateLimitedRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ endpoint, options, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      if (timeSinceLastRequest < this.minRequestInterval) {
        await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest));
      }

      const { endpoint, options, resolve, reject } = this.requestQueue.shift();
      this.lastRequestTime = Date.now();

      try {
        const result = await this.makeRequest(endpoint, options);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.isProcessingQueue = false;
  }

  // Search mods with comprehensive filtering
  async searchMods(query = '', filters = {}) {
    const cacheKey = `search_${query}_${JSON.stringify(filters)}`;
    
    // Check cache first
    if (this.searchCache.has(cacheKey)) {
      const cached = this.searchCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      }
    }

    const searchParams = new URLSearchParams();
    
    if (query) {
      searchParams.append('query', query);
    }
    
    // Add filters
    if (filters.loader) {
      searchParams.append('facets', `[["project_type:mod"],["loader:${filters.loader}"]]`);
    }
    
    if (filters.gameVersion) {
      searchParams.append('game_versions', `["${filters.gameVersion}"]`);
    }
    
    if (filters.category) {
      searchParams.append('facets', `[["categories:${filters.category}"]]`);
    }
    
    if (filters.sortBy) {
      searchParams.append('index', filters.sortBy);
    }
    
    // Default to 50 mods if no limit specified
    const limit = filters.limit || 50;
    searchParams.append('limit', limit.toString());
    
    if (filters.offset) {
      searchParams.append('offset', filters.offset.toString());
    }

    try {
      const results = await this.rateLimitedRequest(`/search?${searchParams.toString()}`);
      
      // Cache the results
      this.searchCache.set(cacheKey, {
        data: results,
        timestamp: Date.now()
      });
      
      return results;
    } catch (error) {
      console.error('Failed to search mods:', error);
      throw error;
    }
  }

  // Get total mod count for statistics
  async getTotalModCount() {
    try {
      const result = await this.rateLimitedRequest('/search?facets=[["project_type:mod"]]&limit=1');
      return result.total_hits || 0;
    } catch (error) {
      console.error('Failed to get total mod count:', error);
      return 0;
    }
  }

  // Get detailed mod information
  async getModDetails(projectId) {
    const cacheKey = `mod_${projectId}`;
    
    // Check cache first
    if (this.modCache.has(cacheKey)) {
      const cached = this.modCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      }
    }

    try {
      const [project, versions, team] = await Promise.all([
        this.rateLimitedRequest(`/project/${projectId}`),
        this.rateLimitedRequest(`/project/${projectId}/version`),
        this.rateLimitedRequest(`/project/${projectId}/team`)
      ]);

      const modData = {
        ...project,
        versions,
        team,
        timestamp: Date.now()
      };

      // Cache the mod data
      this.modCache.set(cacheKey, {
        data: modData,
        timestamp: Date.now()
      });

      return modData;
    } catch (error) {
      console.error(`Failed to get mod details for ${projectId}:`, error);
      throw error;
    }
  }

  // Get mod versions with filtering
  async getModVersions(projectId, filters = {}) {
    try {
      const versions = await this.rateLimitedRequest(`/project/${projectId}/version`);
      
      // Filter versions based on criteria
      let filteredVersions = versions;
      
      if (filters.gameVersion) {
        filteredVersions = filteredVersions.filter(version => 
          version.game_versions.includes(filters.gameVersion)
        );
      }
      
      if (filters.loader) {
        filteredVersions = filteredVersions.filter(version => 
          version.loaders.includes(filters.loader)
        );
      }
      
      if (filters.releaseType) {
        filteredVersions = filteredVersions.filter(version => 
          version.version_type === filters.releaseType
        );
      }
      
      // Sort by date (newest first)
      filteredVersions.sort((a, b) => new Date(b.date_published) - new Date(a.date_published));
      
      return filteredVersions;
    } catch (error) {
      console.error(`Failed to get versions for ${projectId}:`, error);
      throw error;
    }
  }

  // Download mod file
  async downloadModFile(versionId, targetPath) {
    try {
      // Get file info first
      const version = await this.rateLimitedRequest(`/version/${versionId}`);
      const file = version.files.find(f => f.primary) || version.files[0];
      
      if (!file) {
        throw new Error('No primary file found for this version');
      }

      const downloadUrl = file.url;
      const fileName = file.filename;
      const filePath = path.join(targetPath, fileName);

      // Check if file already exists
      if (await fs.pathExists(filePath)) {
        return { path: filePath, fileName, version };
      }

      // Download the file
      await this.downloadFile(downloadUrl, filePath);
      
      return { path: filePath, fileName, version };
    } catch (error) {
      console.error(`Failed to download mod file ${versionId}:`, error);
      throw error;
    }
  }

  // Download file from URL
  async downloadFile(url, targetPath) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https:') ? https : http;
      
      const req = protocol.get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        const fileStream = fs.createWriteStream(targetPath);
        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });

        fileStream.on('error', (error) => {
          fs.unlink(targetPath, () => {}); // Delete partial file
          reject(error);
        });
      });

      req.on('error', (error) => {
        reject(error);
      });
    });
  }

  // Get mod categories
  async getCategories() {
    try {
      return await this.rateLimitedRequest('/tag/category');
    } catch (error) {
      console.error('Failed to get categories:', error);
      throw error;
    }
  }

  // Get loaders
  async getLoaders() {
    try {
      return await this.rateLimitedRequest('/tag/loader');
    } catch (error) {
      console.error('Failed to get loaders:', error);
      throw error;
    }
  }

  // Get game versions
  async getGameVersions() {
    try {
      return await this.rateLimitedRequest('/tag/game_version');
    } catch (error) {
      console.error('Failed to get game versions:', error);
      throw error;
    }
  }

  // Get license types
  async getLicenses() {
    try {
      return await this.rateLimitedRequest('/tag/license');
    } catch (error) {
      console.error('Failed to get licenses:', error);
      throw error;
    }
  }

  // Install mod to server
  async installModToServer(versionId, serverPath) {
    try {
      const modsDir = path.join(serverPath, 'mods');
      await fs.ensureDir(modsDir);
      
      const result = await this.downloadModFile(versionId, modsDir);
      
      this.emit('mod-installed', {
        serverPath,
        modPath: result.path,
        modName: result.fileName,
        version: result.version
      });
      
      return result;
    } catch (error) {
      console.error('Failed to install mod to server:', error);
      throw error;
    }
  }

  // Get mod dependencies
  async getModDependencies(versionId) {
    try {
      const version = await this.rateLimitedRequest(`/version/${versionId}`);
      return version.dependencies || [];
    } catch (error) {
      console.error('Failed to get mod dependencies:', error);
      throw error;
    }
  }

  // Check mod compatibility
  async checkModCompatibility(projectId, gameVersion, loader) {
    try {
      const versions = await this.getModVersions(projectId, {
        gameVersion,
        loader
      });
      
      return {
        compatible: versions.length > 0,
        availableVersions: versions,
        latestVersion: versions[0] || null
      };
    } catch (error) {
      console.error('Failed to check mod compatibility:', error);
      throw error;
    }
  }

  // Get featured mods
  async getFeaturedMods(limit = 50) {
    try {
      return await this.rateLimitedRequest(`/search?facets=[["project_type:mod"]]&limit=${limit}&index=featured`);
    } catch (error) {
      console.error('Failed to get featured mods:', error);
      throw error;
    }
  }

  // Get trending mods
  async getTrendingMods(limit = 50) {
    try {
      return await this.rateLimitedRequest(`/search?facets=[["project_type:mod"]]&limit=${limit}&index=updated`);
    } catch (error) {
      console.error('Failed to get trending mods:', error);
      throw error;
    }
  }

  // Get popular mods
  async getPopularMods(limit = 50) {
    try {
      return await this.rateLimitedRequest(`/search?facets=[["project_type:mod"]]&limit=${limit}&index=downloads`);
    } catch (error) {
      console.error('Failed to get popular mods:', error);
      throw error;
    }
  }

  // Search mods by author
  async searchModsByAuthor(authorId) {
    try {
      return await this.rateLimitedRequest(`/user/${authorId}/projects`);
    } catch (error) {
      console.error('Failed to search mods by author:', error);
      throw error;
    }
  }

  // Clear cache
  clearCache() {
    this.modCache.clear();
    this.searchCache.clear();
    this.emit('cache-cleared');
  }

  // Get cache statistics
  getCacheStats() {
    return {
      modCacheSize: this.modCache.size,
      searchCacheSize: this.searchCache.size,
      cacheDir: this.cacheDir
    };
  }
}

module.exports = { ModrinthManager }; 