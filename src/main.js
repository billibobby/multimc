const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { ServerManager } = require('./server/ServerManager');
const { NetworkManager } = require('./network/NetworkManager');
const { SystemChecker } = require('./utils/SystemChecker');
const { logger } = require('./utils/Logger');
const fs = require('fs/promises'); // Added for file system operations

let mainWindow;
let serverManager;
let networkManager;
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
    
    // Set up event listeners to forward server events to renderer
    serverManager.on('server-update', (data) => {
      logger.debug('Forwarding server-update to renderer', data);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server-update', data);
      }
    });
    
    // Send initial status to renderer
    logger.info('Sending initial status to renderer');
    mainWindow.webContents.send('system-status', systemStatus);
    mainWindow.webContents.send('network-status', networkManager.getStatus());
    mainWindow.webContents.send('server-status', serverManager.getStatus());
    
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
ipcMain.handle('get-server-logs', async (event, serverId, lines = 100) => {
  try {
    logger.debug('Getting server logs', { serverId, lines });
    
    if (!serverManager) {
      return { success: false, error: 'Server manager not initialized' };
    }
    
    const server = serverManager.activeServers.get(serverId);
    if (!server) {
      return { success: false, error: 'Server not found' };
    }
    
    const logPath = path.join(server.directory, 'logs', 'latest.log');
    const logContent = await fs.readFile(logPath, 'utf8');
    const logLines = logContent.split('\n').filter(line => line.trim());
    
    return { 
      success: true, 
      logs: logLines.slice(-lines),
      serverName: server.name,
      serverId: server.id
    };
  } catch (error) {
    logger.error('Failed to get server logs:', error);
    return { success: false, error: error.message };
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