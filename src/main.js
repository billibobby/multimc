const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { ServerManager } = require('./server/ServerManager');
const { NetworkManager } = require('./network/NetworkManager');
const { ExternalHostingManager } = require('./server/ExternalHostingManager');
const { ModrinthManager } = require('./utils/ModrinthManager');
const { CloudSyncManager } = require('./utils/CloudSyncManager');
const { SystemChecker } = require('./utils/SystemChecker');
const { logger } = require('./utils/Logger');
const fs = require('fs/promises'); // Added for file system operations

let mainWindow;
let serverManager;
let networkManager;
let externalHostingManager;
let modrinthManager;
let cloudSyncManager;
let systemChecker;

// Auto-updater configuration
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  logger.info('Creating main window');
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    titleBarStyle: 'default',
    show: false
  });
  
  // Set global reference for progress updates
  global.mainWindow = mainWindow;

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    logger.info('Main window ready to show');
    mainWindow.show();
    initializeManagers();
    
    // Check for updates after a short delay
    setTimeout(() => {
      checkForUpdates();
    }, 3000);
  });

  mainWindow.on('closed', () => {
    logger.info('Main window closed');
    mainWindow = null;
  });

  mainWindow.on('error', (error) => {
    logger.error('Main window error:', error);
  });
}

// Auto-updater functions
function checkForUpdates() {
  logger.info('Checking for updates...');
  // Only check for updates if the app is packaged (not in development)
  if (app.isPackaged) {
    autoUpdater.checkForUpdates();
  } else {
    logger.info('Skip checkForUpdates because application is not packed and dev update config is not forced');
  }
}

function setupAutoUpdater() {
  // Only setup auto-updater if the app is packaged
  if (!app.isPackaged) {
    logger.info('Auto-updater disabled in development mode');
    return;
  }
  
  autoUpdater.on('checking-for-update', () => {
    logger.info('Checking for update...');
    mainWindow.webContents.send('update-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    logger.info('Update available:', info);
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: 'A new version of MultiMC Hub is available!',
      detail: `Version ${info.version} is ready to download.`,
      buttons: ['Download Now', 'Later'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
        mainWindow.webContents.send('update-status', { 
          status: 'downloading',
          version: info.version 
        });
      }
    });
  });

  autoUpdater.on('update-not-available', () => {
    logger.info('Update not available');
    mainWindow.webContents.send('update-status', { status: 'up-to-date' });
  });

  autoUpdater.on('error', (err) => {
    logger.error('Auto-updater error:', err);
    mainWindow.webContents.send('update-status', { 
      status: 'error',
      error: err.message 
    });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    logger.info('Download progress:', progressObj);
    mainWindow.webContents.send('update-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    logger.info('Update downloaded:', info);
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded successfully!',
      detail: 'The application will restart to install the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });
}

async function initializeManagers() {
  try {
    logger.startup();
    
    // Initialize system checker
    logger.system('Initializing SystemChecker');
    systemChecker = new SystemChecker();
    const systemStatus = await systemChecker.checkSystem();
    logger.system('System check completed', { status: systemStatus.status });
    
    // Initialize network manager
    logger.network('Initializing NetworkManager');
    networkManager = new NetworkManager();
    await networkManager.initialize();
    logger.network('NetworkManager initialized successfully');
    
    // Create default profile if none exists
    let profile = await networkManager.getCurrentProfile();
    if (!profile) {
      logger.profile('Creating default profile');
      profile = await networkManager.createDefaultProfile();
      logger.profile('Default profile created', { id: profile.id, name: profile.name });
    } else {
      logger.profile('Using existing profile', { id: profile.id, name: profile.name });
    }
    
    // Initialize server manager
    logger.server('Initializing ServerManager');
    serverManager = new ServerManager(networkManager);
    await serverManager.initialize();
    logger.server('ServerManager initialized successfully');
    
    // Initialize external hosting manager
    logger.server('Initializing ExternalHostingManager');
    externalHostingManager = new ExternalHostingManager();
    await externalHostingManager.initialize();
    logger.server('ExternalHostingManager initialized successfully');
    
    // Initialize Modrinth manager
    logger.system('Initializing ModrinthManager');
    modrinthManager = new ModrinthManager();
    logger.system('ModrinthManager initialized successfully');
    
    // Initialize Cloud Sync manager
    logger.system('Initializing CloudSyncManager');
    cloudSyncManager = new CloudSyncManager(networkManager);
    logger.system('CloudSyncManager initialized successfully');
    
    // Set up event listeners to forward server events to renderer
    serverManager.on('server-update', (data) => {
      logger.debug('Forwarding server-update to renderer', data);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server-update', data);
      }
    });
    
    // Set up event listeners for external hosting
    externalHostingManager.on('service-configured', (data) => {
      logger.debug('External hosting service configured', data);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('external-hosting-service-configured', data);
      }
    });
    
    externalHostingManager.on('server-creating', (data) => {
      logger.debug('External server creating', data);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('external-server-creating', data);
      }
    });
    
    // Send initial status to renderer
    logger.info('Sending initial status to renderer');
    mainWindow.webContents.send('system-status', systemStatus);
    mainWindow.webContents.send('network-status', networkManager.getStatus());
    mainWindow.webContents.send('server-status', serverManager.getStatus());
    mainWindow.webContents.send('external-hosting-status', externalHostingManager.getStatus());
    
    logger.info('All managers initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize managers:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    mainWindow.webContents.send('error', 'Failed to initialize application');
  }
}

// IPC Handlers
ipcMain.handle('get-system-status', async () => {
  logger.debug('Getting system status');
  return await systemChecker.checkSystem();
});

ipcMain.handle('get-network-status', () => {
  logger.debug('Getting network status');
  if (!networkManager) {
    return { error: 'Network manager not initialized' };
  }
  return networkManager.getStatus();
});

ipcMain.handle('get-server-status', () => {
  logger.debug('Getting server status');
  if (!serverManager) {
    return { error: 'Server manager not initialized' };
  }
  return serverManager.getStatus();
});

ipcMain.handle('get-user-profile', async () => {
  logger.debug('Getting user profile');
  if (!networkManager) {
    return { error: 'Network manager not initialized' };
  }
  return await networkManager.getCurrentProfile();
});

ipcMain.handle('save-user-profile', async (event, profile) => {
  try {
    if (!networkManager) {
      return { success: false, error: 'Network manager not initialized' };
    }
    logger.profile('Saving user profile', { id: profile.id, name: profile.displayName });
    await networkManager.saveProfile(profile);
    return { success: true };
  } catch (error) {
    logger.error('Failed to save user profile:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-server', async (event, config) => {
  try {
    if (!serverManager) {
      return { success: false, error: 'Server manager not initialized' };
    }
    logger.server('Starting server', config);
    const result = await serverManager.startServer(config);
    logger.server('Server started successfully', { id: result.id, name: result.name });
    return { success: true, data: result };
  } catch (error) {
    logger.error('Failed to start server:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-server', async (event, serverId) => {
  try {
    if (!serverManager) {
      return { success: false, error: 'Server manager not initialized' };
    }
    logger.server('Stopping server', { id: serverId });
    await serverManager.stopServer(serverId);
    logger.server('Server stopped successfully', { id: serverId });
    return { success: true };
  } catch (error) {
    logger.error('Failed to stop server:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('transfer-host', async (event, serverId, newHostId) => {
  try {
    if (!serverManager) {
      return { success: false, error: 'Server manager not initialized' };
    }
    logger.server('Transferring host', { serverId, newHostId });
    const result = await serverManager.transferHost(serverId, newHostId);
    logger.server('Host transfer completed', { serverId, newHostId });
    return { success: true, data: result };
  } catch (error) {
    logger.error('Failed to transfer host:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('take-over-host', async (event, serverId) => {
  try {
    if (!serverManager) {
      return { success: false, error: 'Server manager not initialized' };
    }
    logger.server('Taking over host', { serverId });
    const result = await serverManager.takeOverHost(serverId);
    logger.server('Host takeover completed', { serverId });
    return { success: true, data: result };
  } catch (error) {
    logger.error('Failed to take over host:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-minecraft', async (event, version) => {
  try {
    logger.system('Downloading Minecraft', { version });
    const result = await systemChecker.downloadMinecraft(version);
    logger.system('Minecraft download completed', { version, path: result.path });
    return { success: true, data: result };
  } catch (error) {
    logger.error('Failed to download Minecraft:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-forge', async (event, version) => {
  try {
    logger.system('Downloading Forge', { version });
    const result = await systemChecker.downloadForge(version);
    logger.system('Forge download completed', { version, path: result.path });
    return { success: true, data: result };
  } catch (error) {
    logger.error('Failed to download Forge:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-fabric', async (event, version) => {
  try {
    logger.system('Downloading Fabric', { version });
    const result = await systemChecker.downloadFabric(version);
    logger.system('Fabric download completed', { version, path: result.path });
    return { success: true, data: result };
  } catch (error) {
    logger.error('Failed to download Fabric:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-quilt', async (event, version) => {
  try {
    logger.system('Downloading Quilt', { version });
    const result = await systemChecker.downloadQuilt(version);
    logger.system('Quilt download completed', { version, path: result.path });
    return { success: true, data: result };
  } catch (error) {
    logger.error('Failed to download Quilt:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-neoforge', async (event, version) => {
  try {
    logger.system('Downloading NeoForge', { version });
    const result = await systemChecker.downloadNeoForge(version);
    logger.system('NeoForge download completed', { version, path: result.path });
    return { success: true, data: result };
  } catch (error) {
    logger.error('Failed to download NeoForge:', error);
    return { success: false, error: error.message };
  }
});

// Progress update handler for downloads
ipcMain.on('download-progress', (event, progressData) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('download-progress', progressData);
  }
});

// Handle Minecraft installation scanning
ipcMain.handle('scan-minecraft-installations', async () => {
  try {
    logger.system('Scanning for Minecraft installations');
    const installations = await systemChecker.scanForMinecraftInstallations();
    logger.system('Minecraft installation scan completed', { count: installations.length });
    return { success: true, installations };
  } catch (error) {
    logger.error('Error scanning Minecraft installations:', error);
    return { success: false, error: error.message };
  }
});

// Handle copying assets from existing installation
ipcMain.handle('copy-minecraft-assets', async (event, installationPath) => {
  try {
    logger.system('Copying Minecraft assets from existing installation', { path: installationPath });
    const targetPath = path.join(os.homedir(), '.multimc-hub', 'minecraft');
    
    // Create a mock installation object
    const installation = {
      path: installationPath,
      hasAssets: await fs.pathExists(path.join(installationPath, 'assets'))
    };
    
    const success = await systemChecker.copyAssetsFromInstallation(installation, targetPath);
    logger.system('Minecraft assets copy completed', { success });
    return { success };
  } catch (error) {
    logger.error('Error copying Minecraft assets:', error);
    return { success: false, error: error.message };
  }
});

// Handle copying version from existing installation
ipcMain.handle('copy-minecraft-version', async (event, installationPath, version) => {
  try {
    logger.system('Copying Minecraft version from existing installation', { path: installationPath, version });
    const targetPath = path.join(os.homedir(), '.multimc-hub', 'minecraft');
    
    // Create a mock installation object
    const installation = {
      path: installationPath
    };
    
    const success = await systemChecker.copyVersionFromInstallation(installation, version, targetPath);
    logger.system('Minecraft version copy completed', { success, version });
    return { success };
  } catch (error) {
    logger.error('Error copying Minecraft version:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-for-updates', () => {
  logger.info('Manual update check requested');
  checkForUpdates();
  return { success: true };
});

ipcMain.handle('get-logs', async (event, lines = 100) => {
  try {
    logger.debug('Getting recent logs', { lines });
    const logs = await logger.getRecentLogs(lines);
    return { success: true, logs };
  } catch (error) {
    logger.error('Failed to get logs:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-server-logs', async (event, serverId = null, lines = 100) => {
  try {
    logger.debug('Getting server logs', { serverId, lines });
    
    if (!serverManager) {
      return { success: false, error: 'Server manager not initialized' };
    }
    
    // If no specific server ID, get logs from all running servers
    if (!serverId) {
      const allLogs = [];
      for (const [id, server] of serverManager.activeServers) {
        try {
          const serverLogs = await serverManager.getServerLogs(id, lines);
          allLogs.push(...serverLogs);
        } catch (error) {
          logger.error(`Failed to get logs for server ${id}:`, error);
        }
      }
      
      // Sort by timestamp and return most recent
      allLogs.sort((a, b) => {
        const timeA = new Date(a.match(/\[(.*?)\]/)?.[1] || 0);
        const timeB = new Date(b.match(/\[(.*?)\]/)?.[1] || 0);
        return timeB - timeA;
      });
      
      return { success: true, logs: allLogs.slice(0, lines) };
    } else {
      const logs = await serverManager.getServerLogs(serverId, lines);
      return { success: true, logs };
    }
  } catch (error) {
    logger.error('Failed to get server logs:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-log-files', async () => {
  try {
    logger.debug('Getting log files');
    const files = await logger.getLogFiles();
    return { success: true, files };
  } catch (error) {
    logger.error('Failed to get log files:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-logs', async () => {
  try {
    logger.info('Clearing old logs');
    await logger.clearOldLogs();
    return { success: true };
  } catch (error) {
    logger.error('Failed to clear logs:', error);
    return { success: false, error: error.message };
  }
});

// Get Minecraft server logs
ipcMain.handle('kill-process', async (event, pid) => {
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    if (process.platform === 'darwin' || process.platform === 'linux') {
      await execAsync(`kill -9 ${pid}`);
    } else if (process.platform === 'win32') {
      await execAsync(`taskkill /PID ${pid} /F`);
    }
    
    logger.info('Killed process', { pid });
    return { success: true };
  } catch (error) {
    logger.error('Failed to kill process:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-port', async (event, port) => {
  try {
    const net = require('net');
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    return new Promise(async (resolve) => {
      const server = net.createServer();
      server.listen(port, () => {
        server.close();
        resolve({ available: true });
      });
      server.on('error', async () => {
        // Port is in use, try to find what's using it
        try {
          let processInfo = null;
          if (process.platform === 'darwin') {
            // macOS
            const { stdout } = await execAsync(`lsof -i :${port}`);
            const lines = stdout.trim().split('\n');
            if (lines.length > 1) {
              const parts = lines[1].split(/\s+/);
              processInfo = {
                pid: parts[1],
                name: parts[0],
                command: parts.slice(9).join(' ')
              };
            }
          } else if (process.platform === 'win32') {
            // Windows
            const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
            const lines = stdout.trim().split('\n');
            if (lines.length > 0) {
              const parts = lines[0].split(/\s+/);
              const pid = parts[parts.length - 1];
              const { stdout: taskStdout } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
              const taskParts = taskStdout.trim().split(',');
              processInfo = {
                pid: pid,
                name: taskParts[0].replace(/"/g, ''),
                command: taskParts[0].replace(/"/g, '')
              };
            }
          } else {
            // Linux
            const { stdout } = await execAsync(`lsof -i :${port}`);
            const lines = stdout.trim().split('\n');
            if (lines.length > 1) {
              const parts = lines[1].split(/\s+/);
              processInfo = {
                pid: parts[1],
                name: parts[0],
                command: parts.slice(9).join(' ')
              };
            }
          }
          resolve({ available: false, processInfo });
        } catch (error) {
          resolve({ available: false, error: 'Could not identify process using port' });
        }
      });
    });
  } catch (error) {
    logger.error('Failed to check port:', error);
    return { available: false, error: error.message };
  }
});



// Get list of available server log files
ipcMain.handle('get-server-log-files', async () => {
  try {
    logger.debug('Getting server log files');
    
    if (!serverManager) {
      return { success: false, error: 'Server manager not initialized' };
    }
    
    const serverLogs = [];
    
    for (const [serverId, server] of serverManager.activeServers) {
      try {
        const logPath = path.join(server.directory, 'logs', 'latest.log');
        const stats = await fs.stat(logPath);
        
        serverLogs.push({
          serverId: server.id,
          serverName: server.name,
          logPath: logPath,
          lastModified: stats.mtime,
          size: stats.size
        });
      } catch (error) {
        // Server might not have logs yet
        console.log(`No logs for server ${server.name}:`, error.message);
      }
    }
    
    return { success: true, serverLogs };
  } catch (error) {
    logger.error('Failed to get server log files:', error);
    return { success: false, error: error.message };
  }
});

// Mod management handlers
ipcMain.handle('get-server-mods', async (event, serverId) => {
  try {
    logger.debug('Getting server mods', { serverId });
    
    if (!serverManager) {
      return { success: false, error: 'Server manager not initialized' };
    }
    
    const server = serverManager.activeServers.get(serverId);
    if (!server) {
      return { success: false, error: 'Server not found' };
    }
    
    // Check if the server type supports mods
    const loaderInfo = serverManager.loaderManager.getLoaderInfo(server.type);
    if (!loaderInfo || !loaderInfo.supportsMods) {
      return { success: false, error: `Mods are not supported on ${server.type} servers` };
    }
    
    const modsDir = path.join(server.directory, 'mods');
    const mods = [];
    
    try {
      const files = await fs.readdir(modsDir);
      for (const file of files) {
        if (file.endsWith('.jar')) {
          const filePath = path.join(modsDir, file);
          const stats = await fs.stat(filePath);
          mods.push({
            name: file,
            size: stats.size,
            sizeFormatted: formatFileSize(stats.size),
            lastModified: stats.mtime,
            path: filePath
          });
        }
      }
    } catch (error) {
      // Mods directory might not exist yet
      console.log(`No mods directory for server ${server.name}:`, error.message);
    }
    
    return { success: true, mods };
  } catch (error) {
    logger.error('Failed to get server mods:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('upload-mod', async (event, serverId, modPath) => {
  try {
    logger.debug('Uploading mod to server', { serverId, modPath });
    
    if (!serverManager) {
      return { success: false, error: 'Server manager not initialized' };
    }
    
    const server = serverManager.activeServers.get(serverId);
    if (!server) {
      return { success: false, error: 'Server not found' };
    }
    
    // Check if the server type supports mods
    const loaderInfo = serverManager.loaderManager.getLoaderInfo(server.type);
    if (!loaderInfo || !loaderInfo.supportsMods) {
      return { success: false, error: `Mods are not supported on ${server.type} servers` };
    }
    
    // Check if mod file exists
    if (!await fs.pathExists(modPath)) {
      return { success: false, error: 'Mod file not found' };
    }
    
    // Get mod filename
    const modFileName = path.basename(modPath);
    const modsDir = path.join(server.directory, 'mods');
    const targetPath = path.join(modsDir, modFileName);
    
    // Ensure mods directory exists
    await fs.ensureDir(modsDir);
    
    // Copy mod to server
    await fs.copy(modPath, targetPath);
    
    logger.info('Mod uploaded successfully', { serverId, modFileName });
    return { success: true, modName: modFileName };
  } catch (error) {
    logger.error('Failed to upload mod:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remove-mod', async (event, serverId, modName) => {
  try {
    logger.debug('Removing mod from server', { serverId, modName });
    
    if (!serverManager) {
      return { success: false, error: 'Server manager not initialized' };
    }
    
    const server = serverManager.activeServers.get(serverId);
    if (!server) {
      return { success: false, error: 'Server not found' };
    }
    
    // Check if the server type supports mods
    const loaderInfo = serverManager.loaderManager.getLoaderInfo(server.type);
    if (!loaderInfo || !loaderInfo.supportsMods) {
      return { success: false, error: `Mods are not supported on ${server.type} servers` };
    }
    
    const modsDir = path.join(server.directory, 'mods');
    const modPath = path.join(modsDir, modName);
    
    // Check if mod exists
    if (!await fs.pathExists(modPath)) {
      return { success: false, error: 'Mod not found' };
    }
    
    // Remove mod
    await fs.remove(modPath);
    
    logger.info('Mod removed successfully', { serverId, modName });
    return { success: true };
  } catch (error) {
    logger.error('Failed to remove mod:', error);
    return { success: false, error: error.message };
  }
});

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

ipcMain.handle('select-directory', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    
    if (result.canceled) {
      return { canceled: true };
    }
    
    return { canceled: false, filePaths: result.filePaths };
  } catch (error) {
    logger.error('Failed to select directory:', error);
    return { canceled: true, error: error.message };
  }
});

ipcMain.handle('select-file', async (event, options) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      title: options.title || 'Select File',
      filters: options.filters || []
    });
    
    if (result.canceled) {
      return { canceled: true };
    }
    
    return { canceled: false, filePaths: result.filePaths };
  } catch (error) {
    logger.error('Failed to select file:', error);
    return { canceled: true, error: error.message };
  }
});

ipcMain.handle('open-external', async (event, url) => {
  logger.debug('Opening external URL', { url });
  await shell.openExternal(url);
});

// External Hosting IPC Handlers
ipcMain.handle('get-external-hosting-services', async () => {
  try {
    logger.debug('Getting external hosting services');
    if (!externalHostingManager) {
      return { success: false, error: 'External hosting manager not initialized' };
    }
    return { success: true, services: externalHostingManager.getAvailableServices() };
  } catch (error) {
    logger.error('Failed to get external hosting services:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-external-service-status', async (event, serviceId) => {
  try {
    logger.debug('Checking external service status', { serviceId });
    if (!externalHostingManager) {
      return { success: false, error: 'External hosting manager not initialized' };
    }
    const status = await externalHostingManager.checkServiceStatus(serviceId);
    return { success: true, status };
  } catch (error) {
    logger.error('Failed to check external service status:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('setup-external-service-account', async (event, serviceId, credentials) => {
  try {
    logger.debug('Setting up external service account', { serviceId });
    if (!externalHostingManager) {
      return { success: false, error: 'External hosting manager not initialized' };
    }
    const result = await externalHostingManager.setupServiceAccount(serviceId, credentials);
    return { success: true, ...result };
  } catch (error) {
    logger.error('Failed to setup external service account:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-recommended-external-service', async (event, serverConfig) => {
  try {
    logger.debug('Getting recommended external service', { serverConfig });
    if (!externalHostingManager) {
      return { success: false, error: 'External hosting manager not initialized' };
    }
    const service = await externalHostingManager.getRecommendedService(serverConfig);
    return { success: true, service };
  } catch (error) {
    logger.error('Failed to get recommended external service:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-external-server', async (event, serviceId, serverConfig) => {
  try {
    logger.debug('Creating external server', { serviceId, serverConfig });
    if (!externalHostingManager) {
      return { success: false, error: 'External hosting manager not initialized' };
    }
    const serverInfo = await externalHostingManager.createServerOnService(serviceId, serverConfig);
    return { success: true, serverInfo };
  } catch (error) {
    logger.error('Failed to create external server:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-external-setup-guide', async (event, serviceId, serverConfig) => {
  try {
    logger.debug('Getting external setup guide', { serviceId, serverConfig });
    if (!externalHostingManager) {
      return { success: false, error: 'External hosting manager not initialized' };
    }
    const guide = await externalHostingManager.generateSetupGuide(serviceId, serverConfig);
    return { success: true, guide };
  } catch (error) {
    logger.error('Failed to get external setup guide:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-external-hosting-status', async () => {
  try {
    logger.debug('Getting external hosting status');
    if (!externalHostingManager) {
      return { success: false, error: 'External hosting manager not initialized' };
    }
    return { success: true, status: externalHostingManager.getStatus() };
  } catch (error) {
    logger.error('Failed to get external hosting status:', error);
    return { success: false, error: error.message };
  }
});

// Enhanced modded server support IPC handlers
ipcMain.handle('get-modded-server-recommendations', async (event, serverConfig) => {
  try {
    logger.debug('Getting modded server recommendations', { serverConfig });
    if (!externalHostingManager) {
      return { success: false, error: 'External hosting manager not initialized' };
    }
    const recommendations = externalHostingManager.getModdedServerRecommendations(serverConfig);
    return { success: true, recommendations };
  } catch (error) {
    logger.error('Failed to get modded server recommendations:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-available-modpacks', async (event, serviceId) => {
  try {
    logger.debug('Getting available modpacks', { serviceId });
    if (!externalHostingManager) {
      return { success: false, error: 'External hosting manager not initialized' };
    }
    const modpacks = externalHostingManager.getAvailableModpacks(serviceId);
    return { success: true, modpacks };
  } catch (error) {
    logger.error('Failed to get available modpacks:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-modded-setup-guide', async (event, serviceId, serverConfig) => {
  try {
    logger.debug('Getting modded setup guide', { serviceId, serverConfig });
    if (!externalHostingManager) {
      return { success: false, error: 'External hosting manager not initialized' };
    }
    const guide = externalHostingManager.generateModdedSetupGuide(serviceId, serverConfig);
    return { success: true, guide };
  } catch (error) {
    logger.error('Failed to get modded setup guide:', error);
    return { success: false, error: error.message };
  }
});

// Contact Management IPC handlers
ipcMain.handle('get-contacts', async () => {
  try {
    logger.debug('Getting contacts');
    if (!networkManager) {
      return { success: false, error: 'Network manager not initialized' };
    }
    const contacts = networkManager.getContacts();
    return { success: true, contacts };
  } catch (error) {
    logger.error('Failed to get contacts:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-contact', async (event, peerId, contactInfo) => {
  try {
    logger.debug('Adding contact', { peerId, contactInfo });
    if (!networkManager) {
      return { success: false, error: 'Network manager not initialized' };
    }
    const contact = await networkManager.addContact(peerId, contactInfo);
    return { success: true, contact };
  } catch (error) {
    logger.error('Failed to add contact:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remove-contact', async (event, peerId) => {
  try {
    logger.debug('Removing contact', { peerId });
    if (!networkManager) {
      return { success: false, error: 'Network manager not initialized' };
    }
    const contact = await networkManager.removeContact(peerId);
    return { success: true, contact };
  } catch (error) {
    logger.error('Failed to remove contact:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('block-peer', async (event, peerId) => {
  try {
    logger.debug('Blocking peer', { peerId });
    if (!networkManager) {
      return { success: false, error: 'Network manager not initialized' };
    }
    await networkManager.blockPeer(peerId);
    return { success: true };
  } catch (error) {
    logger.error('Failed to block peer:', error);
    return { success: false, error: error.message };
  }
});

// Invitation Management IPC handlers
ipcMain.handle('generate-invite-code', async () => {
  try {
    logger.debug('Generating invite code');
    if (!networkManager) {
      return { success: false, error: 'Network manager not initialized' };
    }
    const inviteCode = networkManager.generateInviteCode();
    return { success: true, inviteCode };
  } catch (error) {
    logger.error('Failed to generate invite code:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('redeem-invite-code', async (event, code) => {
  try {
    logger.debug('Redeeming invite code', { code });
    if (!networkManager) {
      return { success: false, error: 'Network manager not initialized' };
    }
    const invite = await networkManager.redeemInviteCode(code);
    return { success: true, invite };
  } catch (error) {
    logger.error('Failed to redeem invite code:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-pending-invites', async () => {
  try {
    logger.debug('Getting pending invites');
    if (!networkManager) {
      return { success: false, error: 'Network manager not initialized' };
    }
    const invites = networkManager.getPendingInvites();
    return { success: true, invites };
  } catch (error) {
    logger.error('Failed to get pending invites:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('accept-invite', async (event, inviteId) => {
  try {
    logger.debug('Accepting invite', { inviteId });
    if (!networkManager) {
      return { success: false, error: 'Network manager not initialized' };
    }
    const invite = await networkManager.acceptInvite(inviteId);
    return { success: true, invite };
  } catch (error) {
    logger.error('Failed to accept invite:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('decline-invite', async (event, inviteId) => {
  try {
    logger.debug('Declining invite', { inviteId });
    if (!networkManager) {
      return { success: false, error: 'Network manager not initialized' };
    }
    const invite = await networkManager.declineInvite(inviteId);
    return { success: true, invite };
  } catch (error) {
    logger.error('Failed to decline invite:', error);
    return { success: false, error: error.message };
  }
});

// Modrinth API IPC handlers
ipcMain.handle('search-modrinth-mods', async (event, query, filters) => {
  try {
    logger.debug('Searching Modrinth mods', { query, filters });
    if (!modrinthManager) {
      return { success: false, error: 'Modrinth manager not initialized' };
    }
    const results = await modrinthManager.searchMods(query, filters);
    return { success: true, results };
  } catch (error) {
    logger.error('Failed to search Modrinth mods:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-modrinth-mod-details', async (event, projectId) => {
  try {
    logger.debug('Getting Modrinth mod details', { projectId });
    if (!modrinthManager) {
      return { success: false, error: 'Modrinth manager not initialized' };
    }
    const modData = await modrinthManager.getModDetails(projectId);
    return { success: true, modData };
  } catch (error) {
    logger.error('Failed to get Modrinth mod details:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-modrinth-mod-versions', async (event, projectId, filters) => {
  try {
    logger.debug('Getting Modrinth mod versions', { projectId, filters });
    if (!modrinthManager) {
      return { success: false, error: 'Modrinth manager not initialized' };
    }
    const versions = await modrinthManager.getModVersions(projectId, filters);
    return { success: true, versions };
  } catch (error) {
    logger.error('Failed to get Modrinth mod versions:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-modrinth-mod', async (event, versionId, serverPath) => {
  try {
    logger.debug('Installing Modrinth mod', { versionId, serverPath });
    if (!modrinthManager) {
      return { success: false, error: 'Modrinth manager not initialized' };
    }
    const result = await modrinthManager.installModToServer(versionId, serverPath);
    return { success: true, result };
  } catch (error) {
    logger.error('Failed to install Modrinth mod:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-modrinth-categories', async () => {
  try {
    logger.debug('Getting Modrinth categories');
    if (!modrinthManager) {
      return { success: false, error: 'Modrinth manager not initialized' };
    }
    const categories = await modrinthManager.getCategories();
    return { success: true, categories };
  } catch (error) {
    logger.error('Failed to get Modrinth categories:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-modrinth-loaders', async () => {
  try {
    logger.debug('Getting Modrinth loaders');
    if (!modrinthManager) {
      return { success: false, error: 'Modrinth manager not initialized' };
    }
    const loaders = await modrinthManager.getLoaders();
    return { success: true, loaders };
  } catch (error) {
    logger.error('Failed to get Modrinth loaders:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-modrinth-game-versions', async () => {
  try {
    logger.debug('Getting Modrinth game versions');
    if (!modrinthManager) {
      return { success: false, error: 'Modrinth manager not initialized' };
    }
    const versions = await modrinthManager.getGameVersions();
    return { success: true, versions };
  } catch (error) {
    logger.error('Failed to get Modrinth game versions:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-modrinth-featured-mods', async () => {
  try {
    logger.debug('Getting Modrinth featured mods');
    if (!modrinthManager) {
      return { success: false, error: 'Modrinth manager not initialized' };
    }
    const mods = await modrinthManager.getFeaturedMods();
    return { success: true, mods };
  } catch (error) {
    logger.error('Failed to get Modrinth featured mods:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-modrinth-trending-mods', async () => {
  try {
    logger.debug('Getting Modrinth trending mods');
    if (!modrinthManager) {
      return { success: false, error: 'Modrinth manager not initialized' };
    }
    const mods = await modrinthManager.getTrendingMods();
    return { success: true, mods };
  } catch (error) {
    logger.error('Failed to get Modrinth trending mods:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-modrinth-popular-mods', async () => {
  try {
    logger.debug('Getting Modrinth popular mods');
    if (!modrinthManager) {
      return { success: false, error: 'Modrinth manager not initialized' };
    }
    const mods = await modrinthManager.getPopularMods();
    return { success: true, mods };
  } catch (error) {
    logger.error('Failed to get Modrinth popular mods:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-modrinth-compatibility', async (event, projectId, gameVersion, loader) => {
  try {
    logger.debug('Checking Modrinth mod compatibility', { projectId, gameVersion, loader });
    if (!modrinthManager) {
      return { success: false, error: 'Modrinth manager not initialized' };
    }
    const compatibility = await modrinthManager.checkModCompatibility(projectId, gameVersion, loader);
    return { success: true, compatibility };
  } catch (error) {
    logger.error('Failed to check Modrinth mod compatibility:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-modrinth-cache', async () => {
  try {
    logger.debug('Clearing Modrinth cache');
    if (!modrinthManager) {
      return { success: false, error: 'Modrinth manager not initialized' };
    }
    modrinthManager.clearCache();
    return { success: true };
  } catch (error) {
    logger.error('Failed to clear Modrinth cache:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-modrinth-cache-stats', async () => {
  try {
    logger.debug('Getting Modrinth cache stats');
    if (!modrinthManager) {
      return { success: false, error: 'Modrinth manager not initialized' };
    }
    const stats = modrinthManager.getCacheStats();
    return { success: true, stats };
  } catch (error) {
    logger.error('Failed to get Modrinth cache stats:', error);
    return { success: false, error: error.message };
  }
});

// Cloud Sync IPC handlers
ipcMain.handle('register-world', async (event, worldPath, worldName, serverId) => {
  try {
    logger.debug('Registering world', { worldPath, worldName, serverId });
    if (!cloudSyncManager) {
      return { success: false, error: 'Cloud sync manager not initialized' };
    }
    const worldInfo = await cloudSyncManager.registerWorld(worldPath, worldName, serverId);
    return { success: true, worldInfo };
  } catch (error) {
    logger.error('Failed to register world:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('register-server', async (event, serverPath, serverName, serverConfig) => {
  try {
    logger.debug('Registering server', { serverPath, serverName });
    if (!cloudSyncManager) {
      return { success: false, error: 'Cloud sync manager not initialized' };
    }
    const serverInfo = await cloudSyncManager.registerServer(serverPath, serverName, serverConfig);
    return { success: true, serverInfo };
  } catch (error) {
    logger.error('Failed to register server:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sync-world', async (event, worldId) => {
  try {
    logger.debug('Syncing world', { worldId });
    if (!cloudSyncManager) {
      return { success: false, error: 'Cloud sync manager not initialized' };
    }
    const worldInfo = await cloudSyncManager.syncWorld(worldId);
    return { success: true, worldInfo };
  } catch (error) {
    logger.error('Failed to sync world:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sync-server', async (event, serverId) => {
  try {
    logger.debug('Syncing server', { serverId });
    if (!cloudSyncManager) {
      return { success: false, error: 'Cloud sync manager not initialized' };
    }
    const serverInfo = await cloudSyncManager.syncServer(serverId);
    return { success: true, serverInfo };
  } catch (error) {
    logger.error('Failed to sync server:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('restore-world', async (event, worldId, targetPath) => {
  try {
    logger.debug('Restoring world', { worldId, targetPath });
    if (!cloudSyncManager) {
      return { success: false, error: 'Cloud sync manager not initialized' };
    }
    const result = await cloudSyncManager.restoreWorld(worldId, targetPath);
    return { success: true, result };
  } catch (error) {
    logger.error('Failed to restore world:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('restore-server', async (event, serverId, targetPath) => {
  try {
    logger.debug('Restoring server', { serverId, targetPath });
    if (!cloudSyncManager) {
      return { success: false, error: 'Cloud sync manager not initialized' };
    }
    const result = await cloudSyncManager.restoreServer(serverId, targetPath);
    return { success: true, result };
  } catch (error) {
    logger.error('Failed to restore server:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('initiate-transfer', async (event, type, id, targetContactId) => {
  try {
    logger.debug('Initiating transfer', { type, id, targetContactId });
    if (!cloudSyncManager) {
      return { success: false, error: 'Cloud sync manager not initialized' };
    }
    const transferInfo = await cloudSyncManager.initiateTransfer(type, id, targetContactId);
    return { success: true, transferInfo };
  } catch (error) {
    logger.error('Failed to initiate transfer:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('accept-transfer', async (event, transferId) => {
  try {
    logger.debug('Accepting transfer', { transferId });
    if (!cloudSyncManager) {
      return { success: false, error: 'Cloud sync manager not initialized' };
    }
    const transfer = await cloudSyncManager.acceptTransfer(transferId);
    return { success: true, transfer };
  } catch (error) {
    logger.error('Failed to accept transfer:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('decline-transfer', async (event, transferId) => {
  try {
    logger.debug('Declining transfer', { transferId });
    if (!cloudSyncManager) {
      return { success: false, error: 'Cloud sync manager not initialized' };
    }
    const transfer = await cloudSyncManager.declineTransfer(transferId);
    return { success: true, transfer };
  } catch (error) {
    logger.error('Failed to decline transfer:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-sync-status', async () => {
  try {
    logger.debug('Getting sync status');
    if (!cloudSyncManager) {
      return { success: false, error: 'Cloud sync manager not initialized' };
    }
    const status = cloudSyncManager.getSyncStatus();
    return { success: true, status };
  } catch (error) {
    logger.error('Failed to get sync status:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-all-registered', async () => {
  try {
    logger.debug('Getting all registered worlds and servers');
    if (!cloudSyncManager) {
      return { success: false, error: 'Cloud sync manager not initialized' };
    }
    const registered = await cloudSyncManager.getAllRegistered();
    return { success: true, registered };
  } catch (error) {
    logger.error('Failed to get all registered:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cleanup-backups', async (event, maxAge) => {
  try {
    logger.debug('Cleaning up backups', { maxAge });
    if (!cloudSyncManager) {
      return { success: false, error: 'Cloud sync manager not initialized' };
    }
    await cloudSyncManager.cleanupOldBackups(maxAge);
    return { success: true };
  } catch (error) {
    logger.error('Failed to cleanup backups:', error);
    return { success: false, error: error.message };
  }
});

// Event listeners for real-time updates
ipcMain.on('server-update', (event, data) => {
  logger.debug('Server update received', data);
  mainWindow.webContents.send('server-update', data);
});

ipcMain.on('network-update', (event, data) => {
  logger.debug('Network update received', data);
  mainWindow.webContents.send('network-update', data);
});

ipcMain.on('profile-updated', (event, data) => {
  logger.profile('Profile update received', data);
  mainWindow.webContents.send('profile-updated', data);
});

// App event handlers
app.whenReady().then(() => {
  setupAutoUpdater();
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  logger.info('All windows closed, cleaning up...');
  
  try {
    if (serverManager) {
      await serverManager.cleanup();
    }
  } catch (error) {
    logger.error('Error during ServerManager cleanup:', error);
  }
  
  try {
    if (networkManager) {
      await networkManager.cleanup();
    }
  } catch (error) {
    logger.error('Error during NetworkManager cleanup:', error);
  }
  
  try {
    if (externalHostingManager) {
      await externalHostingManager.cleanup();
    }
  } catch (error) {
    logger.error('Error during ExternalHostingManager cleanup:', error);
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  logger.info('Application quitting...');
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection:', reason);
  if (reason instanceof Error) {
    logger.error('Error stack:', reason.stack);
  }
}); 