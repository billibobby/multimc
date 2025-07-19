const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { ServerManager } = require('./server/ServerManager');
const { NetworkManager } = require('./network/NetworkManager');
const { SystemChecker } = require('./utils/SystemChecker');
const { logger } = require('./utils/Logger');

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
  autoUpdater.checkForUpdates();
}

function setupAutoUpdater() {
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
    
    // Send initial status to renderer
    logger.info('Sending initial status to renderer');
    mainWindow.webContents.send('system-status', systemStatus);
    mainWindow.webContents.send('network-status', networkManager.getStatus());
    mainWindow.webContents.send('server-status', serverManager.getStatus());
    
    logger.info('All managers initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize managers:', error);
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
  return networkManager.getStatus();
});

ipcMain.handle('get-server-status', () => {
  logger.debug('Getting server status');
  return serverManager.getStatus();
});

ipcMain.handle('get-user-profile', async () => {
  logger.debug('Getting user profile');
  return await networkManager.getCurrentProfile();
});

ipcMain.handle('save-user-profile', async (event, profile) => {
  try {
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

ipcMain.handle('select-directory', async () => {
  logger.debug('Opening directory selector');
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.filePaths[0];
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
  
  if (serverManager) {
    await serverManager.cleanup();
  }
  
  if (networkManager) {
    await networkManager.cleanup();
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
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
}); 