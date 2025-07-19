const { EventEmitter } = require('events');
const https = require('https');
const http = require('http');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class ExternalHostingManager extends EventEmitter {
  constructor() {
    super();
    this.hostingServices = {
      aternos: {
        name: 'Aternos',
        website: 'https://aternos.org',
        apiEndpoint: 'https://api.aternos.org',
        free: true,
        maxPlayers: 20,
        uptime: 'Limited (auto-sleep)',
        features: ['Vanilla', 'Spigot', 'Paper', 'Forge', 'Fabric'],
        setupRequired: true,
        requiresAccount: true,
        moddedSupport: {
          forge: true,
          fabric: true,
          customMods: false,
          modpacks: ['FTB Skies', 'All the Mods 9', 'Create: Above and Beyond', 'StoneBlock 3'],
          ramLimit: '2GB',
          recommendedFor: 'Light to medium modpacks'
        }
      },
      minehut: {
        name: 'Minehut',
        website: 'https://minehut.com',
        apiEndpoint: 'https://api.minehut.com',
        free: true,
        maxPlayers: 10,
        uptime: 'Limited',
        features: ['Vanilla', 'Spigot', 'Paper'],
        setupRequired: true,
        requiresAccount: true,
        moddedSupport: {
          forge: false,
          fabric: false,
          customMods: false,
          modpacks: [],
          ramLimit: '1GB',
          recommendedFor: 'Vanilla and basic plugins only'
        }
      },
      ploudos: {
        name: 'PloudOS',
        website: 'https://ploudos.com',
        apiEndpoint: 'https://ploudos.com/api',
        free: true,
        maxPlayers: 20,
        uptime: 'Limited',
        features: ['Vanilla', 'Spigot', 'Paper', 'Forge'],
        setupRequired: true,
        requiresAccount: true,
        moddedSupport: {
          forge: true,
          fabric: false,
          customMods: false,
          modpacks: ['FTB Skies', 'All the Mods 8', 'StoneBlock 2', 'SkyFactory 4'],
          ramLimit: '2GB',
          recommendedFor: 'Forge modpacks only'
        }
      },
      serverpro: {
        name: 'Server.pro',
        website: 'https://server.pro',
        apiEndpoint: 'https://api.server.pro',
        free: true,
        maxPlayers: 10,
        uptime: 'Limited',
        features: ['Vanilla', 'Spigot', 'Paper'],
        setupRequired: true,
        requiresAccount: true,
        moddedSupport: {
          forge: false,
          fabric: false,
          customMods: false,
          modpacks: [],
          ramLimit: '1GB',
          recommendedFor: 'Vanilla and basic plugins only'
        }
      }
    };
    
    this.configDir = path.join(os.homedir(), '.multimc-hub', 'external-hosting');
    this.configFile = path.join(this.configDir, 'config.json');
    this.ensureDirectories();
  }

  ensureDirectories() {
    fs.ensureDirSync(this.configDir);
  }

  async initialize() {
    try {
      await this.loadConfiguration();
      console.log('ExternalHostingManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ExternalHostingManager:', error);
      throw error;
    }
  }

  async loadConfiguration() {
    try {
      if (await fs.pathExists(this.configFile)) {
        this.config = await fs.readJson(this.configFile);
      } else {
        this.config = {
          services: {},
          lastUpdated: new Date().toISOString()
        };
        await this.saveConfiguration();
      }
    } catch (error) {
      console.error('Failed to load external hosting configuration:', error);
      this.config = { services: {}, lastUpdated: new Date().toISOString() };
    }
  }

  async saveConfiguration() {
    try {
      this.config.lastUpdated = new Date().toISOString();
      await fs.writeJson(this.configFile, this.config, { spaces: 2 });
    } catch (error) {
      console.error('Failed to save external hosting configuration:', error);
    }
  }

  getAvailableServices() {
    return Object.keys(this.hostingServices).map(key => ({
      id: key,
      ...this.hostingServices[key]
    }));
  }

  getServiceInfo(serviceId) {
    return this.hostingServices[serviceId] || null;
  }

  async checkServiceStatus(serviceId) {
    const service = this.hostingServices[serviceId];
    if (!service) {
      throw new Error(`Unknown service: ${serviceId}`);
    }

    try {
      // Check if service website is accessible
      const isOnline = await this.checkWebsiteAccessibility(service.website);
      return {
        serviceId,
        name: service.name,
        online: isOnline,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Failed to check status for ${serviceId}:`, error);
      return {
        serviceId,
        name: service.name,
        online: false,
        error: error.message,
        lastChecked: new Date().toISOString()
      };
    }
  }

  async checkWebsiteAccessibility(url) {
    return new Promise((resolve) => {
      const protocol = url.startsWith('https:') ? https : http;
      const req = protocol.get(url, { timeout: 5000 }, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });
      
      req.on('error', () => {
        resolve(false);
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  async setupServiceAccount(serviceId, credentials) {
    const service = this.hostingServices[serviceId];
    if (!service) {
      throw new Error(`Unknown service: ${serviceId}`);
    }

    if (!service.requiresAccount) {
      throw new Error(`${service.name} does not require account setup`);
    }

    // Store credentials securely (in a real implementation, you'd encrypt these)
    this.config.services[serviceId] = {
      configured: true,
      configuredAt: new Date().toISOString(),
      credentials: {
        username: credentials.username,
        // In a real app, you'd encrypt the password
        hasPassword: !!credentials.password
      }
    };

    await this.saveConfiguration();
    
    this.emit('service-configured', { serviceId, service: service.name });
    
    return {
      success: true,
      message: `${service.name} account configured successfully`,
      nextSteps: this.getSetupInstructions(serviceId)
    };
  }

  getSetupInstructions(serviceId) {
    const instructions = {
      aternos: [
        '1. Go to https://aternos.org and create a free account',
        '2. Create a new server with your preferred Minecraft version',
        '3. Configure server settings (gamemode, difficulty, etc.)',
        '4. Start your server and get the connection details',
        '5. Share the server address with your friends'
      ],
      minehut: [
        '1. Go to https://minehut.com and sign up for a free account',
        '2. Create a new server from the dashboard',
        '3. Choose your server type and version',
        '4. Configure basic settings and start the server',
        '5. Use the provided server address to connect'
      ],
      ploudos: [
        '1. Visit https://ploudos.com and register for a free account',
        '2. Create a new server instance',
        '3. Select your preferred Minecraft version and type',
        '4. Configure server properties and start',
        '5. Share the server IP with your players'
      ],
      serverpro: [
        '1. Go to https://server.pro and create a free account',
        '2. Create a new server from your dashboard',
        '3. Choose server type and Minecraft version',
        '4. Configure settings and launch your server',
        '5. Use the provided connection details'
      ]
    };

    return instructions[serviceId] || ['Please visit the service website for setup instructions'];
  }

  async getServerStatus(serviceId) {
    const service = this.hostingServices[serviceId];
    if (!service) {
      throw new Error(`Unknown service: ${serviceId}`);
    }

    // This would integrate with the actual service APIs
    // For now, return a mock status
    return {
      serviceId,
      name: service.name,
      status: 'unknown',
      players: 0,
      maxPlayers: service.maxPlayers,
      uptime: 'unknown',
      lastUpdated: new Date().toISOString()
    };
  }

  async createServerOnService(serviceId, serverConfig) {
    const service = this.hostingServices[serviceId];
    if (!service) {
      throw new Error(`Unknown service: ${serviceId}`);
    }

    // Validate server configuration
    if (!this.validateServerConfig(serverConfig, service)) {
      throw new Error(`Server configuration not compatible with ${service.name}`);
    }

    // In a real implementation, this would make API calls to the hosting service
    // For now, return a mock response
    const mockServerInfo = {
      serviceId,
      serviceName: service.name,
      serverId: `mock-${Date.now()}`,
      address: `mock-${serviceId}.example.com`,
      port: 25565,
      status: 'creating',
      estimatedTime: '2-5 minutes'
    };

    this.emit('server-creating', mockServerInfo);
    
    return mockServerInfo;
  }

  validateServerConfig(serverConfig, service) {
    // Check if the server type is supported by the service
    if (!service.features.includes(serverConfig.type) && 
        !service.features.includes('Vanilla')) {
      return false;
    }

    // Check player limit
    if (serverConfig.maxPlayers > service.maxPlayers) {
      return false;
    }

    return true;
  }

  async getRecommendedService(serverConfig) {
    const compatibleServices = Object.entries(this.hostingServices)
      .filter(([id, service]) => this.validateServerConfig(serverConfig, service))
      .map(([id, service]) => ({
        id,
        ...service,
        score: this.calculateServiceScore(service, serverConfig)
      }))
      .sort((a, b) => b.score - a.score);

    return compatibleServices[0] || null;
  }

  calculateServiceScore(service, serverConfig) {
    let score = 0;
    
    // Higher score for higher player limits
    score += service.maxPlayers;
    
    // Bonus for better uptime
    if (service.uptime.includes('Limited')) {
      score += 5;
    }
    
    // Bonus for more features
    score += service.features.length * 2;
    
    return score;
  }

  async generateSetupGuide(serviceId, serverConfig) {
    const service = this.hostingServices[serviceId];
    if (!service) {
      throw new Error(`Unknown service: ${serviceId}`);
    }

    const guide = {
      service: service.name,
      website: service.website,
      steps: this.getSetupInstructions(serviceId),
      requirements: {
        account: service.requiresAccount,
        maxPlayers: service.maxPlayers,
        supportedTypes: service.features,
        uptime: service.uptime
      },
      tips: [
        'Free services often have limited uptime and may put servers to sleep when inactive',
        'Server startup may take several minutes after being inactive',
        'Consider upgrading to paid plans for better performance and uptime',
        'Keep your server active by having players join regularly'
      ]
    };

    return guide;
  }

  async cleanup() {
    // Clean up any resources
    console.log('ExternalHostingManager cleanup completed');
  }

  getStatus() {
    return {
      services: Object.keys(this.hostingServices).length,
      configured: Object.keys(this.config.services).length,
      lastUpdated: this.config.lastUpdated
    };
  }

  // Enhanced modded server support methods
  getModdedServerRecommendations(serverConfig) {
    const recommendations = [];
    
    Object.entries(this.hostingServices).forEach(([id, service]) => {
      if (!service.moddedSupport) return;
      
      const compatibility = this.checkModdedCompatibility(serverConfig, service);
      if (compatibility.compatible) {
        recommendations.push({
          serviceId: id,
          service: service.name,
          compatibility: compatibility,
          moddedSupport: service.moddedSupport,
          score: this.calculateModdedServiceScore(service, serverConfig)
        });
      }
    });
    
    return recommendations.sort((a, b) => b.score - a.score);
  }

  checkModdedCompatibility(serverConfig, service) {
    const moddedSupport = service.moddedSupport;
    if (!moddedSupport) {
      return { compatible: false, reason: 'No modded support' };
    }

    // Check server type compatibility
    if (serverConfig.type === 'forge' && !moddedSupport.forge) {
      return { compatible: false, reason: 'Forge not supported' };
    }
    
    if (serverConfig.type === 'fabric' && !moddedSupport.fabric) {
      return { compatible: false, reason: 'Fabric not supported' };
    }

    // Check player count
    if (serverConfig.maxPlayers > service.maxPlayers) {
      return { compatible: false, reason: `Player limit exceeded (max: ${service.maxPlayers})` };
    }

    return { 
      compatible: true, 
      reason: 'Compatible',
      ramLimit: moddedSupport.ramLimit,
      recommendedFor: moddedSupport.recommendedFor
    };
  }

  calculateModdedServiceScore(service, serverConfig) {
    let score = 0;
    const moddedSupport = service.moddedSupport;
    
    // Base score from player limit
    score += service.maxPlayers;
    
    // Bonus for modded support
    if (moddedSupport.forge) score += 10;
    if (moddedSupport.fabric) score += 10;
    
    // Bonus for more RAM
    const ramGB = parseInt(moddedSupport.ramLimit);
    score += ramGB * 5;
    
    // Bonus for available modpacks
    score += moddedSupport.modpacks.length * 2;
    
    // Penalty for limited uptime
    if (service.uptime.includes('Limited')) {
      score -= 5;
    }
    
    return score;
  }

  getAvailableModpacks(serviceId) {
    const service = this.hostingServices[serviceId];
    if (!service || !service.moddedSupport) {
      return [];
    }
    
    return service.moddedSupport.modpacks.map(pack => ({
      name: pack,
      service: service.name,
      ramLimit: service.moddedSupport.ramLimit,
      type: service.moddedSupport.forge ? 'Forge' : 'Fabric'
    }));
  }

  generateModdedSetupGuide(serviceId, serverConfig) {
    const service = this.hostingServices[serviceId];
    if (!service || !service.moddedSupport) {
      throw new Error(`Service ${serviceId} does not support modded servers`);
    }

    const moddedSupport = service.moddedSupport;
    const baseGuide = this.generateSetupGuide(serviceId, serverConfig);
    
    // Add modded-specific instructions
    const moddedInstructions = [
      `This service supports ${moddedSupport.forge ? 'Forge' : ''}${moddedSupport.forge && moddedSupport.fabric ? ' and ' : ''}${moddedSupport.fabric ? 'Fabric' : ''} servers`,
      `RAM Limit: ${moddedSupport.ramLimit}`,
      `Recommended for: ${moddedSupport.recommendedFor}`,
      '',
      'Available Modpacks:',
      ...moddedSupport.modpacks.map(pack => `- ${pack}`),
      '',
      'Important Notes:',
      '- You cannot upload custom mods',
      '- Only pre-approved modpacks are available',
      '- Server performance may be limited due to RAM constraints',
      '- Consider using lighter modpacks for better performance'
    ];

    return {
      ...baseGuide,
      steps: [...baseGuide.steps, ...moddedInstructions],
      moddedInfo: {
        supportedTypes: {
          forge: moddedSupport.forge,
          fabric: moddedSupport.fabric
        },
        ramLimit: moddedSupport.ramLimit,
        availableModpacks: moddedSupport.modpacks,
        customModsSupported: moddedSupport.customMods
      }
    };
  }
}

module.exports = { ExternalHostingManager }; 