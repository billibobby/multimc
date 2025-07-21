const path = require('path');

// Fix the Electron import issue
try {
  const electron = require('electron');
  const { app, BrowserWindow } = electron;
  
  if (!app) {
    throw new Error('Electron app object is undefined - check Electron installation');
  }
  
  // Check if this is a test run
  const isTestMode = process.argv.includes('--test');
  
  if (isTestMode) {
    console.log('✅ Electron loaded successfully');
    console.log('✅ app object:', typeof app);
    console.log('✅ BrowserWindow object:', typeof BrowserWindow);
    console.log('✅ app.whenReady function:', typeof app.whenReady);
    process.exit(0);
  }
  
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

  // Check if app.whenReady exists before using it
  if (typeof app.whenReady === 'function') {
    app.whenReady().then(() => {
      console.log('App is ready');
      testModules().then(() => {
        createWindow();
      }).catch((error) => {
        console.error('Error in testModules:', error);
        createWindow(); // Still try to create window even if modules fail
      });
    }).catch((error) => {
      console.error('Error in app.whenReady:', error);
    });
  } else {
    console.error('❌ app.whenReady is not available - Electron may not be properly installed');
    process.exit(1);
  }

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

} catch (error) {
  console.error('❌ Failed to load Electron:', error.message);
  console.error('This usually means Electron is not properly installed.');
  console.error('Try running: npm install');
  process.exit(1);
} 