const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const archiver = require('archiver');
const extract = require('extract-zip');
const crypto = require('crypto');
const { LoaderManager } = require('../utils/LoaderManager');

class ServerManager extends EventEmitter {
  constructor(networkManager) {
    super();
    this.networkManager = networkManager;
    this.activeServers = new Map();
    this.baseDir = path.join(os.homedir(), '.multimc-hub');
    this.serversDir = path.join(this.baseDir, 'servers');
    this.configDir = path.join(this.baseDir, 'config');
    this.serversConfigFile = path.join(this.configDir, 'servers.json');
    this.loaderManager = new LoaderManager();
    this.ensureDirectories();
  }

  ensureDirectories() {
    fs.ensureDirSync(this.baseDir);
    fs.ensureDirSync(this.serversDir);
    fs.ensureDirSync(this.configDir);
  }

  async initialize() {
    try {
      // Load saved server configurations
      await this.loadServerConfigurations();
      
      // Restore servers that were running before
      await this.restoreServers();
      
      console.log('ServerManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ServerManager:', error);
      throw error;
    }
  }

  async loadServerConfigurations() {
    try {
      if (await fs.pathExists(this.serversConfigFile)) {
        const configData = await fs.readJson(this.serversConfigFile);
        this.serverConfigurations = configData.servers || [];
        console.log(`Loaded ${this.serverConfigurations.length} server configurations`);
      } else {
        this.serverConfigurations = [];
        await this.saveServerConfigurations();
      }
    } catch (error) {
      console.error('Failed to load server configurations:', error);
      this.serverConfigurations = [];
    }
  }

  async saveServerConfigurations() {
    try {
      const configData = {
        servers: this.serverConfigurations,
        lastUpdated: new Date().toISOString()
      };
      await fs.writeJson(this.serversConfigFile, configData, { spaces: 2 });
    } catch (error) {
      console.error('Failed to save server configurations:', error);
    }
  }

  async restoreServers() {
    const serversToRestore = this.serverConfigurations.filter(config => config.autoStart);
    
    for (const config of serversToRestore) {
      try {
        console.log(`Restoring server: ${config.name}`);
        await this.startServer(config, true); // true = isRestore
      } catch (error) {
        console.error(`Failed to restore server ${config.name}:`, error);
      }
    }
  }

  async startServer(config, isRestore = false) {
    try {
      console.log('ServerManager.startServer called with config:', config);
      
      const serverId = crypto.randomUUID();
      const serverDir = path.join(this.serversDir, serverId);
      
      console.log('Creating server directory:', serverDir);
      // Create server directory
      await fs.ensureDir(serverDir);
      
      // Get loader info
      const loaderInfo = this.loaderManager.getLoaderInfo(config.type);
      if (!loaderInfo) {
        throw new Error(`Unsupported server type: ${config.type}`);
      }
      
      // Create mods directory for modded servers
      if (loaderInfo.supportsMods) {
        await fs.ensureDir(path.join(serverDir, 'mods'));
        console.log(`Created mods directory for ${loaderInfo.name} server`);
      }
      
      // Validate required files are installed before proceeding
      await this.validateRequiredFiles(config);
      
      // Determine server jar path based on loader
      let serverJarPath;
      if (config.type === 'vanilla') {
        serverJarPath = path.join(os.homedir(), '.multimc-hub', 'minecraft', `server-${config.version}.jar`);
      } else if (config.type === 'fabric') {
        // Fabric servers are in directories with the server JAR inside
        const fabricDir = path.join(os.homedir(), '.multimc-hub', 'loaders', config.type, `fabric-${config.version}`);
        const [minecraftVersion] = config.version.split('-');
        serverJarPath = path.join(fabricDir, `server-${minecraftVersion}.jar`);
      } else {
        serverJarPath = path.join(os.homedir(), '.multimc-hub', 'loaders', config.type, `${config.type}-${config.version}.jar`);
      }
      
      console.log('Looking for server jar at:', serverJarPath);
      
      // Check if server jar exists
      if (!await fs.pathExists(serverJarPath)) {
        console.log(`Server jar not found: ${serverJarPath}. Attempting to download...`);
        
        try {
          // Try to download the server jar using LoaderManager
          const { SystemChecker } = require('../utils/SystemChecker');
          const systemChecker = new SystemChecker();
          
          if (config.type === 'vanilla') {
            await systemChecker.downloadMinecraft(config.version);
          } else {
            await systemChecker.loaderManager.downloadLoader(config.type, config.version);
          }
          
          // Check again after download
          if (!await fs.pathExists(serverJarPath)) {
            throw new Error(`Failed to download server jar for ${config.type} ${config.version}`);
          }
          
          console.log(`Successfully downloaded server jar for ${config.type} ${config.version}`);
        } catch (downloadError) {
          const errorMsg = `Server jar not found and download failed: ${serverJarPath}. Please download the ${config.type} server version ${config.version} manually. Error: ${downloadError.message}`;
          console.error(errorMsg);
          throw new Error(errorMsg);
        }
      }
      
      // Copy server files to server directory
      if (config.type === 'fabric') {
        // For Fabric, copy the entire directory structure
        const fabricDir = path.join(os.homedir(), '.multimc-hub', 'loaders', config.type, `fabric-${config.version}`);
        await fs.copy(fabricDir, serverDir);
        console.log(`Copied Fabric server files from ${fabricDir} to ${serverDir}`);
      } else {
        // For other loaders, copy just the server JAR
        const localJarPath = path.join(serverDir, 'server.jar');
        await fs.copy(serverJarPath, localJarPath);
      }
      
      // Create server properties
      const serverProperties = this.createServerProperties(config);
      await fs.writeFile(path.join(serverDir, 'server.properties'), serverProperties);
      
      // Create eula.txt
      await fs.writeFile(path.join(serverDir, 'eula.txt'), 'eula=true\n');
      
      // Setup loader-specific configuration
      if (config.type !== 'vanilla') {
        await this.setupLoaderServer(serverDir, config, loaderInfo);
      }
      
      // Start the server process
      const javaPath = await this.getJavaPath();
      let jarFile = 'server.jar';
      
      // For Fabric servers, use the fabric-server-launch.jar
      if (config.type === 'fabric') {
        jarFile = 'fabric-server-launch.jar';
      }
      
      const serverProcess = spawn(javaPath, [
        '-Xmx2G',
        '-Xms1G',
        '-jar', jarFile,
        'nogui'
      ], {
        cwd: serverDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // Create server info
      const serverInfo = {
        id: serverId,
        name: config.name,
        type: config.type,
        version: config.version,
        port: config.port,
        maxPlayers: config.maxPlayers,
        status: 'starting',
        hostId: this.networkManager.getLocalPeerId(),
        hostAddress: this.networkManager.getLocalAddress(),
        process: serverProcess,
        directory: serverDir,
        startTime: new Date().toISOString(),
        autoStart: config.autoStart || false,
        mods: config.mods || []
      };
      
      // Add to active servers
      this.activeServers.set(serverId, serverInfo);
      
      // Save server configuration
      await this.saveServerConfiguration(serverInfo);
      
      // Set up process event handlers
      serverProcess.on('error', (error) => {
        console.error(`Server ${serverId} error:`, error);
        this.updateServerStatus(serverId, 'error');
      });
      
      serverProcess.on('exit', (code) => {
        console.log(`Server ${serverId} exited with code ${code}`);
        this.updateServerStatus(serverId, 'stopped');
        this.activeServers.delete(serverId);
        this.emit('server-update', { serverId, status: 'stopped' });
      });
      
      // Monitor server startup
      let startupTimeout = setTimeout(() => {
        this.updateServerStatus(serverId, 'running');
        this.emit('server-update', { serverId, status: 'running' });
      }, 10000);
      
      // Monitor server output for startup completion
      serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`Server ${serverId} output:`, output);
        
        // Check for server startup completion
        if (output.includes('Done') || output.includes('For help, type "help"')) {
          clearTimeout(startupTimeout);
          this.updateServerStatus(serverId, 'running');
          this.emit('server-update', { serverId, status: 'running' });
        }
      });
      
      serverProcess.stderr.on('data', (data) => {
        const error = data.toString();
        console.error(`Server ${serverId} error output:`, error);
      });
      
      return serverInfo;
    } catch (error) {
      console.error('Failed to start server:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        config: config
      });
      throw error;
    }
  }

  async setupForgeServer(serverDir, config) {
    try {
      console.log('Setting up Forge server configuration...');
      
      // Create logs directory
      await fs.ensureDir(path.join(serverDir, 'logs'));
      
      // Create config directory for mod configurations
      await fs.ensureDir(path.join(serverDir, 'config'));
      
      // Create default forge-server.toml if it doesn't exist
      const forgeServerConfigPath = path.join(serverDir, 'forge-server.toml');
      if (!await fs.pathExists(forgeServerConfigPath)) {
        const forgeServerConfig = `# Forge Server Configuration
# Generated by MultiMC Hub

[server]
# Server configuration
port = ${config.port}
max_players = ${config.maxPlayers}
motd = "A MultiMC Hub Forge Server"
online_mode = false
pvp = true
difficulty = "normal"
gamemode = "survival"
spawn_protection = 16
view_distance = 10
simulation_distance = 10

[forge]
# Forge-specific configuration
sync_entity_data = true
remove_erroring_entities = false
remove_erroring_tile_entities = false
`;
        await fs.writeFile(forgeServerConfigPath, forgeServerConfig);
      }
      
      // Create default serverconfig.toml for mod configurations
      const serverConfigPath = path.join(serverDir, 'serverconfig.toml');
      if (!await fs.pathExists(serverConfigPath)) {
        const serverConfig = `# Server Configuration for Mods
# Generated by MultiMC Hub

# This file contains configurations for mods that support server-side configuration
# Mods will automatically add their configurations here when the server starts

`;
        await fs.writeFile(serverConfigPath, serverConfig);
      }
      
      console.log('Forge server configuration setup complete');
    } catch (error) {
      console.error('Failed to setup Forge server configuration:', error);
      // Don't throw error, as this is not critical for server startup
    }
  }

  async setupLoaderServer(serverDir, config, loaderInfo) {
    try {
      console.log(`Setting up ${loaderInfo.name} server configuration...`);
      
      // Create logs directory
      await fs.ensureDir(path.join(serverDir, 'logs'));
      
      // Create config directory for mod configurations
      await fs.ensureDir(path.join(serverDir, 'config'));
      
      // Create default loader-specific config if it doesn't exist
      const loaderConfigPath = path.join(serverDir, `${loaderInfo.name}-server.toml`);
      if (!await fs.pathExists(loaderConfigPath)) {
        const loaderConfig = `# ${loaderInfo.name} Server Configuration
# Generated by MultiMC Hub

[server]
# Server configuration
port = ${config.port}
max_players = ${config.maxPlayers}
motd = "A MultiMC Hub ${loaderInfo.name} Server"
online_mode = false
pvp = true
difficulty = "normal"
gamemode = "survival"
spawn_protection = 16
view_distance = 10
simulation_distance = 10

[${loaderInfo.name}]
# ${loaderInfo.name}-specific configuration
`;
        await fs.writeFile(loaderConfigPath, loaderConfig);
      }
      
      // Create default serverconfig.toml for mod configurations
      const serverConfigPath = path.join(serverDir, 'serverconfig.toml');
      if (!await fs.pathExists(serverConfigPath)) {
        const serverConfig = `# Server Configuration for Mods
# Generated by MultiMC Hub

# This file contains configurations for mods that support server-side configuration
# Mods will automatically add their configurations here when the server starts

`;
        await fs.writeFile(serverConfigPath, serverConfig);
      }
      
      console.log(`${loaderInfo.name} server configuration setup complete`);
    } catch (error) {
      console.error(`Failed to setup ${loaderInfo.name} server configuration:`, error);
      // Don't throw error, as this is not critical for server startup
    }
  }

  async stopServer(serverId) {
    const server = this.activeServers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }
    
    try {
      // Send stop command to server
      if (server.process && !server.process.killed) {
        server.process.stdin.write('stop\n');
        
        // Wait for graceful shutdown
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            server.process.kill('SIGTERM');
            resolve();
          }, 10000);
          
          server.process.on('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }
      
      this.updateServerStatus(serverId, 'stopped');
      this.activeServers.delete(serverId);
      
      // Broadcast server stopped
      try {
        await this.networkManager.broadcast('server-stopped', { serverId, name: server.name });
      } catch (error) {
        console.error('Failed to broadcast server stopped:', error);
        // Don't throw here, server is still stopped successfully
      }
      
      console.log(`Server ${server.name} stopped`);
    } catch (error) {
      console.error('Failed to stop server:', error);
      throw error;
    }
  }

  async saveServerConfiguration(serverInfo) {
    try {
      // Find existing configuration or create new one
      let existingConfig = this.serverConfigurations.find(config => config.id === serverInfo.id);
      
      if (existingConfig) {
        // Update existing configuration
        Object.assign(existingConfig, {
          name: serverInfo.name,
          type: serverInfo.type,
          version: serverInfo.version,
          port: serverInfo.port,
          maxPlayers: serverInfo.maxPlayers,
          autoStart: serverInfo.autoStart,
          lastModified: new Date().toISOString()
        });
      } else {
        // Create new configuration
        const newConfig = {
          id: serverInfo.id,
          name: serverInfo.name,
          type: serverInfo.type,
          version: serverInfo.version,
          port: serverInfo.port,
          maxPlayers: serverInfo.maxPlayers,
          autoStart: serverInfo.autoStart,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString()
        };
        this.serverConfigurations.push(newConfig);
      }
      
      await this.saveServerConfigurations();
    } catch (error) {
      console.error('Failed to save server configuration:', error);
    }
  }

  async updateServerConfiguration(serverId, updates) {
    try {
      const config = this.serverConfigurations.find(c => c.id === serverId);
      if (config) {
        Object.assign(config, updates, { lastModified: new Date().toISOString() });
        await this.saveServerConfigurations();
      }
    } catch (error) {
      console.error('Failed to update server configuration:', error);
    }
  }

  async deleteServerConfiguration(serverId) {
    try {
      this.serverConfigurations = this.serverConfigurations.filter(config => config.id !== serverId);
      await this.saveServerConfigurations();
      
      // Also delete server directory
      const serverDir = path.join(this.serversDir, serverId);
      if (await fs.pathExists(serverDir)) {
        await fs.remove(serverDir);
      }
    } catch (error) {
      console.error('Failed to delete server configuration:', error);
    }
  }

  updateServerStatus(serverId, status) {
    const server = this.activeServers.get(serverId);
    if (server) {
      server.status = status;
      this.emit('server-update', { serverId, status });
    }
  }

  createServerProperties(config) {
    return `#Minecraft server properties
#Generated by MultiMC Hub
server-port=${config.port}
max-players=${config.maxPlayers}
gamemode=survival
difficulty=normal
spawn-protection=16
view-distance=10
simulation-distance=10
motd=A MultiMC Hub Server
pvp=true
spawn-npcs=true
spawn-animals=true
spawn-monsters=true
generate-structures=true
online-mode=false
allow-flight=false
initial-disabled-packs=
enforce-secure-profile=true
enable-status=true
hide-online-players=false
enable-command-block=false
max-world-size=29999984
function-permission-level=2
initial-enabled-packs=vanilla
network-compression-threshold=256
max-tick-time=60000
require-resource-pack=false
use-native-transport=true
enable-jmx-monitoring=false
enable-query=false
query.port=${config.port}
enable-rcon=false
rcon.port=25575
rcon.password=
rcon.port=25575
rcon.password=
max-chained-neighbor-updates=1000000
`;
  }

  async validateRequiredFiles(config) {
    console.log(`Validating required files for ${config.type} server version ${config.version}...`);
    
    const fs = require('fs-extra');
    const path = require('path');
    const os = require('os');
    
    // Get the Minecraft version from the loader version
    let minecraftVersion;
    if (config.type === 'vanilla') {
      minecraftVersion = config.version;
    } else {
      // For modded servers, extract Minecraft version from loader version
      minecraftVersion = config.version.split('-')[0];
    }
    
    // Check if Minecraft server JAR is available (this is what we actually need)
    const minecraftServerJarPath = path.join(os.homedir(), '.multimc-hub', 'minecraft', `server-${minecraftVersion}.jar`);
    
    console.log(`Checking Minecraft server JAR for version ${minecraftVersion} at: ${minecraftServerJarPath}`);
    
    if (!await fs.pathExists(minecraftServerJarPath)) {
      throw new Error(`Minecraft server JAR for version ${minecraftVersion} is not installed. Please download it first.`);
    }
    
    console.log(`✅ Minecraft server JAR for version ${minecraftVersion} is properly installed`);
    
    // Check if loader is installed (for modded servers)
    if (config.type !== 'vanilla') {
      const loaderPath = path.join(os.homedir(), '.multimc-hub', 'loaders', config.type, `${config.type}-${config.version}`);
      
      console.log(`Checking ${config.type} loader at: ${loaderPath}`);
      
      if (!await fs.pathExists(loaderPath)) {
        throw new Error(`${config.type} loader version ${config.version} is not installed. Please download it first.`);
      }
      
      // For Fabric, check for the specific server files
      if (config.type === 'fabric') {
        const fabricServerJar = path.join(loaderPath, `server-${minecraftVersion}.jar`);
        const fabricLaunchJar = path.join(loaderPath, 'fabric-server-launch.jar');
        
        console.log(`Checking Fabric server JAR at: ${fabricServerJar}`);
        console.log(`Checking Fabric launch JAR at: ${fabricLaunchJar}`);
        
        if (!await fs.pathExists(fabricServerJar)) {
          throw new Error(`Fabric server JAR for ${config.version} is missing. Please download it first.`);
        }
        
        if (!await fs.pathExists(fabricLaunchJar)) {
          throw new Error(`Fabric server launch JAR for ${config.version} is missing. Please download it first.`);
        }
        
        console.log(`✅ Fabric loader ${config.version} is properly installed`);
      } else {
        // For other loaders, check for the main JAR file
        const loaderJarPath = path.join(loaderPath, `${config.type}-${config.version}.jar`);
        if (!await fs.pathExists(loaderJarPath)) {
          throw new Error(`${config.type} loader JAR for ${config.version} is missing. Please download it first.`);
        }
        
        console.log(`✅ ${config.type} loader ${config.version} is properly installed`);
      }
    }
    
    console.log(`✅ All required files for ${config.type} server version ${config.version} are installed`);
  }

  async getJavaPath() {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      // Try to find Java in PATH
      const { stdout } = await execAsync('which java');
      const javaPath = stdout.trim();
      
      // Verify the Java path is valid
      if (await fs.pathExists(javaPath)) {
        return javaPath;
      }
    } catch (error) {
      console.log('Java not found in PATH, checking common locations...');
    }
    
    // Fallback to common Java paths
    const commonPaths = [
      '/usr/bin/java',
      '/usr/local/bin/java',
      '/Library/Java/JavaVirtualMachines/jdk-8.jdk/Contents/Home/bin/java',
      '/Library/Java/JavaVirtualMachines/jdk-11.jdk/Contents/Home/bin/java',
      '/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home/bin/java',
      '/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home/bin/java',
      'C:\\Program Files\\Java\\jdk-8\\bin\\java.exe',
      'C:\\Program Files\\Java\\jre-8\\bin\\java.exe',
      'C:\\Program Files\\Java\\jdk-11\\bin\\java.exe',
      'C:\\Program Files\\Java\\jdk-17\\bin\\java.exe'
    ];
    
    for (const javaPath of commonPaths) {
      if (await fs.pathExists(javaPath)) {
        console.log(`Found Java at: ${javaPath}`);
        return javaPath;
      }
    }
    
    throw new Error('Java not found. Please install Java 8 or higher.');
  }

  async transferHost(serverId, newHostId) {
    const server = this.activeServers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }
    
    try {
      // Compress server files
      const serverArchive = await this.compressServerFiles(serverId);
      
      // Send transfer request to new host
      await this.networkManager.sendToPeer(newHostId, 'host-transfer', {
        serverId,
        serverInfo: server,
        archivePath: serverArchive
      });
      
      console.log(`Host transfer initiated for server ${server.name}`);
    } catch (error) {
      console.error('Failed to transfer host:', error);
      throw error;
    }
  }

  async takeOverHost(serverId) {
    try {
      // Send takeover request to current host
      const server = this.activeServers.get(serverId);
      if (server) {
        await this.networkManager.sendToPeer(server.hostId, 'host-takeover-request', {
          serverId,
          requesterId: this.networkManager.getLocalPeerId()
        });
      }
      
      console.log(`Host takeover request sent for server ${serverId}`);
    } catch (error) {
      console.error('Failed to take over host:', error);
      throw error;
    }
  }

  async compressServerFiles(serverId) {
    const server = this.activeServers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }
    
    const archivePath = path.join(this.baseDir, `server-${serverId}.zip`);
    const output = fs.createWriteStream(archivePath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    return new Promise((resolve, reject) => {
      output.on('close', () => resolve(archivePath));
      archive.on('error', reject);
      
      archive.pipe(output);
      archive.directory(server.directory, false);
      archive.finalize();
    });
  }

  async extractServerFiles(archivePath, serverId) {
    const serverDir = path.join(this.serversDir, serverId);
    await fs.ensureDir(serverDir);
    await extract(archivePath, { dir: serverDir });
  }

  getStatus() {
    return {
      activeServers: Array.from(this.activeServers.values()).map(server => ({
        id: server.id,
        name: server.name,
        type: server.type,
        version: server.version,
        port: server.port,
        maxPlayers: server.maxPlayers,
        status: server.status,
        hostId: server.hostId,
        hostAddress: server.hostAddress,
        startTime: server.startTime,
        autoStart: server.autoStart
      })),
      totalServers: this.activeServers.size,
      savedConfigurations: this.serverConfigurations.length
    };
  }

  async cleanup() {
    console.log('Cleaning up ServerManager...');
    
    // Stop all active servers
    const cleanupPromises = [];
    for (const [serverId, server] of this.activeServers) {
      cleanupPromises.push(
        this.stopServer(serverId).catch(error => {
          console.error(`Failed to stop server ${serverId}:`, error);
        })
      );
    }
    
    // Wait for all cleanup operations to complete
    await Promise.allSettled(cleanupPromises);
    
    // Save final configurations
    try {
      await this.saveServerConfigurations();
    } catch (error) {
      console.error('Failed to save server configurations during cleanup:', error);
    }
    
    console.log('ServerManager cleanup completed');
  }
}

module.exports = { ServerManager }; 