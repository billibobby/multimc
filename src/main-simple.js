const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  console.log('Creating main window...');
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    show: false
  });

  console.log('Loading HTML file...');
  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    console.log('Main window ready to show');
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    console.log('Main window closed');
    mainWindow = null;
  });

  mainWindow.on('error', (error) => {
    console.error('Main window error:', error);
  });
}

// Test each module individually
async function testModules() {
  console.log('Testing modules...');
  
  try {
    console.log('Testing electron-updater...');
    const { autoUpdater } = require('electron-updater');
    console.log('✅ electron-updater loaded successfully');
  } catch (error) {
    console.error('❌ electron-updater failed:', error.message);
  }
  
  try {
    console.log('Testing ServerManager...');
    const { ServerManager } = require('./server/ServerManager');
    console.log('✅ ServerManager loaded successfully');
  } catch (error) {
    console.error('❌ ServerManager failed:', error.message);
  }
  
  try {
    console.log('Testing NetworkManager...');
    const { NetworkManager } = require('./network/NetworkManager');
    console.log('✅ NetworkManager loaded successfully');
  } catch (error) {
    console.error('❌ NetworkManager failed:', error.message);
  }
  
  try {
    console.log('Testing SystemChecker...');
    const { SystemChecker } = require('./utils/SystemChecker');
    console.log('✅ SystemChecker loaded successfully');
  } catch (error) {
    console.error('❌ SystemChecker failed:', error.message);
  }
  
  try {
    console.log('Testing Logger...');
    const { logger } = require('./utils/Logger');
    console.log('✅ Logger loaded successfully');
  } catch (error) {
    console.error('❌ Logger failed:', error.message);
  }
}

app.whenReady().then(() => {
  console.log('App is ready');
  testModules().then(() => {
    createWindow();
  });
});

app.on('window-all-closed', () => {
  console.log('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  console.log('App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('error', (error) => {
  console.error('App error:', error);
}); 