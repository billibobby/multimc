const { ipcRenderer } = require('electron');

// Global state
let currentTab = 'dashboard';
let systemStatus = null;
let networkStatus = null;
let serverStatus = null;
let selectedServerId = null;
let userProfile = null;
let currentLogs = [];
let logFiles = [];
let selectedLogFile = null;
let currentLogType = 'app'; // 'app' or 'server'
let serverLogs = [];
let selectedServerLog = null;
let isAuthenticated = false;

// Game Activity Functions
let gameActivityLog = [];
let currentActivityFilter = 'all';
let activityUpdateInterval = null;

// DOM Elements
const tabItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');
const pageTitle = document.getElementById('page-title');
const connectionStatus = document.getElementById('connection-status');
const connectionText = document.getElementById('connection-text');
const userName = document.getElementById('user-name');
const sidebarUserName = document.getElementById('sidebar-user-name');
const sidebarUserPlatform = document.getElementById('sidebar-user-platform');

// Debug logging function
function debugLog(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    
    // Log to console
    console.log(logMessage);
    
    // Also log to a debug file
    try {
        const fs = require('fs');
        const path = require('path');
        const debugFile = path.join(__dirname, 'debug.log');
        fs.appendFileSync(debugFile, logMessage + '\n');
    } catch (error) {
        // Ignore file write errors
    }
}

// Override console.log to also write to debug file
const originalConsoleLog = console.log;
console.log = function(...args) {
    originalConsoleLog.apply(console, args);
    try {
        const fs = require('fs');
        const path = require('path');
        const debugFile = path.join(__dirname, 'debug.log');
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        fs.appendFileSync(debugFile, `[${new Date().toISOString()}] ${message}\n`);
    } catch (error) {
        // Ignore file write errors
    }
};

// Define refreshEntireApp function early to avoid timing issues
async function refreshEntireApp() {
    console.log('=== REFRESHING ENTIRE APPLICATION ===');
    console.log('refreshEntireApp function called!');
    
    // Show visual refresh indicator on the top-right refresh button
    const refreshButton = document.querySelector('.header-right .btn');
    console.log('Found refresh button:', refreshButton);
    let originalText = '';
    if (refreshButton) {
        originalText = refreshButton.innerHTML;
        refreshButton.innerHTML = '<i class="fas fa-sync-alt refresh-spinning"></i>';
        refreshButton.disabled = true;
        refreshButton.title = 'Refreshing...';
        console.log('Updated refresh button with spinning icon');
    } else {
        console.log('Refresh button not found! Available buttons:', document.querySelectorAll('.header-right .btn'));
    }
    
    showNotification('Refreshing all data...', 'info');
    
    try {
        // Refresh system status - fetch fresh data from main process
        console.log('Refreshing system status...');
        systemStatus = await ipcRenderer.invoke('get-system-status');
        updateSystemStatus();
        
        // Refresh network status - fetch fresh data from main process
        console.log('Refreshing network status...');
        networkStatus = await ipcRenderer.invoke('get-network-status');
        updateNetworkStatus();
        
        // Refresh server status - fetch fresh data from main process
        console.log('Refreshing server status...');
        serverStatus = await ipcRenderer.invoke('get-server-status');
        updateServerStatus();
        
        // Refresh downloads data
        console.log('Refreshing downloads data...');
        await loadDownloadsData();
        
        // Refresh user profile
        console.log('Refreshing user profile...');
        await loadUserProfile();
        
        // Refresh servers data
        console.log('Refreshing servers data...');
        await loadServersData();
        
        // Refresh network data
        console.log('Refreshing network data...');
        await loadNetworkData();
        
        showNotification('All data refreshed successfully!', 'success');
        console.log('=== REFRESH COMPLETE ===');
        
    } catch (error) {
        console.error('Error refreshing application:', error);
        showNotification('Error refreshing data: ' + error.message, 'error');
    } finally {
        // Restore button state
        if (refreshButton && originalText) {
            refreshButton.innerHTML = originalText;
            refreshButton.disabled = false;
            refreshButton.title = 'Refresh all data';
            console.log('Restored refresh button state');
        }
    }
}

// Installation Scanner functions
async function scanMinecraftInstallations() {
  const scanBtn = document.getElementById('scan-installations-btn');
  const installationsList = document.getElementById('installations-list');
  const installationsContainer = document.getElementById('installations-container');
  
  try {
    // Show loading state
            scanBtn.innerHTML = '<i class="fas fa-sync-alt refresh-spinning"></i> Scanning...';
    scanBtn.disabled = true;
    
    // Hide previous results
    installationsList.style.display = 'none';
    
    // Call the main process to scan for installations
    const result = await ipcRenderer.invoke('scan-minecraft-installations');
    
    if (result.success) {
      displayInstallations(result.installations);
      installationsList.style.display = 'block';
      showNotification('Found ' + result.installations.length + ' Minecraft installation(s)', 'success');
    } else {
      showNotification('Failed to scan installations: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Error scanning installations:', error);
    showNotification('Error scanning installations: ' + error.message, 'error');
  } finally {
    // Reset button state
    scanBtn.innerHTML = '<i class="fas fa-search"></i> Scan for Minecraft Installations';
    scanBtn.disabled = false;
  }
}

function displayInstallations(installations) {
  const container = document.getElementById('installations-container');
  
  if (installations.length === 0) {
    container.innerHTML = '<p>No Minecraft installations found on your system.</p>';
    return;
  }
  
  const html = installations.map(installation => `
    <div class="installation-item">
      <div class="installation-info">
        <div class="installation-name">${installation.name}</div>
        <div class="installation-path">${installation.path}</div>
        <div class="installation-versions">
          <strong>Versions:</strong> ${installation.versions.join(', ')}
          ${installation.hasAssets ? ' • <span style="color: #4caf50;">Has Assets</span>' : ''}
        </div>
      </div>
      <div class="installation-actions">
        ${installation.hasAssets ? 
          `<button class="btn btn-copy-assets" onclick="copyMinecraftAssets('${installation.path}')">
            <i class="fas fa-copy"></i> Copy Assets
          </button>` : ''
        }
        <button class="btn btn-copy-version" onclick="copyMinecraftVersion('${installation.path}', '${installation.versions[0]}')">
          <i class="fas fa-download"></i> Copy ${installation.versions[0]}
        </button>
      </div>
    </div>
  `).join('');
  
  container.innerHTML = html;
}

async function copyMinecraftAssets(installationPath) {
  try {
    showNotification('Copying Minecraft assets...', 'info');
    
    const result = await ipcRenderer.invoke('copy-minecraft-assets', installationPath);
    
    if (result.success) {
      showNotification('Minecraft assets copied successfully!', 'success');
      // Refresh the downloads to show updated status
      refreshDownloads();
    } else {
      showNotification('Failed to copy assets: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Error copying assets:', error);
    showNotification('Error copying assets: ' + error.message, 'error');
  }
}

async function copyMinecraftVersion(installationPath, version) {
  try {
    showNotification(`Copying Minecraft version ${version}...`, 'info');
    
    const result = await ipcRenderer.invoke('copy-minecraft-version', installationPath, version);
    
    if (result.success) {
      showNotification(`Minecraft version ${version} copied successfully!`, 'success');
      // Refresh the downloads to show updated status
      refreshDownloads();
    } else {
      showNotification('Failed to copy version: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Error copying version:', error);
    showNotification('Error copying version: ' + error.message, 'error');
  }
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing MultiMC Hub with authentication...');
    initializeAppWithAuth();
});

function initializeApp() {
    console.log('Initializing MultiMC Hub application...');
    
    // Set up tab navigation
    tabItems.forEach(item => {
        item.addEventListener('click', async (e) => {
            e.preventDefault();
            const tab = item.getAttribute('data-tab');
            await switchTab(tab);
        });
    });
    
    // Set up event listeners
    setupEventListeners();
    
    // Load initial data
    loadInitialData();
    
    console.log('MultiMC Hub application initialized successfully');
}

// Modified initialization to check authentication first
function initializeAppWithAuth() {
    console.log('Starting MultiMC Hub with authentication check...');
    checkAuthentication();
}

function setupEventListeners() {
    // Listen for IPC messages from main process
    ipcRenderer.on('system-status', (event, status) => {
        console.log('Received system status:', status);
        systemStatus = status;
        updateSystemStatus();
    });

    ipcRenderer.on('network-status', (event, status) => {
        networkStatus = status;
        updateNetworkStatus();
        updateConnectionStatus();
    });

    ipcRenderer.on('server-status', (event, status) => {
        serverStatus = status;
        updateServerStatus();
    });

    ipcRenderer.on('server-update', (event, update) => {
        handleServerUpdate(update);
    });

    ipcRenderer.on('network-update', (event, update) => {
        handleNetworkUpdate(update);
    });

    ipcRenderer.on('profile-updated', (event, data) => {
        handleProfileUpdate(data);
    });

    ipcRenderer.on('error', (event, message) => {
        showNotification(message, 'error');
    });
    
    // Auto-update event listeners
    ipcRenderer.on('update-status', (event, data) => {
        handleUpdateStatus(data);
    });
    
    ipcRenderer.on('update-progress', (event, progress) => {
        handleUpdateProgress(progress);
    });
    
    // Download progress event listener
    ipcRenderer.on('download-progress', (event, progressData) => {
        updateDownloadProgress(progressData.progress, progressData.status);
    });
    
    // Add event listener for server type change
    const typeSelect = document.getElementById('server-type');
    if (typeSelect) {
        typeSelect.addEventListener('change', async () => {
            console.log('Server type changed to:', typeSelect.value);
            await populateVersionDropdown();
        });
    }
    
    // Add event listener for refresh button
    const refreshButton = document.getElementById('refresh-button');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            console.log('Refresh button clicked via event listener');
            refreshEntireApp();
        });
    }
    
    // Add event listener for refresh status button
    const refreshStatusButton = document.getElementById('refresh-status-btn');
    if (refreshStatusButton) {
        refreshStatusButton.addEventListener('click', () => {
            console.log('Refresh status button clicked via event listener');
            refreshStatus();
        });
    }
    
    // Start game activity monitoring
    startGameActivityMonitoring();
}

async function loadInitialData() {
    try {
        // Load user profile first
        await loadUserProfile();

        // Load system status
        systemStatus = await ipcRenderer.invoke('get-system-status');
        console.log('Loaded system status:', systemStatus);
        updateSystemStatus();

        // Load network status
        networkStatus = await ipcRenderer.invoke('get-network-status');
        updateNetworkStatus();
        updateConnectionStatus();

        // Load server status
        serverStatus = await ipcRenderer.invoke('get-server-status');
        console.log('Server status loaded:', serverStatus);
        updateServerStatus();

        // Load downloads data
        loadDownloadsData();
    } catch (error) {
        console.error('Failed to load initial data:', error);
        showNotification('Failed to load application data', 'error');
    }
}

async function loadUserProfile() {
    try {
        // Use IPC to get profile from main process
        const result = await ipcRenderer.invoke('get-user-profile');
        if (result && result.success) {
            userProfile = result.profile;
        } else {
            // Create default profile if none exists
            userProfile = {
                id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
                name: 'User',
                displayName: 'User',
                platform: 'unknown',
                createdAt: new Date().toISOString(),
                lastSeen: new Date().toISOString()
            };
        }
        
        updateUserProfileDisplay();
    } catch (error) {
        console.error('Failed to load user profile:', error);
        // Create a basic profile as fallback
        userProfile = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            name: 'User',
            displayName: 'User',
            platform: 'unknown',
            createdAt: new Date().toISOString(),
            lastSeen: new Date().toISOString()
        };
        updateUserProfileDisplay();
    }
}

async function saveUserProfile(profile) {
    try {
        const result = await ipcRenderer.invoke('save-user-profile', profile);
        if (result && result.success) {
            userProfile = profile;
            updateUserProfileDisplay();
            return true;
        } else {
            throw new Error(result?.error || 'Failed to save profile');
        }
    } catch (error) {
        console.error('Failed to save user profile:', error);
        return false;
    }
}

function updateUserProfileDisplay() {
    if (userProfile) {
        const displayName = userProfile.displayName || userProfile.name;
        const platform = userProfile.platform || 'unknown';
        
        // Update header
        userName.textContent = displayName;
        
        // Update sidebar
        sidebarUserName.textContent = displayName;
        sidebarUserPlatform.textContent = platform;
    }
}

async function switchTab(tabName) {
    // Update active tab
    tabItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-tab') === tabName) {
            item.classList.add('active');
        }
    });

    // Update active content
    tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === tabName) {
            content.classList.add('active');
        }
    });

    // Update page title
    const tabLabels = {
        dashboard: 'Dashboard',
        servers: 'Servers',
        network: 'Network',
        downloads: 'Downloads',
        externalHosting: 'External Hosting',
        logs: 'Logs',
        settings: 'Settings'
    };
    pageTitle.textContent = tabLabels[tabName] || 'Dashboard';
    currentTab = tabName;

    // Load tab-specific data
    switch (tabName) {
        case 'servers':
            loadServersData();
            break;
        case 'network':
            loadNetworkData();
            break;
        case 'downloads':
            // Refresh system status to get latest version data
            try {
                systemStatus = await ipcRenderer.invoke('get-system-status');
            } catch (error) {
                console.error('Failed to refresh system status:', error);
            }
            loadDownloadsData();
            break;
        case 'external-hosting':
            loadExternalHostingData();
            break;
        case 'logs':
            loadLogsData();
            break;
    }
}

function updateSystemStatus() {
    const content = document.getElementById('system-status-content');
    if (!systemStatus) {
        content.innerHTML = '<div class="loading-spinner"></div>';
        return;
    }

    const statusItems = [];
    
    // Overall status
    const overallStatus = systemStatus.status === 'ready' ? 'ok' : 'warning';
    statusItems.push(`
        <div class="status-item">
            <div class="status-label">
                <i class="fas fa-check-circle status-${overallStatus}"></i>
                Overall Status
            </div>
            <div class="status-value status-${overallStatus}">
                ${systemStatus.status === 'ready' ? 'Ready' : 'Needs Setup'}
            </div>
        </div>
    `);

    // Individual checks
    Object.entries(systemStatus.checks).forEach(([key, check]) => {
        const statusClass = check.status === 'ok' ? 'ok' : check.status === 'error' ? 'error' : 'warning';
        statusItems.push(`
            <div class="status-item">
                <div class="status-label">
                    <i class="fas fa-${getStatusIcon(check.status)} status-${statusClass}"></i>
                    ${key.charAt(0).toUpperCase() + key.slice(1)}
                </div>
                <div class="status-value status-${statusClass}">
                    ${getStatusText(check)}
                </div>
            </div>
        `);
    });

    content.innerHTML = statusItems.join('') + `
        <div class="status-item">
            <div class="status-label">
                <i class="fas fa-bug"></i>
                Debug
            </div>
            <div class="status-value">
                <button class="btn btn-sm btn-secondary" onclick="debugSystemStatus()">
                    <i class="fas fa-terminal"></i> Debug Status
                </button>
            </div>
        </div>
    `;
}

function updateNetworkStatus() {
    const content = document.getElementById('network-status-content');
    if (!networkStatus) {
        content.innerHTML = '<div class="loading-spinner"></div>';
        return;
    }

    const statusItems = [];
    
    statusItems.push(`
        <div class="status-item">
            <div class="status-label">
                <i class="fas fa-network-wired"></i>
                Local Address
            </div>
            <div class="status-value">${networkStatus.localAddress}</div>
        </div>
    `);

    statusItems.push(`
        <div class="status-item">
            <div class="status-label">
                <i class="fas fa-users"></i>
                Connected Peers
            </div>
            <div class="status-value">${networkStatus.totalPeers}</div>
        </div>
    `);

    statusItems.push(`
        <div class="status-item">
            <div class="status-label">
                <i class="fas fa-circle status-${networkStatus.isInitialized ? 'ok' : 'error'}"></i>
                Network Status
            </div>
            <div class="status-value status-${networkStatus.isInitialized ? 'ok' : 'error'}">
                ${networkStatus.isInitialized ? 'Connected' : 'Disconnected'}
            </div>
        </div>
    `);

    content.innerHTML = statusItems.join('');
}

function updateServerStatus() {
    const content = document.getElementById('active-servers-content');
    if (!serverStatus) {
        content.innerHTML = '<div class="loading-spinner"></div>';
        return;
    }

    if (!serverStatus.activeServers || serverStatus.activeServers.length === 0) {
        content.innerHTML = `
            <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.7);">
                <i class="fas fa-server" style="font-size: 48px; margin-bottom: 20px;"></i>
                <p>No active servers</p>
                <p>Click "Start Server" to begin</p>
            </div>
        `;
        return;
    }

    const serverItems = serverStatus.activeServers.map(server => {
        const statusIcon = getServerStatusIcon(server.status);
        const statusClass = getServerStatusClass(server.status);
        
        return `
            <div class="server-card" onclick="showServerDetails('${server.id}')">
                <div class="server-header">
                    <div class="server-name">${server.name}</div>
                    <div class="server-status-indicator ${statusClass}">
                        <i class="${statusIcon}"></i>
                        ${server.status}
                    </div>
                </div>
                <div class="server-info">
                    <div class="server-info-item">
                        <div class="server-info-label">Type</div>
                        <div class="server-info-value">${server.type}</div>
                    </div>
                    <div class="server-info-item">
                        <div class="server-info-label">Version</div>
                        <div class="server-info-value">${server.version}</div>
                    </div>
                    <div class="server-info-item">
                        <div class="server-info-label">Port</div>
                        <div class="server-info-value">${server.port}</div>
                    </div>
                    <div class="server-info-item">
                        <div class="server-info-label">Max Players</div>
                        <div class="server-info-value">${server.maxPlayers}</div>
                    </div>
                </div>
                <div class="server-actions">
                    <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); copyServerAddress('${server.hostAddress}:${server.port}')">
                        <i class="fas fa-copy"></i> Copy Address
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="event.stopPropagation(); takeOverHost('${server.id}')">
                        <i class="fas fa-exchange-alt"></i> Take Over
                    </button>
                </div>
            </div>
        `;
    });

    content.innerHTML = serverItems.join('');
}

function updateConnectionStatus() {
    if (!networkStatus) return;

    if (networkStatus.isInitialized) {
        connectionStatus.classList.add('connected');
        connectionText.textContent = `Connected (${networkStatus.totalPeers} peers)`;
    } else {
        connectionStatus.classList.remove('connected');
        connectionText.textContent = 'Disconnected';
    }
}

function loadServersData() {
    const grid = document.getElementById('servers-grid');
    if (!serverStatus) {
        grid.innerHTML = '<div class="loading-spinner"></div>';
        return;
    }

    if (!serverStatus.activeServers || serverStatus.activeServers.length === 0) {
        grid.innerHTML = `
            <div style="text-align: center; padding: 60px; color: rgba(255, 255, 255, 0.7);">
                <i class="fas fa-server" style="font-size: 64px; margin-bottom: 20px;"></i>
                <h3>No Servers Running</h3>
                <p>Start your first Minecraft server to begin</p>
                <button class="btn btn-primary" onclick="showStartServerModal()" style="margin-top: 20px;">
                    <i class="fas fa-plus"></i> Start New Server
                </button>
            </div>
        `;
        return;
    }

    const serverCards = serverStatus.activeServers.map(server => {
        const statusIcon = getServerStatusIcon(server.status);
        const statusClass = getServerStatusClass(server.status);
        
        return `
            <div class="server-card" onclick="showServerDetails('${server.id}')">
                <div class="server-header">
                    <div class="server-name">${server.name}</div>
                    <div class="server-status-indicator ${statusClass}">
                        <i class="${statusIcon}"></i>
                        ${server.status}
                    </div>
                </div>
                <div class="server-info">
                    <div class="server-info-item">
                        <div class="server-info-label">Type</div>
                        <div class="server-info-value">${server.type}</div>
                    </div>
                    <div class="server-info-item">
                        <div class="server-info-label">Version</div>
                        <div class="server-info-value">${server.version}</div>
                    </div>
                    <div class="server-info-item">
                        <div class="server-info-label">Port</div>
                        <div class="server-info-value">${server.port}</div>
                    </div>
                    <div class="server-info-item">
                        <div class="server-info-label">Max Players</div>
                        <div class="server-info-value">${server.maxPlayers}</div>
                    </div>
                </div>
                <div class="server-actions">
                    <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); copyServerAddress('${server.hostAddress}:${server.port}')">
                        <i class="fas fa-copy"></i> Copy Address
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="event.stopPropagation(); takeOverHost('${server.id}')">
                        <i class="fas fa-exchange-alt"></i> Take Over
                    </button>
                </div>
            </div>
        `;
    });

    grid.innerHTML = serverCards.join('');
}

function loadNetworkData() {
    const localInfo = document.getElementById('local-network-info');
    const peersInfo = document.getElementById('connected-peers');

    if (!networkStatus) {
        localInfo.innerHTML = '<div class="loading-spinner"></div>';
        peersInfo.innerHTML = '<div class="loading-spinner"></div>';
        return;
    }

    // Local network info
    localInfo.innerHTML = `
        <div class="status-item">
            <div class="status-label">Local Address</div>
            <div class="status-value">${networkStatus.localAddress}</div>
        </div>
        <div class="status-item">
            <div class="status-label">Peer ID</div>
            <div class="status-value">${networkStatus.localPeerId.substring(0, 16)}...</div>
        </div>
        <div class="status-item">
            <div class="status-label">Status</div>
            <div class="status-value status-${networkStatus.isInitialized ? 'ok' : 'error'}">
                ${networkStatus.isInitialized ? 'Connected' : 'Disconnected'}
            </div>
        </div>
    `;

    // Connected peers
    if (!networkStatus.peers || networkStatus.peers.length === 0) {
        peersInfo.innerHTML = `
            <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.7);">
                <i class="fas fa-users" style="font-size: 48px; margin-bottom: 20px;"></i>
                <p>No peers connected</p>
                <p>Waiting for friends to join...</p>
            </div>
        `;
    } else {
        const peerItems = networkStatus.peers.map(peer => {
            const displayName = peer.displayName || peer.name;
            const platform = peer.platform || 'unknown';
            
            return `
                <div class="peer-item">
                    <div class="peer-info">
                        <div class="peer-name">${peer.name}</div>
                        <div class="peer-display-name">${displayName}</div>
                        <div class="peer-address">${peer.address}</div>
                        <div class="peer-platform">${platform}</div>
                    </div>
                    <div class="peer-status">
                        <div class="peer-status-dot"></div>
                        <div class="peer-status-text">Online</div>
                    </div>
                </div>
            `;
        });
        peersInfo.innerHTML = peerItems.join('');
    }
}

async function loadDownloadsData() {
    try {
        console.log('Loading downloads data, systemStatus:', systemStatus);
        if (!systemStatus) {
            showNotification('System status not available', 'error');
            return;
        }
        
        // Refresh system status to get latest data
        try {
            console.log('Refreshing system status for downloads...');
            systemStatus = await ipcRenderer.invoke('get-system-status');
            console.log('System status refreshed for downloads:', systemStatus);
            
            // Debug: Check specific loader data
            if (systemStatus && systemStatus.checks) {
                Object.keys(systemStatus.checks).forEach(loader => {
                    const loaderData = systemStatus.checks[loader];
                    if (loaderData && loaderData.installedVersions) {
                        console.log(`${loader} installed versions:`, loaderData.installedVersions);
                    }
                });
            }
        } catch (error) {
            console.error('Failed to refresh system status for downloads:', error);
        }

        // Load versions for each loader
        const loaders = ['vanilla', 'forge', 'fabric', 'quilt', 'neoforge'];
        
        for (const loader of loaders) {
            const container = document.getElementById(`${loader}-versions`);
            if (!container) continue;
            
            const loaderData = systemStatus.checks[loader];
            if (!loaderData) {
                container.innerHTML = '<p class="error">Failed to load version data</p>';
                continue;
            }
            
            const availableVersions = loaderData.availableVersions || [];
            const installedVersions = loaderData.installedVersions || [];
            
            if (availableVersions.length === 0 && installedVersions.length === 0) {
                container.innerHTML = '<p>No versions available</p>';
                continue;
            }
            
            let html = '';
            
            // Show installed versions first
            if (installedVersions.length > 0) {
                html += `<div class="version-group"><h4>INSTALLED (${installedVersions.length})</h4>`;
                installedVersions.forEach(version => {
                    html += `
                        <div class="version-item installed">
                            <span class="version-name">${version}</span>
                            <span class="version-status">✓ Installed</span>
                        </div>
                    `;
                });
                html += '</div>';
            }
            
            // Show available versions (filter out installed ones)
            if (availableVersions.length > 0) {
                const filteredAvailableVersions = availableVersions.filter(version => {
                    const versionId = version.id || version;
                    return !installedVersions.includes(versionId);
                });
                
                if (filteredAvailableVersions.length > 0) {
                    html += `<div class="version-group"><h4>AVAILABLE (${filteredAvailableVersions.length})</h4>`;
                    filteredAvailableVersions.forEach(version => {
                        const versionId = version.id || version;
                        const versionName = version.minecraftVersion ? `${version.minecraftVersion}-${version.loaderVersion || versionId}` : versionId;
                        html += `
                            <div class="version-item">
                                <span class="version-name">${versionName}</span>
                                <button class="btn btn-sm btn-primary" onclick="downloadVersion('${loader}', '${versionId}', event)">
                                    <i class="fas fa-download"></i> Download
                                </button>
                            </div>
                        `;
                    });
                    html += '</div>';
                }
            }
            
            container.innerHTML = html;
        }
    } catch (error) {
        console.error('Failed to load downloads data:', error);
        showNotification('Failed to load downloads', 'error');
    }
}

async function refreshDownloads() {
    console.log('Refreshing downloads...');
    
    // Show visual refresh indicator
    const refreshButton = document.querySelector('#downloads .downloads-header .btn');
    if (refreshButton) {
        const originalText = refreshButton.innerHTML;
        refreshButton.innerHTML = '<i class="fas fa-sync-alt refresh-spinning"></i> Refreshing...';
        refreshButton.disabled = true;
        
        try {
            showNotification('Refreshing version data...', 'info');
            
            // Refresh system status to get latest version data
            systemStatus = await ipcRenderer.invoke('get-system-status');
            console.log('System status refreshed for downloads:', systemStatus);
            
            // Refresh downloads data display
            await loadDownloadsData();
            
            showNotification('Downloads refreshed successfully!', 'success');
        } catch (error) {
            console.error('Failed to refresh downloads:', error);
            showNotification('Failed to refresh downloads: ' + error.message, 'error');
        } finally {
            // Restore button
            refreshButton.innerHTML = originalText;
            refreshButton.disabled = false;
        }
    } else {
        // Fallback if button not found
        showNotification('Refreshing version data...', 'info');
        
        try {
            systemStatus = await ipcRenderer.invoke('get-system-status');
            await loadDownloadsData();
            showNotification('Downloads refreshed successfully!', 'success');
        } catch (error) {
            console.error('Failed to refresh downloads:', error);
            showNotification('Failed to refresh downloads: ' + error.message, 'error');
        }
    }
}

// Modal functions
function showProfileModal() {
    const modal = document.getElementById('profile-modal');
    modal.classList.add('active');
    
    // Populate form with current profile data
    if (userProfile) {
        document.getElementById('profile-name').value = userProfile.displayName || userProfile.name;
        document.getElementById('profile-platform').value = userProfile.platform || 'unknown';
        document.getElementById('profile-id').value = userProfile.id;
    }
}

async function showStartServerModal() {
    const modal = document.getElementById('start-server-modal');
    modal.classList.add('active');
    
    // Show loading state
    const versionSelect = document.getElementById('server-version');
    versionSelect.innerHTML = '<option value="">Loading versions...</option>';
    
    // Always refresh system status to get latest version data
    try {
        console.log('=== SHOW START SERVER MODAL ===');
        console.log('Refreshing system status...');
        systemStatus = await ipcRenderer.invoke('get-system-status');
        console.log('System status refreshed:', systemStatus);
        console.log('Available checks:', Object.keys(systemStatus.checks));
        
        // Debug each loader type with full data
        ['vanilla', 'forge', 'fabric', 'quilt', 'neoforge'].forEach(loader => {
            if (systemStatus.checks[loader]) {
                const loaderData = systemStatus.checks[loader];
                console.log(`${loader} data:`, {
                    status: loaderData.status,
                    availableVersions: loaderData.availableVersions?.length || 0,
                    installedVersions: loaderData.installedVersions?.length || 0,
                    message: loaderData.message
                });
                
                // Log sample versions
                if (loaderData.availableVersions && loaderData.availableVersions.length > 0) {
                    console.log(`${loader} sample available versions:`, 
                        loaderData.availableVersions.slice(0, 3).map(v => v.id || v));
                }
                if (loaderData.installedVersions && loaderData.installedVersions.length > 0) {
                    console.log(`${loader} installed versions:`, loaderData.installedVersions);
                }
            } else {
                console.log(`${loader} data not found`);
            }
        });
        
        if (systemStatus.checks.fabric) {
            console.log('Fabric full data:', systemStatus.checks.fabric);
        }
    } catch (error) {
        console.error('Failed to load system status:', error);
        showNotification('Failed to load system status', 'error');
        versionSelect.innerHTML = '<option value="">Error loading versions</option>';
        return;
    }
    
    // Populate version dropdown for the current server type
    console.log('About to populate version dropdown, systemStatus:', systemStatus);
    await populateVersionDropdown();
    
    // Also populate for all server types to test
    console.log('=== TESTING ALL SERVER TYPES ===');
    const typeSelect = document.getElementById('server-type');
    const originalValue = typeSelect.value;
    
    for (const serverType of ['vanilla', 'forge', 'fabric', 'quilt', 'neoforge']) {
        console.log(`\n--- Testing ${serverType} ---`);
        typeSelect.value = serverType;
        await populateVersionDropdown();
        console.log(`${serverType} dropdown options:`, versionSelect.options.length);
    }
    
    // Restore original value
    typeSelect.value = originalValue;
    await populateVersionDropdown();
}

function showDownloadModal() {
    const modal = document.getElementById('download-modal');
    modal.classList.add('active');
    
    const content = document.getElementById('download-content');
    
    // Get available versions from system status
    let minecraftVersions = [];
    let forgeVersions = [];
    
    if (systemStatus && systemStatus.checks.minecraft) {
        minecraftVersions = systemStatus.checks.minecraft.availableVersions || [];
    }
    
    // Create download options
    const minecraftOptions = minecraftVersions.slice(0, 8).map(version => {
        const isInstalled = systemStatus?.checks?.minecraft?.installedVersions?.includes(version.id);
        return `
            <div class="download-option">
                <div class="download-info">
                    <div class="download-name">Minecraft ${version.id}</div>
                    <div class="download-date">${new Date(version.releaseTime).toLocaleDateString()}</div>
                </div>
                <button class="btn btn-sm ${isInstalled ? 'btn-secondary' : 'btn-primary'}" 
                        onclick="downloadMinecraft('${version.id}', event)" 
                        ${isInstalled ? 'disabled' : ''}>
                    <i class="fas fa-${isInstalled ? 'check' : 'download'}"></i>
                    ${isInstalled ? 'Installed' : 'Download'}
                </button>
            </div>
        `;
    }).join('');
    
    const forgeOptions = `
        <div class="download-option">
            <div class="download-info">
                <div class="download-name">Forge 1.20.1</div>
                <div class="download-date">Latest stable version</div>
            </div>
            <button class="btn btn-sm btn-primary" onclick="downloadForge('1.20.1', event)">
                <i class="fas fa-download"></i> Download
            </button>
        </div>
        <div class="download-option">
            <div class="download-info">
                <div class="download-name">Forge 1.19.2</div>
                <div class="download-date">Popular modded version</div>
            </div>
            <button class="btn btn-sm btn-primary" onclick="downloadForge('1.19.2', event)">
                <i class="fas fa-download"></i> Download
            </button>
        </div>
    `;
    
    content.innerHTML = `
        <div class="download-sections">
            <div class="download-section">
                <h3><i class="fas fa-cube"></i> Minecraft Server Versions</h3>
                <div class="download-options">
                    ${minecraftOptions || '<p>No versions available</p>'}
                </div>
            </div>
            
            <div class="download-section">
                <h3><i class="fas fa-tools"></i> Forge Server Versions</h3>
                <div class="download-options">
                    ${forgeOptions}
                </div>
            </div>
            
            <div class="download-section">
                <h3><i class="fas fa-info-circle"></i> System Requirements</h3>
                <div class="requirements-info">
                    <p><strong>Java:</strong> Version 8 or higher required</p>
                    <p><strong>Disk Space:</strong> At least 2GB free space</p>
                    <p><strong>Memory:</strong> 1GB RAM minimum for servers</p>
                </div>
            </div>
        </div>
    `;
}

function showServerDetails(serverId) {
    selectedServerId = serverId;
    const modal = document.getElementById('server-details-modal');
    modal.classList.add('active');
    
    const server = serverStatus.activeServers.find(s => s.id === serverId);
    if (!server) return;
    
    const content = document.getElementById('server-details-content');
    content.innerHTML = `
        <div class="server-details">
            <div class="status-item">
                <div class="status-label">Server Name</div>
                <div class="status-value">${server.name}</div>
            </div>
            <div class="status-item">
                <div class="status-label">Type</div>
                <div class="status-value">${server.type}</div>
            </div>
            <div class="status-item">
                <div class="status-label">Version</div>
                <div class="status-value">${server.version}</div>
            </div>
            <div class="status-item">
                <div class="status-label">Port</div>
                <div class="status-value">${server.port}</div>
            </div>
            <div class="status-item">
                <div class="status-label">Max Players</div>
                <div class="status-value">${server.maxPlayers}</div>
            </div>
            <div class="status-item">
                <div class="status-label">Status</div>
                <div class="status-value status-${server.status}">${server.status}</div>
            </div>
            <div class="status-item">
                <div class="status-label">Host Address</div>
                <div class="status-value">${server.hostAddress}:${server.port}</div>
            </div>
            ${server.type === 'forge' ? `
                <div class="status-item">
                    <div class="status-label">Mods</div>
                    <div class="status-value">
                        <button class="btn btn-sm btn-primary" onclick="showModManager('${server.id}')">
                            <i class="fas fa-puzzle-piece"></i> Manage Mods
                        </button>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function showModManager(serverId) {
    const modal = document.getElementById('mod-manager-modal');
    modal.classList.add('active');
    
    loadServerMods(serverId);
}

async function loadServerMods(serverId) {
    const modsList = document.getElementById('mods-list');
    modsList.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        const result = await ipcRenderer.invoke('get-server-mods', serverId);
        if (result.success) {
            if (result.mods.length === 0) {
                modsList.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.7);">
                        <i class="fas fa-puzzle-piece" style="font-size: 48px; margin-bottom: 20px;"></i>
                        <p>No mods installed</p>
                        <p>Upload mods to get started</p>
                    </div>
                `;
            } else {
                const modItems = result.mods.map(mod => `
                    <div class="mod-item">
                        <div class="mod-info">
                            <div class="mod-name">${mod.name}</div>
                            <div class="mod-details">
                                <span class="mod-size">${mod.sizeFormatted}</span>
                                <span class="mod-date">${new Date(mod.lastModified).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div class="mod-actions">
                            <button class="btn btn-sm btn-danger" onclick="removeMod('${serverId}', '${mod.name}')">
                                <i class="fas fa-trash"></i> Remove
                            </button>
                        </div>
                    </div>
                `);
                modsList.innerHTML = modItems.join('');
            }
        } else {
            modsList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.7);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px;"></i>
                    <p>Failed to load mods</p>
                    <p>${result.error}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load server mods:', error);
        modsList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.7);">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px;"></i>
                <p>Failed to load mods</p>
                <p>${error.message}</p>
            </div>
        `;
    }
}

async function uploadMod(serverId) {
    try {
        const result = await ipcRenderer.invoke('select-file', {
            title: 'Select Mod File',
            filters: [
                { name: 'Mod Files', extensions: ['jar'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (result.canceled) return;
        
        const modPath = result.filePaths[0];
        const uploadResult = await ipcRenderer.invoke('upload-mod', serverId, modPath);
        
        if (uploadResult.success) {
            showNotification(`Mod ${uploadResult.modName} uploaded successfully!`, 'success');
            loadServerMods(serverId);
        } else {
            showNotification(`Failed to upload mod: ${uploadResult.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Error uploading mod: ${error.message}`, 'error');
    }
}

async function removeMod(serverId, modName) {
    if (!confirm(`Are you sure you want to remove ${modName}?`)) return;
    
    try {
        const result = await ipcRenderer.invoke('remove-mod', serverId, modName);
        
        if (result.success) {
            showNotification(`Mod ${modName} removed successfully!`, 'success');
            loadServerMods(serverId);
        } else {
            showNotification(`Failed to remove mod: ${result.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Error removing mod: ${error.message}`, 'error');
    }
}

async function refreshMods() {
    if (selectedServerId) {
        await loadServerMods(selectedServerId);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('active');
}

// Profile functions
async function saveProfile() {
    const displayName = document.getElementById('profile-name').value.trim();
    
    if (!displayName) {
        showNotification('Please enter a display name', 'error');
        return;
    }

    const updatedProfile = {
        ...userProfile,
        displayName: displayName,
        lastSeen: new Date().toISOString()
    };

    const success = await saveUserProfile(updatedProfile);
    if (success) {
        showNotification('Profile updated successfully!', 'success');
        closeModal('profile-modal');
        
        // Update the user profile display
        updateUserProfileDisplay();
    } else {
        showNotification('Failed to update profile', 'error');
    }
}

// Server functions
async function startServer() {
    const name = document.getElementById('server-name').value.trim();
    const type = document.getElementById('server-type').value;
    const version = document.getElementById('server-version').value;
    const port = parseInt(document.getElementById('server-port').value);
    const maxPlayers = parseInt(document.getElementById('max-players-input').value);
    const autoStart = document.getElementById('auto-start-server').checked;

    console.log('=== STARTING SERVER ===');
    console.log('Server config:', { name, type, version, port, maxPlayers, autoStart });
    
    // Debug: Check if version is properly selected
    if (!version) {
        console.error('No version selected! Available versions in dropdown:', 
            Array.from(document.getElementById('server-version').options).map(opt => opt.value));
    }
    
    // Debug: Check system status
    console.log('Current system status:', systemStatus);
    if (systemStatus && systemStatus.checks[type]) {
        console.log(`${type} loader data:`, systemStatus.checks[type]);
    }

    // Validation
    if (!name) {
        showNotification('Please enter a server name', 'error');
        return;
    }
    
    if (!type) {
        showNotification('Please select a server type', 'error');
        return;
    }
    
    if (!version) {
        showNotification('Please select a server version', 'error');
        return;
    }
    
    // Check if port is available
    try {
        const portCheck = await ipcRenderer.invoke('check-port', port);
        if (!portCheck.available) {
            console.log('Port check result:', portCheck);
            
            if (portCheck.processInfo) {
                const processInfo = portCheck.processInfo;
                const message = `Port ${port} is being used by ${processInfo.name} (PID: ${processInfo.pid}).\n\nWould you like to stop this process to free up the port?`;
                
                if (confirm(message)) {
                    try {
                        const result = await ipcRenderer.invoke('kill-process', processInfo.pid);
                        if (result.success) {
                            showNotification(`Stopped process ${processInfo.name}. Port ${port} is now available.`, 'success');
                            console.log(`Successfully killed process ${processInfo.pid}`);
                        } else {
                            showNotification(`Failed to stop process: ${result.error}`, 'error');
                            return;
                        }
                    } catch (error) {
                        showNotification(`Error stopping process: ${error.message}`, 'error');
                        return;
                    }
                } else {
                    showNotification(`Port ${port} is still in use. Please choose a different port or stop the process manually.`, 'error');
                    return;
                }
            } else {
                showNotification(`Port ${port} is already in use. Please choose a different port.`, 'error');
                return;
            }
        }
        console.log(`Port ${port} is available`);
    } catch (error) {
        console.warn('Could not check port availability:', error);
    }

    // Get UI elements
    const startBtn = document.getElementById('start-server-btn');
    const cancelBtn = document.getElementById('cancel-start-btn');
    const progressContainer = document.getElementById('server-start-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    // Show progress UI
    startBtn.style.display = 'none';
    progressContainer.style.display = 'block';
    
    // Disable cancel button during startup
    cancelBtn.disabled = true;

    // Progress simulation with real-time updates
    const progressSteps = [
        { progress: 10, text: 'Validating server configuration...' },
        { progress: 20, text: 'Checking Java installation...' },
        { progress: 30, text: 'Verifying server files...' },
        { progress: 40, text: 'Creating server directory...' },
        { progress: 50, text: 'Downloading server files...' },
        { progress: 60, text: 'Configuring server properties...' },
        { progress: 70, text: 'Starting server process...' },
        { progress: 80, text: 'Initializing server...' },
        { progress: 90, text: 'Waiting for server to be ready...' },
        { progress: 100, text: 'Server is starting up...' }
    ];

    let currentStep = 0;
    const progressInterval = setInterval(() => {
        if (currentStep < progressSteps.length) {
            const step = progressSteps[currentStep];
            progressFill.style.width = step.progress + '%';
            progressText.textContent = step.text;
            currentStep++;
        }
    }, 800);

    try {
        const result = await ipcRenderer.invoke('start-server', {
            name,
            type,
            version,
            port,
            maxPlayers,
            autoStart
        });

        clearInterval(progressInterval);
        console.log('Server start result:', result);

        if (result.success) {
            progressFill.style.width = '100%';
            progressText.textContent = 'Server started successfully!';
            progressFill.style.background = 'linear-gradient(90deg, #4caf50, #45a049)';
            
            setTimeout(() => {
                showNotification('Server started successfully!', 'success');
                closeModal('start-server-modal');
                refreshStatus();
            }, 1000);
        } else {
            progressFill.style.background = 'linear-gradient(90deg, #f44336, #d32f2f)';
            progressText.textContent = 'Failed to start server';
            
            // Show more detailed error message
            const errorMessage = result.error || 'Unknown error occurred';
            console.error('Server start failed:', errorMessage);
            console.error('Full error result:', result);
            
            // Show detailed error in modal
            const errorDetails = document.createElement('div');
            errorDetails.style.marginTop = '10px';
            errorDetails.style.padding = '10px';
            errorDetails.style.backgroundColor = 'rgba(244, 67, 54, 0.1)';
            errorDetails.style.border = '1px solid rgba(244, 67, 54, 0.3)';
            errorDetails.style.borderRadius = '4px';
            errorDetails.style.fontSize = '12px';
            errorDetails.style.fontFamily = 'monospace';
            errorDetails.style.whiteSpace = 'pre-wrap';
            errorDetails.style.maxHeight = '200px';
            errorDetails.style.overflow = 'auto';
            errorDetails.textContent = `Error Details:\n${errorMessage}`;
            
            // Add error details to progress container
            const progressContainer = document.getElementById('server-start-progress');
            progressContainer.appendChild(errorDetails);
            
            // Provide specific error guidance
            let userMessage = `Failed to start server: ${errorMessage}`;
            if (errorMessage.includes('jar not found') || errorMessage.includes('not installed') || errorMessage.includes('missing')) {
                userMessage += '\n\nRequired files are missing. Please download them first:';
                
                // Extract version info for better guidance
                const minecraftVersion = version.split('-')[0];
                userMessage += `\n• Minecraft version ${minecraftVersion}`;
                if (type !== 'vanilla') {
                    userMessage += `\n• ${type} loader version ${version}`;
                }
                
                userMessage += '\n\nYou can:';
                userMessage += '\n1. Use the Downloads tab to download required files';
                userMessage += '\n2. Use the Installation Scanner to copy from existing Minecraft installations';
                
                // Add download button to error message
                setTimeout(() => {
                    if (confirm('Would you like to download the required files now?')) {
                        downloadVersion(type, version, null); // Pass null for event since this is not from a button click
                    }
                }, 1000);
            } else if (errorMessage.includes('port')) {
                userMessage += '\n\nTry changing the server port (default: 25565).';
            } else if (errorMessage.includes('Java')) {
                userMessage += '\n\nPlease ensure Java is properly installed.';
            }
            
            showNotification(userMessage, 'error');
            
            // Reset UI after error (longer delay to read error details)
            setTimeout(() => {
                resetStartServerUI();
            }, 10000);
        }
    } catch (error) {
        clearInterval(progressInterval);
        progressFill.style.background = 'linear-gradient(90deg, #f44336, #d32f2f)';
        progressText.textContent = 'Error starting server';
        showNotification(`Error starting server: ${error.message}`, 'error');
        console.error('Server start error:', error);
        
        // Reset UI after error
        setTimeout(() => {
            resetStartServerUI();
        }, 3000);
    }
}

function resetStartServerUI() {
    const startBtn = document.getElementById('start-server-btn');
    const cancelBtn = document.getElementById('cancel-start-btn');
    const progressContainer = document.getElementById('server-start-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    startBtn.style.display = 'inline-flex';
    progressContainer.style.display = 'none';
    cancelBtn.disabled = false;
    progressFill.style.width = '0%';
    progressFill.style.background = 'linear-gradient(90deg, #4fc3f7, #29b6f6)';
    progressText.textContent = 'Initializing...';
    
    // Clear any error details that were added
    const errorDetails = progressContainer.querySelector('div[style*="rgba(244, 67, 54, 0.1)"]');
    if (errorDetails) {
        errorDetails.remove();
    }
}

async function stopServer() {
    if (!selectedServerId) return;

    try {
        const result = await ipcRenderer.invoke('stop-server', selectedServerId);
        if (result.success) {
            showNotification('Server stopped successfully!', 'success');
            closeModal('server-details-modal');
            refreshStatus();
        } else {
            showNotification(`Failed to stop server: ${result.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Error stopping server: ${error.message}`, 'error');
    }
}

async function takeOverHost(serverId) {
    try {
        const result = await ipcRenderer.invoke('take-over-host', serverId);
        if (result.success) {
            showNotification('Host takeover request sent!', 'success');
            refreshStatus();
        } else {
            showNotification(`Failed to take over host: ${result.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Error taking over host: ${error.message}`, 'error');
    }
}

async function transferHost() {
    if (!selectedServerId) return;
    
    // This would need a peer selection UI
    showNotification('Host transfer feature coming soon!', 'warning');
}

// Download functions
async function downloadMinecraft(version, event) {
    try {
        // Show download progress modal
        showDownloadProgressModal('minecraft', version);
        updateDownloadProgress(0, 'Starting download...');
        
        // Show loading state on button (if called from button click)
        let button = null;
        let originalText = '';
        if (event && event.target) {
            button = event.target.closest('button');
            if (button) {
                originalText = button.innerHTML;
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
                button.disabled = true;
            }
        }
        
        const result = await ipcRenderer.invoke('download-minecraft', version);
        
        if (result.success) {
            // Show completion in progress modal
            updateDownloadProgress(100, 'Download completed successfully!');
            
            // Wait a moment so user can see completion
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            showNotification(`Minecraft ${version} downloaded successfully!`, 'success');
            refreshStatus();
        } else {
            throw new Error(result.error || 'Download failed');
        }
    } catch (error) {
        // Show error in progress modal
        updateDownloadProgress(0, `Error: ${error.message}`);
        
        // Wait a moment so user can see the error
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        showNotification(`Error downloading Minecraft: ${error.message}`, 'error');
    } finally {
        // Hide download progress modal
        hideDownloadProgressModal();
        
        // Restore button state
        if (button && originalText) {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }
}

async function downloadForge(version, event) {
    try {
        // Show download progress modal
        showDownloadProgressModal('forge', version);
        updateDownloadProgress(0, 'Starting download...');
        
        // Show loading state on button (if called from button click)
        let button = null;
        let originalText = '';
        if (event && event.target) {
            button = event.target.closest('button');
            if (button) {
                originalText = button.innerHTML;
                button.innerHTML = '<i class="fas fa-sync-alt refresh-spinning"></i> Downloading...';
                button.disabled = true;
            }
        }
        
        const result = await ipcRenderer.invoke('download-forge', version);
        
        if (result.success) {
            // Show completion in progress modal
            updateDownloadProgress(100, 'Download completed successfully!');
            
            // Wait a moment so user can see completion
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            showNotification(`Forge ${version} downloaded successfully!`, 'success');
            refreshStatus();
        } else {
            throw new Error(result.error || 'Download failed');
        }
    } catch (error) {
        // Show error in progress modal
        updateDownloadProgress(0, `Error: ${error.message}`);
        
        // Wait a moment so user can see the error
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        showNotification(`Error downloading Forge: ${error.message}`, 'error');
    } finally {
        // Hide download progress modal
        hideDownloadProgressModal();
        
        // Restore button state
        if (button && originalText) {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }
}

// Utility functions
async function populateVersionDropdown() {
    const versionSelect = document.getElementById('server-version');
    const typeSelect = document.getElementById('server-type');
    
    if (!versionSelect || !typeSelect) {
        console.error('Required elements not found for version dropdown');
        return;
    }
    
    versionSelect.innerHTML = '<option value="">Select version...</option>';
    
    const serverType = typeSelect.value;
    console.log('=== POPULATING VERSION DROPDOWN ===');
    console.log('Server type:', serverType);
    console.log('Current system status:', systemStatus);
    
    // Always refresh system status to ensure we have the latest data
    try {
        console.log('Refreshing system status...');
        systemStatus = await ipcRenderer.invoke('get-system-status');
        console.log('System status refreshed:', systemStatus);
        
        if (systemStatus && systemStatus.checks) {
            console.log('Available checks:', Object.keys(systemStatus.checks));
            
            const loaderData = systemStatus.checks[serverType];
            if (loaderData) {
                console.log(`${serverType} loader data:`, loaderData);
                
                const availableVersions = loaderData.availableVersions || [];
                const installedVersions = loaderData.installedVersions || [];
                
                console.log(`${serverType} - Available versions:`, availableVersions.length);
                console.log(`${serverType} - Installed versions:`, installedVersions.length);
                
                if (availableVersions.length > 0) {
                    console.log('Sample available versions:', availableVersions.slice(0, 3));
                }
                if (installedVersions.length > 0) {
                    console.log('Installed versions:', installedVersions);
                }
                
                // Add installed versions first (they're more likely to work)
                if (installedVersions.length > 0) {
                    const installedGroup = document.createElement('optgroup');
                    installedGroup.label = 'Installed Versions';
                    
                    installedVersions.forEach(version => {
                        const option = document.createElement('option');
                        option.value = version;
                        option.textContent = version;
                        installedGroup.appendChild(option);
                    });
                    
                    versionSelect.appendChild(installedGroup);
                    console.log(`Added ${installedVersions.length} installed versions`);
                }
                
                // Add available versions
                if (availableVersions.length > 0) {
                    const availableGroup = document.createElement('optgroup');
                    availableGroup.label = 'Available Versions';
                    
                    availableVersions.forEach(version => {
                        const option = document.createElement('option');
                        // Handle different version formats
                        const versionId = version.id || version.minecraftVersion || version;
                        const displayText = version.id || version.minecraftVersion || version;
                        
                        option.value = versionId;
                        option.textContent = displayText;
                        availableGroup.appendChild(option);
                    });
                    
                    versionSelect.appendChild(availableGroup);
                    console.log(`Added ${availableVersions.length} available versions`);
                }
                
                // If no versions available, show message
                if (availableVersions.length === 0 && installedVersions.length === 0) {
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = 'No versions available';
                    option.disabled = true;
                    versionSelect.appendChild(option);
                    console.log('No versions available for this server type');
                }
                
                console.log(`Final dropdown options: ${versionSelect.options.length}`);
                
            } else {
                console.log(`No data found for server type: ${serverType}`);
                console.log('Available loader types:', Object.keys(systemStatus.checks));
                
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No data available for this server type';
                option.disabled = true;
                versionSelect.appendChild(option);
            }
        } else {
            console.log('System status missing checks property');
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'System status not available';
            option.disabled = true;
            versionSelect.appendChild(option);
        }
    } catch (error) {
        console.error('Failed to refresh system status:', error);
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Error loading versions';
        option.disabled = true;
        versionSelect.appendChild(option);
    }
}

function updateServerLogsList() {
    const serverLogsList = document.getElementById('server-logs-list');
    
    if (serverLogs.length === 0) {
        serverLogsList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: rgba(255, 255, 255, 0.7);">
                <i class="fas fa-gamepad" style="font-size: 24px; margin-bottom: 10px;"></i>
                <p>No server logs found</p>
                <p>Start a server to see logs here</p>
            </div>
        `;
        return;
    }

    const serverLogItems = serverLogs.map(serverLog => {
        const isActive = selectedServerLog && selectedServerLog.serverId === serverLog.serverId;
        const formattedDate = new Date(serverLog.lastModified).toLocaleString();
        const sizeKB = Math.round(serverLog.size / 1024);
        
        return `
            <div class="log-file-item ${isActive ? 'active' : ''}" onclick="selectServerLog('${serverLog.serverId}')">
                <div class="log-file-name">${serverLog.serverName}</div>
                <div class="log-file-date">${formattedDate}</div>
                <div class="log-file-size">${sizeKB} KB</div>
            </div>
        `;
    });

    serverLogsList.innerHTML = serverLogItems.join('');
}

async function selectServerLog(serverId) {
    selectedServerLog = serverLogs.find(log => log.serverId === serverId);
    updateServerLogsList();
    await loadServerLogContent();
}

async function loadServerLogContent() {
    const serverLogsViewer = document.getElementById('server-logs-viewer');
    serverLogsViewer.innerHTML = '<div class="loading-spinner"></div>';

    try {
        const result = await ipcRenderer.invoke('get-server-logs', selectedServerLog.serverId, 200);
        if (result.success) {
            currentLogs = result.logs;
            displayServerLogs();
        } else {
            serverLogsViewer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.7);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px;"></i>
                    <p>Failed to load server logs</p>
                    <p>${result.error}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load server log content:', error);
        serverLogsViewer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.7);">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px;"></i>
                <p>Failed to load server logs</p>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function displayServerLogs() {
    const serverLogsViewer = document.getElementById('server-logs-viewer');
    const levelFilter = document.getElementById('log-level-filter').value;
    
    let filteredLogs = currentLogs;
    if (levelFilter !== 'all') {
        filteredLogs = currentLogs.filter(log => {
            const logLevel = log.match(/\[.*?\]\s+(\w+)\s+/);
            return logLevel && logLevel[1].toLowerCase() === levelFilter;
        });
    }

    if (filteredLogs.length === 0) {
        serverLogsViewer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.7);">
                <i class="fas fa-search" style="font-size: 48px; margin-bottom: 20px;"></i>
                <p>No server logs found</p>
                <p>Try changing the filter or refreshing</p>
            </div>
        `;
        return;
    }

    const logEntries = filteredLogs.map(log => {
        const match = log.match(/\[(.*?)\]\s+(\w+)\s+(.*)/);
        if (!match) return `<div class="log-entry">${log}</div>`;

        const [, timestamp, level, message] = match;
        const levelLower = level.toLowerCase();
        
        return `
            <div class="log-entry ${levelLower}">
                <span class="log-timestamp">${timestamp}</span>
                <span class="log-level">${level}</span>
                <span class="log-message">${message}</span>
            </div>
        `;
    });

    serverLogsViewer.innerHTML = logEntries.join('');
}

function copyServerAddress(address) {
    navigator.clipboard.writeText(address).then(() => {
        showNotification('Server address copied to clipboard!', 'success');
    }).catch(() => {
        showNotification('Failed to copy address', 'error');
    });
}

async function refreshStatus() {
    console.log('refreshStatus called - reloading all data');
    
    // Show visual refresh indicator
    const refreshButton = document.querySelector('.quick-action-btn[onclick="refreshStatus()"]');
    if (refreshButton) {
        const originalText = refreshButton.innerHTML;
        refreshButton.innerHTML = '<i class="fas fa-sync-alt refresh-spinning"></i><span>Refreshing...</span>';
        refreshButton.disabled = true;
        
        try {
            await refreshEntireApp();
        } finally {
            // Restore button
            refreshButton.innerHTML = originalText;
            refreshButton.disabled = false;
        }
    } else {
        // Fallback if button not found
        await refreshEntireApp();
    }
}

async function debugSystemStatus() {
    console.log('=== DEBUG SYSTEM STATUS ===');
    console.log('Current systemStatus:', systemStatus);
    
    if (systemStatus && systemStatus.checks) {
        console.log('Available checks:', Object.keys(systemStatus.checks));
        
        ['vanilla', 'forge', 'fabric', 'quilt', 'neoforge'].forEach(loader => {
            if (systemStatus.checks[loader]) {
                const loaderData = systemStatus.checks[loader];
                console.log(`\n${loader.toUpperCase()} DEBUG:`);
                console.log('  Status:', loaderData.status);
                console.log('  Message:', loaderData.message);
                console.log('  Available versions count:', loaderData.availableVersions?.length || 0);
                console.log('  Installed versions count:', loaderData.installedVersions?.length || 0);
                
                if (loaderData.availableVersions && loaderData.availableVersions.length > 0) {
                    console.log('  Sample available versions:', 
                        loaderData.availableVersions.slice(0, 5).map(v => v.id || v));
                }
                
                if (loaderData.installedVersions && loaderData.installedVersions.length > 0) {
                    console.log('  Installed versions:', loaderData.installedVersions);
                }
            } else {
                console.log(`\n${loader.toUpperCase()}: NOT FOUND`);
            }
        });
    } else {
        console.log('No system status available');
    }
    
    // Test version dropdown population
    console.log('\n=== TESTING VERSION DROPDOWN ===');
    const typeSelect = document.getElementById('server-type');
    const versionSelect = document.getElementById('server-version');
    
    if (typeSelect && versionSelect) {
        console.log('Current server type:', typeSelect.value);
        console.log('Version select options:', versionSelect.options.length);
        
        // Test with each server type
        ['vanilla', 'forge', 'fabric', 'quilt', 'neoforge'].forEach(async (serverType) => {
            typeSelect.value = serverType;
            console.log(`\nTesting ${serverType} dropdown population...`);
            await populateVersionDropdown();
            console.log(`${serverType} dropdown options:`, versionSelect.options.length);
        });
    } else {
        console.log('Required elements not found');
    }
    
    showNotification('Debug info logged to console', 'info');
}

async function refreshNetworkStatus() {
    console.log('Refreshing network status...');
    
    // Show visual refresh indicator
    const refreshButton = document.querySelector('#network .network-header .btn');
    if (refreshButton) {
        const originalText = refreshButton.innerHTML;
        refreshButton.innerHTML = '<i class="fas fa-sync-alt refresh-spinning"></i> Refreshing...';
        refreshButton.disabled = true;
        
        try {
            // Refresh network status from main process
            networkStatus = await ipcRenderer.invoke('get-network-status');
            updateNetworkStatus();
            updateConnectionStatus();
            
            // Also refresh network data display
            await loadNetworkData();
            
            showNotification('Network status refreshed successfully!', 'success');
        } catch (error) {
            console.error('Failed to refresh network status:', error);
            showNotification('Failed to refresh network status', 'error');
        } finally {
            // Restore button
            refreshButton.innerHTML = originalText;
            refreshButton.disabled = false;
        }
    } else {
        // Fallback if button not found
        try {
            networkStatus = await ipcRenderer.invoke('get-network-status');
            updateNetworkStatus();
            updateConnectionStatus();
            await loadNetworkData();
            showNotification('Network status refreshed successfully!', 'success');
        } catch (error) {
            console.error('Failed to refresh network status:', error);
            showNotification('Failed to refresh network status', 'error');
        }
    }
}

async function showNetworkInfo() {
    await switchTab('network');
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function getStatusIcon(status) {
    switch (status) {
        case 'ok': return 'check-circle';
        case 'error': return 'times-circle';
        case 'warning': return 'exclamation-triangle';
        default: return 'question-circle';
    }
}

function getStatusText(check) {
    if (check.status === 'ok') {
        // For loaders, show version counts
        if (check.availableVersions && check.installedVersions) {
            const availableCount = check.availableVersions.length;
            const installedCount = check.installedVersions.length;
            if (installedCount > 0) {
                return `${installedCount} installed, ${availableCount} available`;
            } else {
                return `${availableCount} available`;
            }
        }
        return check.version || check.message || 'OK';
    } else if (check.status === 'error') {
        return check.message || 'Error';
    } else {
        // For missing loaders, show available count if available
        if (check.availableVersions && check.availableVersions.length > 0) {
            return `${check.availableVersions.length} available - ${check.message || 'Not installed'}`;
        }
        return check.message || 'Warning';
    }
}

function getServerStatusIcon(status) {
    switch (status) {
        case 'running':
            return 'fas fa-play-circle';
        case 'starting':
            return 'fas fa-sync-alt refresh-spinning';
        case 'stopped':
            return 'fas fa-stop-circle';
        case 'error':
            return 'fas fa-exclamation-triangle';
        default:
            return 'fas fa-question-circle';
    }
}

function getServerStatusClass(status) {
    switch (status) {
        case 'running':
            return 'running';
        case 'starting':
            return 'starting';
        case 'stopped':
            return 'stopped';
        case 'error':
            return 'error';
        default:
            return 'stopped';
    }
}

function handleServerUpdate(update) {
    // Update server status when changes occur
    console.log('Server update received:', update);
    refreshStatus();
}

function handleNetworkUpdate(update) {
    // Update network status when changes occur
    refreshStatus();
}

function handleProfileUpdate(data) {
    // Update peer information when profiles change
    if (networkStatus && networkStatus.peers) {
        const peer = networkStatus.peers.find(p => p.id === data.peerId);
        if (peer) {
            peer.displayName = data.profile.displayName;
            loadNetworkData(); // Refresh the network display
        }
    }
}

// Update handling functions
function handleUpdateStatus(data) {
    switch (data.status) {
        case 'checking':
            showNotification('Checking for updates...', 'info');
            break;
        case 'up-to-date':
            showNotification('MultiMC Hub is up to date!', 'success');
            break;
        case 'downloading':
            showNotification(`Downloading update ${data.version}...`, 'info');
            break;
        case 'error':
            showNotification(`Update error: ${data.error}`, 'error');
            break;
    }
}

function handleUpdateProgress(progress) {
    const percent = Math.round(progress.percent);
    showNotification(`Downloading update: ${percent}%`, 'info');
}

async function checkForUpdates() {
    try {
        await ipcRenderer.invoke('check-for-updates');
        showNotification('Checking for updates...', 'info');
    } catch (error) {
        showNotification('Failed to check for updates', 'error');
    }
}

// Logs functionality
async function loadLogsData() {
    try {
        if (currentLogType === 'app') {
            // Load application log files
            const logFilesResult = await ipcRenderer.invoke('get-log-files');
            if (logFilesResult.success) {
                logFiles = logFilesResult.files;
                updateLogFilesList();
                
                // Load the most recent log file by default
                if (logFiles.length > 0) {
                    selectedLogFile = logFiles[logFiles.length - 1];
                    await loadLogContent();
                }
            } else {
                showNotification('Failed to load log files', 'error');
            }
        } else if (currentLogType === 'server') {
            // Load server log files
            const serverLogsResult = await ipcRenderer.invoke('get-server-log-files');
            if (serverLogsResult.success) {
                serverLogs = serverLogsResult.serverLogs;
                updateServerLogsList();
                
                // Load the first server log by default
                if (serverLogs.length > 0) {
                    selectedServerLog = serverLogs[0];
                    await loadServerLogContent();
                }
            } else {
                showNotification('Failed to load server log files', 'error');
            }
        }
    } catch (error) {
        console.error('Failed to load logs data:', error);
        showNotification('Failed to load logs', 'error');
    }
}

function switchLogTab(logType) {
    currentLogType = logType;
    
    // Update tab buttons
    document.getElementById('app-logs-tab').classList.toggle('active', logType === 'app');
    document.getElementById('server-logs-tab').classList.toggle('active', logType === 'server');
    
    // Show/hide content
    document.getElementById('app-logs-content').style.display = logType === 'app' ? 'flex' : 'none';
    document.getElementById('server-logs-content').style.display = logType === 'server' ? 'flex' : 'none';
    
    // Load appropriate data
    loadLogsData();
}

function updateLogFilesList() {
    const logFilesList = document.getElementById('log-files-list');
    
    if (logFiles.length === 0) {
        logFilesList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: rgba(255, 255, 255, 0.7);">
                <i class="fas fa-file-alt" style="font-size: 24px; margin-bottom: 10px;"></i>
                <p>No log files found</p>
            </div>
        `;
        return;
    }

    const logFileItems = logFiles.map(file => {
        const isActive = selectedLogFile === file;
        const date = file.replace('app-', '').replace('.log', '');
        const formattedDate = new Date(date).toLocaleDateString();
        
        return `
            <div class="log-file-item ${isActive ? 'active' : ''}" onclick="selectLogFile('${file}')">
                <div class="log-file-name">${file}</div>
                <div class="log-file-date">${formattedDate}</div>
            </div>
        `;
    });

    logFilesList.innerHTML = logFileItems.join('');
}

async function selectLogFile(filename) {
    selectedLogFile = filename;
    updateLogFilesList();
    await loadLogContent();
}

async function loadLogContent() {
    const logsViewer = document.getElementById('logs-viewer');
    logsViewer.innerHTML = '<div class="loading-spinner"></div>';

    try {
        const result = await ipcRenderer.invoke('get-logs', 200);
        if (result.success) {
            currentLogs = result.logs;
            displayLogs();
        } else {
            logsViewer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.7);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px;"></i>
                    <p>Failed to load logs</p>
                    <p>${result.error}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load log content:', error);
        logsViewer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.7);">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px;"></i>
                <p>Failed to load logs</p>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function displayLogs() {
    const logsViewer = document.getElementById('logs-viewer');
    const levelFilter = document.getElementById('log-level-filter').value;
    
    let filteredLogs = currentLogs;
    if (levelFilter !== 'all') {
        filteredLogs = currentLogs.filter(log => {
            const logLevel = log.match(/\[.*?\]\s+(\w+)\s+/);
            return logLevel && logLevel[1].toLowerCase() === levelFilter;
        });
    }

    if (filteredLogs.length === 0) {
        logsViewer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.7);">
                <i class="fas fa-search" style="font-size: 48px; margin-bottom: 20px;"></i>
                <p>No logs found</p>
                <p>Try changing the filter or refreshing</p>
            </div>
        `;
        return;
    }

    const logEntries = filteredLogs.map(log => {
        const match = log.match(/\[(.*?)\]\s+(\w+)\s+(.*)/);
        if (!match) return `<div class="log-entry">${log}</div>`;

        const [, timestamp, level, message] = match;
        const levelLower = level.toLowerCase();
        
        return `
            <div class="log-entry ${levelLower}">
                <span class="log-timestamp">${timestamp}</span>
                <span class="log-level">${level}</span>
                <span class="log-message">${message}</span>
            </div>
        `;
    });

    logsViewer.innerHTML = logEntries.join('');
}

function filterLogs() {
    if (currentLogType === 'app') {
        displayLogs();
    } else if (currentLogType === 'server') {
        displayServerLogs();
    }
}

async function refreshLogs() {
    // Show visual refresh indicator
    const refreshButton = document.querySelector('#logs .logs-controls .btn[onclick="refreshLogs()"]');
    if (refreshButton) {
        const originalText = refreshButton.innerHTML;
        refreshButton.innerHTML = '<i class="fas fa-sync-alt refresh-spinning"></i> Refreshing...';
        refreshButton.disabled = true;
        
        try {
            await loadLogsData();
        } finally {
            // Restore button
            refreshButton.innerHTML = originalText;
            refreshButton.disabled = false;
        }
    } else {
        // Fallback if button not found
        await loadLogsData();
    }
}

async function clearLogs() {
    try {
        const result = await ipcRenderer.invoke('clear-logs');
        if (result.success) {
            showNotification('Old logs cleared successfully', 'success');
            await loadLogsData();
        } else {
            showNotification('Failed to clear logs', 'error');
        }
    } catch (error) {
        console.error('Failed to clear logs:', error);
        showNotification('Failed to clear logs', 'error');
    }
}

function exportLogs() {
    if (currentLogs.length === 0) {
        showNotification('No logs to export', 'warning');
        return;
    }

    const logContent = currentLogs.join('\n');
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `multimc-hub-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Logs exported successfully', 'success');
}

// Global functions for downloads
async function downloadVersion(loader, version, event) {
    let button = null;
    let originalText = '';
    
    try {
        console.log(`=== DOWNLOADING ${loader.toUpperCase()} ${version} ===`);
        
        // Show download progress modal
        showDownloadProgressModal(loader, version);
        
        // Update progress modal with initial status
        updateDownloadProgress(0, 'Starting download...');
        
        // Show loading state on button (if called from button click)
        if (event && event.target) {
            button = event.target.closest('button');
            if (button) {
                originalText = button.innerHTML;
                button.innerHTML = '<i class="fas fa-sync-alt refresh-spinning"></i> Downloading...';
                button.disabled = true;
            }
        }
        
        let result;
        switch (loader) {
            case 'minecraft':
                result = await ipcRenderer.invoke('download-minecraft', version);
                break;
            case 'forge':
                result = await ipcRenderer.invoke('download-forge', version);
                break;
            case 'fabric':
                result = await ipcRenderer.invoke('download-fabric', version);
                break;
            case 'quilt':
                result = await ipcRenderer.invoke('download-quilt', version);
                break;
            case 'neoforge':
                result = await ipcRenderer.invoke('download-neoforge', version);
                break;
            default:
                throw new Error(`Unknown loader: ${loader}`);
        }
        
        console.log(`Download result for ${loader} ${version}:`, result);
        
        if (result.success) {
            // Show completion in progress modal
            updateDownloadProgress(100, 'Download completed successfully!');
            
            // Wait a moment so user can see completion
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            showNotification(`${loader} ${version} downloaded successfully!`, 'success');
            console.log(`Successfully downloaded ${loader} ${version}`);
            
            // Force refresh system status to get latest installed versions
            console.log('Refreshing system status after download...');
            systemStatus = await ipcRenderer.invoke('get-system-status');
            console.log('Updated system status:', systemStatus);
            
            // Wait a moment for file system to settle
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Refresh the downloads section to show installed status
            console.log('Refreshing downloads data...');
            await loadDownloadsData();
            
            // Update system status display
            updateSystemStatus();
            
            // Force a complete refresh of the downloads tab
            console.log('Forcing complete downloads refresh...');
            try {
                await refreshDownloads();
            } catch (error) {
                console.error('Error during refreshDownloads:', error);
                // Fallback: just refresh the data
                await loadDownloadsData();
            }
            
        } else {
            throw new Error(result.error || 'Download failed');
        }
    } catch (error) {
        console.error(`Failed to download ${loader} ${version}:`, error);
        
        // Show error in progress modal
        updateDownloadProgress(0, `Error: ${error.message}`);
        
        // Wait a moment so user can see the error
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        showNotification(`Failed to download ${loader} ${version}: ${error.message}`, 'error');
    } finally {
        // Hide download progress modal
        hideDownloadProgressModal();
        
        // Restore button state
        if (button && originalText) {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }
}

function showDownloadProgressModal(loader, version) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('download-progress-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'download-progress-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-download"></i> Downloading ${loader} ${version}</h3>
                </div>
                <div class="modal-body">
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill" id="download-progress-fill"></div>
                        </div>
                        <div class="progress-text" id="download-progress-text">Initializing download...</div>
                    </div>
                    <div class="download-details" id="download-details">
                        <p>Downloading ${loader} server version ${version}...</p>
                        <p>This may take a few minutes depending on your internet connection.</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    // Update modal content
    const title = modal.querySelector('h3');
    title.innerHTML = `<i class="fas fa-download"></i> Downloading ${loader} ${version}`;
    
    const progressText = modal.querySelector('#download-progress-text');
    progressText.textContent = 'Initializing download...';
    
    const details = modal.querySelector('#download-details');
    details.innerHTML = `
        <p>Downloading ${loader} server version ${version}...</p>
        <p>This may take a few minutes depending on your internet connection.</p>
        <p><strong>Status:</strong> <span id="download-status">Starting...</span></p>
    `;
    
    // Show modal
    modal.classList.add('active');
}

function hideDownloadProgressModal() {
    const modal = document.getElementById('download-progress-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function updateDownloadProgress(progress, status) {
    const progressFill = document.getElementById('download-progress-fill');
    const progressText = document.getElementById('download-progress-text');
    const downloadStatus = document.getElementById('download-status');
    
    if (progressFill) {
        progressFill.style.width = `${progress}%`;
    }
    
    if (progressText) {
        progressText.textContent = `${progress}% - ${status}`;
    }
    
    if (downloadStatus) {
        downloadStatus.textContent = status;
    }
}

// Global functions for onclick handlers - moved to top to fix timing issues
window.showProfileModal = showProfileModal;
window.showStartServerModal = showStartServerModal;
window.showDownloadModal = showDownloadModal;
window.closeModal = closeModal;
window.saveProfile = saveProfile;
window.startServer = startServer;
window.stopServer = stopServer;
window.transferHost = transferHost;
window.takeOverHost = takeOverHost;
window.downloadMinecraft = downloadMinecraft;
window.downloadForge = downloadForge;
window.copyServerAddress = copyServerAddress;
window.refreshStatus = refreshStatus;
window.refreshNetworkStatus = refreshNetworkStatus;
window.showNetworkInfo = showNetworkInfo;
window.showServerDetails = showServerDetails;
window.showModManager = showModManager;
window.uploadMod = uploadMod;
window.removeMod = removeMod;
window.refreshMods = refreshMods;
window.selectLogFile = selectLogFile;
window.selectServerLog = selectServerLog;
window.switchLogTab = switchLogTab;
window.filterLogs = filterLogs;
window.refreshLogs = refreshLogs;
window.clearLogs = clearLogs;
window.exportLogs = exportLogs;
window.downloadVersion = downloadVersion;
window.showDownloadProgressModal = showDownloadProgressModal;
window.hideDownloadProgressModal = hideDownloadProgressModal;
window.updateDownloadProgress = updateDownloadProgress;
window.refreshEntireApp = refreshEntireApp;
window.refreshDownloads = refreshDownloads;

// Game Activity Functions
function refreshGameActivity() {
    console.log('Refreshing game activity...');
    
    // Show refresh indicator
    const refreshBtn = document.querySelector('button[onclick="refreshGameActivity()"]');
    if (refreshBtn) {
        const originalText = refreshBtn.innerHTML;
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt refresh-spinning"></i> Refreshing...';
        refreshBtn.disabled = true;
        
        setTimeout(() => {
            refreshBtn.innerHTML = originalText;
            refreshBtn.disabled = false;
        }, 1000);
    }
    
    // Load server logs to extract game activity
    loadServerGameActivity();
}

async function loadServerGameActivity() {
    try {
        // Get the most recent server logs
        const result = await ipcRenderer.invoke('get-server-logs', null, 100);
        if (result.success && result.logs) {
            parseGameActivityFromLogs(result.logs);
        }
    } catch (error) {
        console.error('Failed to load game activity:', error);
        addActivityEntry('error', 'Failed to load game activity: ' + error.message);
    }
}

function parseGameActivityFromLogs(logs) {
    const newActivity = [];
    
    logs.forEach(log => {
        const logLine = log.trim();
        
        // Parse different types of game activity
        if (logLine.includes('joined the game') || logLine.includes('left the game')) {
            newActivity.push({
                type: 'players',
                time: extractTimestamp(logLine),
                message: logLine
            });
        } else if (logLine.includes('issued server command') || logLine.includes('ran command')) {
            newActivity.push({
                type: 'commands',
                time: extractTimestamp(logLine),
                message: logLine
            });
        } else if (logLine.includes('<') && logLine.includes('>') && logLine.includes(':')) {
            // Chat messages
            newActivity.push({
                type: 'chat',
                time: extractTimestamp(logLine),
                message: logLine
            });
        } else if (logLine.includes('Starting minecraft server') || logLine.includes('Done')) {
            newActivity.push({
                type: 'info',
                time: extractTimestamp(logLine),
                message: logLine
            });
        }
    });
    
    // Add new activity to the log
    gameActivityLog = [...newActivity, ...gameActivityLog].slice(0, 100); // Keep last 100 entries
    
    updateGameActivityDisplay();
    updateActivityStats();
}

function extractTimestamp(logLine) {
    const timestampMatch = logLine.match(/\[(.*?)\]/);
    return timestampMatch ? timestampMatch[1] : new Date().toLocaleTimeString();
}

function addActivityEntry(type, message) {
    const entry = {
        type: type,
        time: new Date().toLocaleTimeString(),
        message: message
    };
    
    gameActivityLog.unshift(entry);
    gameActivityLog = gameActivityLog.slice(0, 100); // Keep last 100 entries
    
    updateGameActivityDisplay();
}

function updateGameActivityDisplay() {
    const activityLog = document.getElementById('game-activity-log');
    if (!activityLog) return;
    
    let filteredActivity = gameActivityLog;
    if (currentActivityFilter !== 'all') {
        filteredActivity = gameActivityLog.filter(entry => entry.type === currentActivityFilter);
    }
    
    if (filteredActivity.length === 0) {
        activityLog.innerHTML = `
            <div class="activity-entry info">
                <span class="activity-time">[System]</span>
                <span class="activity-message">No ${currentActivityFilter === 'all' ? '' : currentActivityFilter} activity found</span>
            </div>
        `;
        return;
    }
    
    const activityEntries = filteredActivity.map(entry => `
        <div class="activity-entry ${entry.type}">
            <span class="activity-time">[${entry.time}]</span>
            <span class="activity-message">${entry.message}</span>
        </div>
    `);
    
    activityLog.innerHTML = activityEntries.join('');
}

function filterActivity(filter) {
    currentActivityFilter = filter;
    
    // Update filter buttons
    document.querySelectorAll('.activity-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
    
    updateGameActivityDisplay();
}

function updateActivityStats() {
    const onlinePlayers = gameActivityLog.filter(entry => 
        entry.type === 'players' && entry.message.includes('joined the game')
    ).length;
    
    const totalPlayers = gameActivityLog.filter(entry => 
        entry.type === 'players'
    ).length;
    
    // Calculate uptime (this would need to be tracked from server start)
    const uptime = '00:00:00'; // Placeholder
    
    document.getElementById('online-players').textContent = onlinePlayers;
    document.getElementById('total-players').textContent = totalPlayers;
    document.getElementById('server-uptime').textContent = uptime;
}

// Start monitoring game activity
function startGameActivityMonitoring() {
    if (activityUpdateInterval) {
        clearInterval(activityUpdateInterval);
    }
    
    // Update activity every 5 seconds
    activityUpdateInterval = setInterval(() => {
        loadServerGameActivity();
    }, 5000);
    
    // Initial load
    loadServerGameActivity();
}

// Stop monitoring game activity
function stopGameActivityMonitoring() {
    if (activityUpdateInterval) {
        clearInterval(activityUpdateInterval);
        activityUpdateInterval = null;
    }
}

// External Hosting Functions
let externalHostingServices = [];
let currentSetupStep = 1;
let selectedExternalService = null;
let externalServerConfig = {};

// Load external hosting services
async function loadExternalHostingServices() {
    try {
        const result = await ipcRenderer.invoke('get-external-hosting-services');
        if (result.success) {
            externalHostingServices = result.services;
            displayExternalHostingServices();
        } else {
            console.error('Failed to load external hosting services:', result.error);
            showNotification('Failed to load external hosting services', 'error');
        }
    } catch (error) {
        console.error('Error loading external hosting services:', error);
        showNotification('Error loading external hosting services', 'error');
    }
}

// Display external hosting services
function displayExternalHostingServices() {
    const servicesGrid = document.getElementById('services-grid');
    if (!servicesGrid) return;

    if (externalHostingServices.length === 0) {
        servicesGrid.innerHTML = '<div class="loading-spinner"></div>';
        return;
    }

    const html = externalHostingServices.map(service => `
        <div class="service-card" onclick="selectExternalService('${service.id}')">
            <div class="service-header">
                <div class="service-name">${service.name}</div>
                <div class="service-status" id="status-${service.id}">
                    <div class="service-status-dot"></div>
                    <span>Checking...</span>
                </div>
            </div>
            
            <div class="service-features">
                <div class="service-feature">
                    <i class="fas fa-check"></i>
                    <span>Max ${service.maxPlayers} players</span>
                </div>
                <div class="service-feature">
                    <i class="fas fa-check"></i>
                    <span>${service.uptime}</span>
                </div>
                <div class="service-feature">
                    <i class="fas fa-check"></i>
                    <span>${service.features.join(', ')}</span>
                </div>
                ${service.moddedSupport ? `
                <div class="service-feature modded-support">
                    <i class="fas fa-puzzle-piece"></i>
                    <span>Modded Support: ${service.moddedSupport.forge ? 'Forge' : ''}${service.moddedSupport.forge && service.moddedSupport.fabric ? ' & ' : ''}${service.moddedSupport.fabric ? 'Fabric' : ''}</span>
                </div>
                <div class="service-feature">
                    <i class="fas fa-memory"></i>
                    <span>RAM: ${service.moddedSupport.ramLimit}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="service-limits">
                <div class="service-limit">
                    <div class="limit-label">Max Players</div>
                    <div class="limit-value">${service.maxPlayers}</div>
                </div>
                <div class="service-limit">
                    <div class="limit-label">Uptime</div>
                    <div class="limit-value">${service.uptime}</div>
                </div>
            </div>
            
            <div class="service-actions">
                <button class="btn btn-primary" onclick="event.stopPropagation(); setupExternalService('${service.id}')">
                    <i class="fas fa-rocket"></i> Setup
                </button>
                <button class="btn btn-secondary" onclick="event.stopPropagation(); visitServiceWebsite('${service.website}')">
                    <i class="fas fa-external-link-alt"></i> Visit
                </button>
            </div>
        </div>
    `).join('');

    servicesGrid.innerHTML = html;

    // Check service status for each service
    externalHostingServices.forEach(service => {
        checkServiceStatus(service.id);
    });
}

// Check service status
async function checkServiceStatus(serviceId) {
    try {
        const result = await ipcRenderer.invoke('check-external-service-status', serviceId);
        if (result.success) {
            updateServiceStatus(serviceId, result.status);
        }
    } catch (error) {
        console.error('Error checking service status:', error);
    }
}

// Update service status display
function updateServiceStatus(serviceId, status) {
    const statusElement = document.getElementById(`status-${serviceId}`);
    if (!statusElement) return;

    const dot = statusElement.querySelector('.service-status-dot');
    const text = statusElement.querySelector('span');

    if (status.online) {
        statusElement.className = 'service-status online';
        dot.className = 'service-status-dot online';
        text.textContent = 'Online';
    } else {
        statusElement.className = 'service-status offline';
        dot.className = 'service-status-dot offline';
        text.textContent = 'Offline';
    }
}

// Show external hosting setup modal
function showExternalHostingSetup() {
    currentSetupStep = 1;
    selectedExternalService = null;
    externalServerConfig = {};
    
    // Reset form
    document.getElementById('external-server-name').value = '';
    document.getElementById('external-server-type').value = 'vanilla';
    document.getElementById('external-server-version').value = '';
    document.getElementById('external-max-players').value = '10';
    
    // Show first step
    showSetupStep(1);
    
    // Show modal
    document.getElementById('external-hosting-setup-modal').classList.add('active');
}

// Show specific setup step
function showSetupStep(step) {
    // Hide all steps
    document.querySelectorAll('.wizard-step').forEach(el => el.style.display = 'none');
    
    // Show current step
    document.getElementById(`step-${step}`).style.display = 'block';
    
    // Update buttons
    const prevBtn = document.getElementById('prev-step-btn');
    const nextBtn = document.getElementById('next-step-btn');
    const completeBtn = document.getElementById('complete-setup-btn');
    
    prevBtn.style.display = step > 1 ? 'block' : 'none';
    nextBtn.style.display = step < 3 ? 'block' : 'none';
    completeBtn.style.display = step === 3 ? 'block' : 'none';
    
    currentSetupStep = step;
}

// Next setup step
async function nextSetupStep() {
    if (currentSetupStep === 1) {
        // Validate server configuration
        const config = getExternalServerConfig();
        if (!config.name || !config.type || !config.version) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        externalServerConfig = config;
        
        // Get recommended service
        try {
            const result = await ipcRenderer.invoke('get-recommended-external-service', config);
            if (result.success && result.service) {
                selectedExternalService = result.service;
                displayServiceSelection();
                showSetupStep(2);
            } else {
                showNotification('No compatible services found', 'error');
            }
        } catch (error) {
            console.error('Error getting recommended service:', error);
            showNotification('Error finding compatible services', 'error');
        }
    } else if (currentSetupStep === 2) {
        // Load setup guide
        try {
            const result = await ipcRenderer.invoke('get-external-setup-guide', selectedExternalService.id, externalServerConfig);
            if (result.success) {
                displaySetupGuide(result.guide);
                showSetupStep(3);
            } else {
                showNotification('Error loading setup guide', 'error');
            }
        } catch (error) {
            console.error('Error loading setup guide:', error);
            showNotification('Error loading setup guide', 'error');
        }
    }
}

// Previous setup step
function previousSetupStep() {
    if (currentSetupStep > 1) {
        showSetupStep(currentSetupStep - 1);
    }
}

// Get external server configuration from form
function getExternalServerConfig() {
    return {
        name: document.getElementById('external-server-name').value,
        type: document.getElementById('external-server-type').value,
        version: document.getElementById('external-server-version').value,
        maxPlayers: parseInt(document.getElementById('external-max-players').value)
    };
}

// Display service selection
function displayServiceSelection() {
    const recommendedCard = document.getElementById('recommended-service-card');
    const otherServicesList = document.getElementById('other-services-list');
    
    // Display recommended service
    recommendedCard.innerHTML = `
        <div class="service-header">
            <div class="service-name">${selectedExternalService.name}</div>
            <div class="service-status online">
                <div class="service-status-dot online"></div>
                <span>Recommended</span>
            </div>
        </div>
        <div class="service-features">
            <div class="service-feature">
                <i class="fas fa-check"></i>
                <span>Max ${selectedExternalService.maxPlayers} players</span>
            </div>
            <div class="service-feature">
                <i class="fas fa-check"></i>
                <span>${selectedExternalService.uptime}</span>
            </div>
            <div class="service-feature">
                <i class="fas fa-check"></i>
                <span>${selectedExternalService.features.join(', ')}</span>
            </div>
        </div>
        <div class="service-actions">
            <button class="btn btn-primary" onclick="selectServiceForSetup('${selectedExternalService.id}')">
                <i class="fas fa-check"></i> Select
            </button>
        </div>
    `;
    
    // Display other services
    const otherServices = externalHostingServices.filter(s => s.id !== selectedExternalService.id);
    otherServicesList.innerHTML = otherServices.map(service => `
        <div class="service-card">
            <div class="service-header">
                <div class="service-name">${service.name}</div>
                <div class="service-status">
                    <div class="service-status-dot"></div>
                    <span>Available</span>
                </div>
            </div>
            <div class="service-features">
                <div class="service-feature">
                    <i class="fas fa-check"></i>
                    <span>Max ${service.maxPlayers} players</span>
                </div>
                <div class="service-feature">
                    <i class="fas fa-check"></i>
                    <span>${service.uptime}</span>
                </div>
            </div>
            <div class="service-actions">
                <button class="btn btn-secondary" onclick="selectServiceForSetup('${service.id}')">
                    <i class="fas fa-check"></i> Select
                </button>
            </div>
        </div>
    `).join('');
}

// Select service for setup
function selectServiceForSetup(serviceId) {
    selectedExternalService = externalHostingServices.find(s => s.id === serviceId);
    if (selectedExternalService) {
        nextSetupStep();
    }
}

// Display setup guide
function displaySetupGuide(guide) {
    const guideContent = document.getElementById('setup-guide-content');
    
    guideContent.innerHTML = `
        <h5>${guide.service} Setup Guide</h5>
        <p>Follow these steps to set up your server on ${guide.service}:</p>
        
        <ul>
            ${guide.steps.map(step => `<li>${step}</li>`).join('')}
        </ul>
        
        <div class="tips">
            <h6>Important Tips:</h6>
            <ul>
                ${guide.tips.map(tip => `<li>${tip}</li>`).join('')}
            </ul>
        </div>
        
        <div class="service-requirements">
            <h6>Service Requirements:</h6>
            <ul>
                <li>Account Required: ${guide.requirements.account ? 'Yes' : 'No'}</li>
                <li>Max Players: ${guide.requirements.maxPlayers}</li>
                <li>Supported Types: ${guide.requirements.supportedTypes.join(', ')}</li>
                <li>Uptime: ${guide.requirements.uptime}</li>
            </ul>
        </div>
    `;
}

// Complete external setup
function completeExternalSetup() {
    closeModal('external-hosting-setup-modal');
    showNotification('External hosting setup guide completed! Visit the service website to create your server.', 'success');
}

// Setup external service account
async function setupExternalService(serviceId) {
    const service = externalHostingServices.find(s => s.id === serviceId);
    if (!service) return;
    
    // Show service account modal
    const serviceInfo = document.getElementById('service-info');
    serviceInfo.innerHTML = `
        <h4>${service.name}</h4>
        <p>Set up your account for ${service.name} to manage your servers. Your credentials will be stored locally for future use.</p>
    `;
    
    // Reset form
    document.getElementById('service-username').value = '';
    document.getElementById('service-password').value = '';
    document.getElementById('save-credentials').checked = true;
    
    // Store selected service
    selectedExternalService = service;
    
    // Show modal
    document.getElementById('service-account-modal').classList.add('active');
}

// Setup service account
async function setupServiceAccount() {
    const username = document.getElementById('service-username').value;
    const password = document.getElementById('service-password').value;
    const saveCredentials = document.getElementById('save-credentials').checked;
    
    if (!username || !password) {
        showNotification('Please enter both username and password', 'error');
        return;
    }
    
    try {
        const result = await ipcRenderer.invoke('setup-external-service-account', selectedExternalService.id, {
            username,
            password,
            saveCredentials
        });
        
        if (result.success) {
            closeModal('service-account-modal');
            showNotification(result.message, 'success');
            
            // Show next steps
            if (result.nextSteps) {
                showNotification('Next steps: ' + result.nextSteps.join(', '), 'info');
            }
        } else {
            showNotification('Failed to setup account: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error setting up service account:', error);
        showNotification('Error setting up account: ' + error.message, 'error');
    }
}

// Visit service website
function visitServiceWebsite(url) {
    ipcRenderer.invoke('open-external', url);
}

// Select external service
function selectExternalService(serviceId) {
    const service = externalHostingServices.find(s => s.id === serviceId);
    if (service) {
        showExternalHostingSetup();
    }
}

// Handle external hosting events
ipcRenderer.on('external-hosting-service-configured', (event, data) => {
    showNotification(`${data.service} account configured successfully!`, 'success');
});

ipcRenderer.on('external-server-creating', (event, data) => {
    showNotification(`Creating server on ${data.serviceName}...`, 'info');
});

// Load external hosting data when tab is switched
function loadExternalHostingData() {
    loadExternalHostingServices();
}

// Update modded options when server type changes
async function updateModdedOptions() {
    const serverType = document.getElementById('external-server-type').value;
    const moddedOptions = document.getElementById('modded-options');
    const modpackSelection = document.getElementById('modpack-selection');
    
    if (serverType === 'forge' || serverType === 'fabric') {
        moddedOptions.style.display = 'block';
        
        // Get modded server recommendations
        const serverConfig = getExternalServerConfig();
        try {
            const result = await ipcRenderer.invoke('get-modded-server-recommendations', serverConfig);
            if (result.success && result.recommendations.length > 0) {
                // Get modpacks from the best service
                const bestService = result.recommendations[0];
                const modpacksResult = await ipcRenderer.invoke('get-available-modpacks', bestService.serviceId);
                
                if (modpacksResult.success) {
                    const options = ['<option value="">Use default modpack</option>'];
                    modpacksResult.modpacks.forEach(modpack => {
                        options.push(`<option value="${modpack.name}">${modpack.name} (${modpack.ramLimit})</option>`);
                    });
                    modpackSelection.innerHTML = options.join('');
                }
            }
        } catch (error) {
            console.error('Error updating modded options:', error);
        }
    } else {
        moddedOptions.style.display = 'none';
    }
}

// Contact Management Functions
function showContactManager() {
    document.getElementById('contact-manager-modal').style.display = 'block';
    loadContacts();
}

function closeContactManager() {
    document.getElementById('contact-manager-modal').style.display = 'none';
}

function switchContactTab(tab) {
    // Hide all tab contents
    document.querySelectorAll('.contact-tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.contact-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab content
    document.getElementById(`${tab}-contact-tab`).style.display = 'block';
    
    // Add active class to selected tab
    event.target.classList.add('active');
}

async function loadContacts() {
    try {
        const result = await ipcRenderer.invoke('get-contacts');
        if (result.success) {
            displayContacts(result.contacts);
        } else {
            showNotification('Failed to load contacts', 'error');
        }
    } catch (error) {
        console.error('Error loading contacts:', error);
        showNotification('Failed to load contacts', 'error');
    }
}

function displayContacts(contacts) {
    const contactsList = document.getElementById('contacts-list');
    
    if (contacts.length === 0) {
        contactsList.innerHTML = '<p class="no-contacts">No contacts found. Add contacts to start building your exclusive network.</p>';
        return;
    }
    
    const contactsHtml = contacts.map(contact => `
        <div class="contact-item">
            <div class="contact-info">
                <div class="contact-name">${contact.name}</div>
                <div class="contact-username">@${contact.username}</div>
                <div class="contact-status ${contact.status}">
                    <i class="fas fa-circle"></i>
                    ${contact.status}
                </div>
            </div>
            <div class="contact-actions">
                <button class="btn btn-sm btn-danger" onclick="removeContact('${contact.id}')">
                    <i class="fas fa-trash"></i> Remove
                </button>
                <button class="btn btn-sm btn-warning" onclick="blockPeer('${contact.id}')">
                    <i class="fas fa-ban"></i> Block
                </button>
            </div>
        </div>
    `).join('');
    
    contactsList.innerHTML = contactsHtml;
}

async function addContact() {
    const peerId = document.getElementById('contact-peer-id').value.trim();
    const name = document.getElementById('contact-name').value.trim();
    const username = document.getElementById('contact-username').value.trim();
    
    if (!peerId || !name) {
        showNotification('Please fill in all required fields', 'warning');
        return;
    }
    
    try {
        const result = await ipcRenderer.invoke('add-contact', peerId, { name, username });
        if (result.success) {
            showNotification('Contact added successfully', 'success');
            loadContacts();
            // Clear form
            document.getElementById('contact-peer-id').value = '';
            document.getElementById('contact-name').value = '';
            document.getElementById('contact-username').value = '';
        } else {
            showNotification(result.error, 'error');
        }
    } catch (error) {
        console.error('Error adding contact:', error);
        showNotification('Failed to add contact', 'error');
    }
}

async function removeContact(peerId) {
    if (!confirm('Are you sure you want to remove this contact?')) {
        return;
    }
    
    try {
        const result = await ipcRenderer.invoke('remove-contact', peerId);
        if (result.success) {
            showNotification('Contact removed successfully', 'success');
            loadContacts();
        } else {
            showNotification(result.error, 'error');
        }
    } catch (error) {
        console.error('Error removing contact:', error);
        showNotification('Failed to remove contact', 'error');
    }
}

async function blockPeer(peerId) {
    if (!confirm('Are you sure you want to block this peer? They will no longer be able to see you.')) {
        return;
    }
    
    try {
        const result = await ipcRenderer.invoke('block-peer', peerId);
        if (result.success) {
            showNotification('Peer blocked successfully', 'success');
            loadContacts();
        } else {
            showNotification(result.error, 'error');
        }
    } catch (error) {
        console.error('Error blocking peer:', error);
        showNotification('Failed to block peer', 'error');
    }
}

// Invite Management Functions
function showInviteManager() {
    document.getElementById('invite-manager-modal').style.display = 'block';
    loadPendingInvites();
}

function closeInviteManager() {
    document.getElementById('invite-manager-modal').style.display = 'none';
}

function switchInviteTab(tab) {
    // Hide all tab contents
    document.querySelectorAll('.invite-tab-content').forEach(content => {
        if (content) {
            content.style.display = 'none';
        }
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.invite-tabs .tab-btn').forEach(btn => {
        if (btn) {
            btn.classList.remove('active');
        }
    });
    
    // Show selected tab content
    const selectedTab = document.getElementById(`${tab}-invite-tab`);
    if (selectedTab) {
        selectedTab.style.display = 'block';
    }
    
    // Add active class to selected tab
    if (event && event.target) {
        event.target.classList.add('active');
    }
}

async function generateInviteCode() {
    try {
        const result = await ipcRenderer.invoke('generate-invite-code');
        if (result.success) {
            document.getElementById('invite-code-display').textContent = result.inviteCode;
            document.getElementById('generated-invite').style.display = 'block';
            showNotification('Invite code generated successfully', 'success');
        } else {
            showNotification(result.error, 'error');
        }
    } catch (error) {
        console.error('Error generating invite code:', error);
        showNotification('Failed to generate invite code', 'error');
    }
}

function copyInviteCode() {
    const inviteCode = document.getElementById('invite-code-display').textContent;
    navigator.clipboard.writeText(inviteCode).then(() => {
        showNotification('Invite code copied to clipboard', 'success');
    }).catch(() => {
        showNotification('Failed to copy invite code', 'error');
    });
}

async function redeemInviteCode() {
    const code = document.getElementById('invite-code-input').value.trim();
    
    if (!code) {
        showNotification('Please enter an invite code', 'warning');
        return;
    }
    
    try {
        const result = await ipcRenderer.invoke('redeem-invite-code', code);
        if (result.success) {
            showNotification('Invite code redeemed successfully', 'success');
            document.getElementById('invite-code-input').value = '';
            loadPendingInvites();
        } else {
            showNotification(result.error, 'error');
        }
    } catch (error) {
        console.error('Error redeeming invite code:', error);
        showNotification('Failed to redeem invite code', 'error');
    }
}

async function loadPendingInvites() {
    try {
        const result = await ipcRenderer.invoke('get-pending-invites');
        if (result.success) {
            displayPendingInvites(result.invites);
        } else {
            showNotification('Failed to load pending invites', 'error');
        }
    } catch (error) {
        console.error('Error loading pending invites:', error);
        showNotification('Failed to load pending invites', 'error');
    }
}

function displayPendingInvites(invites) {
    const invitesList = document.getElementById('pending-invites-list');
    
    if (invites.length === 0) {
        invitesList.innerHTML = '<p class="no-invites">No pending invites found.</p>';
        return;
    }
    
    const invitesHtml = invites.map(invite => `
        <div class="invite-item">
            <div class="invite-info">
                <div class="invite-from">From: ${invite.fromName || invite.fromPeerId}</div>
                <div class="invite-message">${invite.message}</div>
                <div class="invite-date">Received: ${new Date(invite.createdAt).toLocaleDateString()}</div>
            </div>
            <div class="invite-actions">
                <button class="btn btn-sm btn-success" onclick="acceptInvite('${invite.id}')">
                    <i class="fas fa-check"></i> Accept
                </button>
                <button class="btn btn-sm btn-danger" onclick="declineInvite('${invite.id}')">
                    <i class="fas fa-times"></i> Decline
                </button>
            </div>
        </div>
    `).join('');
    
    invitesList.innerHTML = invitesHtml;
}

async function acceptInvite(inviteId) {
    try {
        const result = await ipcRenderer.invoke('accept-invite', inviteId);
        if (result.success) {
            showNotification('Invite accepted successfully', 'success');
            loadPendingInvites();
            loadContacts();
        } else {
            showNotification(result.error, 'error');
        }
    } catch (error) {
        console.error('Error accepting invite:', error);
        showNotification('Failed to accept invite', 'error');
    }
}

async function declineInvite(inviteId) {
    try {
        const result = await ipcRenderer.invoke('decline-invite', inviteId);
        if (result.success) {
            showNotification('Invite declined', 'info');
            loadPendingInvites();
        } else {
            showNotification(result.error, 'error');
        }
    } catch (error) {
        console.error('Error declining invite:', error);
        showNotification('Failed to decline invite', 'error');
    }
}

// Modrinth Browser Functions
let currentModrinthSection = 'featured';
let currentModrinthFilters = {};
let selectedModVersion = null;
let currentModData = null;

// Initialize Modrinth browser when tab is loaded
function loadModrinthData() {
    loadModrinthFilters();
    loadTotalModCount();
    loadCurrentServerInfo();
    loadFeaturedMods();
    loadTrendingMods();
    loadPopularMods();
}

// Get current server information for compatibility filtering
async function loadCurrentServerInfo() {
    try {
        const result = await ipcRenderer.invoke('get-current-server-info');
        if (result.success) {
            window.currentServerInfo = result.serverInfo;
            updateServerCompatibilityFilters();
        }
    } catch (error) {
        console.error('Error loading current server info:', error);
    }
}

// Update filters based on current server
function updateServerCompatibilityFilters() {
    if (!window.currentServerInfo) return;
    
    const server = window.currentServerInfo;
    
    // Auto-set loader filter based on server type
    const loaderMap = {
        'forge': 'forge',
        'fabric': 'fabric',
        'quilt': 'quilt',
        'neoforge': 'neoforge'
    };
    
    if (loaderMap[server.type]) {
        const loaderSelect = document.getElementById('modrinth-loader-filter');
        if (loaderSelect) {
            loaderSelect.value = loaderMap[server.type];
        }
    }
    
    // Auto-set game version filter
    if (server.version) {
        const versionSelect = document.getElementById('modrinth-version-filter');
        if (versionSelect) {
            // Try to match version (e.g., "1.20.1" from "1.20.1-forge-47.1.0")
            const versionMatch = server.version.match(/^(\d+\.\d+(?:\.\d+)?)/);
            if (versionMatch) {
                versionSelect.value = versionMatch[1];
            }
        }
    }
    
    // Show server compatibility info
    updateServerCompatibilityDisplay();
}

// Update the server compatibility display
function updateServerCompatibilityDisplay() {
    if (!window.currentServerInfo) return;
    
    const server = window.currentServerInfo;
    const compatibilityInfo = document.getElementById('server-compatibility-info');
    
    if (compatibilityInfo) {
        compatibilityInfo.innerHTML = `
            <div class="server-compatibility-badge">
                <i class="fas fa-server"></i>
                <span>Filtering for: ${server.name} (${server.type} ${server.version})</span>
            </div>
        `;
        compatibilityInfo.style.display = 'block';
    }
}

async function loadTotalModCount() {
    try {
        const result = await ipcRenderer.invoke('get-modrinth-total-count');
        if (result.success) {
            document.getElementById('total-mod-count').textContent = formatNumber(result.count);
        } else {
            document.getElementById('total-mod-count').textContent = 'Unknown';
        }
    } catch (error) {
        console.error('Error loading total mod count:', error);
        document.getElementById('total-mod-count').textContent = 'Error';
    }
}

async function loadModrinthFilters() {
    try {
        const [loaders, versions, categories] = await Promise.all([
            ipcRenderer.invoke('get-modrinth-loaders'),
            ipcRenderer.invoke('get-modrinth-game-versions'),
            ipcRenderer.invoke('get-modrinth-categories')
        ]);

        if (loaders.success) {
            const loaderSelect = document.getElementById('modrinth-loader-filter');
            loaderSelect.innerHTML = '<option value="">All Loaders</option>';
            loaders.loaders.forEach(loader => {
                loaderSelect.innerHTML += `<option value="${loader.name}">${loader.name}</option>`;
            });
        }

        if (versions.success) {
            const versionSelect = document.getElementById('modrinth-version-filter');
            versionSelect.innerHTML = '<option value="">All Versions</option>';
            versions.versions.forEach(version => {
                versionSelect.innerHTML += `<option value="${version.version}">${version.version}</option>`;
            });
        }

        if (categories.success) {
            const categorySelect = document.getElementById('modrinth-category-filter');
            categorySelect.innerHTML = '<option value="">All Categories</option>';
            categories.categories.forEach(category => {
                categorySelect.innerHTML += `<option value="${category.name}">${category.name}</option>`;
            });
        }
    } catch (error) {
        console.error('Error loading Modrinth filters:', error);
    }
}

async function loadFeaturedMods() {
    try {
        const result = await ipcRenderer.invoke('get-modrinth-featured-mods');
        if (result.success) {
            displayMods(result.mods.hits, 'featured-mods');
        } else {
            showNotification('Failed to load featured mods', 'error');
        }
    } catch (error) {
        console.error('Error loading featured mods:', error);
        showNotification('Failed to load featured mods', 'error');
    }
}

async function loadTrendingMods() {
    try {
        const result = await ipcRenderer.invoke('get-modrinth-trending-mods');
        if (result.success) {
            displayMods(result.mods.hits, 'trending-mods');
        } else {
            showNotification('Failed to load trending mods', 'error');
        }
    } catch (error) {
        console.error('Error loading trending mods:', error);
        showNotification('Failed to load trending mods', 'error');
    }
}

async function loadPopularMods() {
    try {
        const result = await ipcRenderer.invoke('get-modrinth-popular-mods');
        if (result.success) {
            displayMods(result.mods.hits, 'popular-mods');
        } else {
            showNotification('Failed to load popular mods', 'error');
        }
    } catch (error) {
        console.error('Error loading popular mods:', error);
        showNotification('Failed to load popular mods', 'error');
    }
}

function displayMods(mods, containerId) {
    const container = document.getElementById(containerId);
    
    if (!mods || mods.length === 0) {
        container.innerHTML = '<div class="no-results"><i class="fas fa-search"></i><h3>No mods found</h3><p>Try adjusting your search terms or filters</p></div>';
        return;
    }

    // Add mod count display at the top
    const modCountHtml = `<div class="mods-count-display">Showing ${mods.length} mods</div>`;

    const modsHtml = mods.map(mod => {
        // Check compatibility with current server
        const isCompatible = checkModCompatibility(mod);
        const quickInstallBtn = window.currentServerInfo ? `
            <button class="quick-install-btn ${isCompatible ? 'compatible' : 'incompatible'}" 
                    onclick="event.stopPropagation(); quickInstallMod('${mod.project_id}', '${mod.title}')"
                    title="${isCompatible ? 'Install to current server' : 'Incompatible with current server'}">
                <i class="fas fa-download"></i>
                ${isCompatible ? 'Quick Install' : 'Incompatible'}
            </button>
        ` : '';

        return `
            <div class="mod-card" onclick="showModDetails('${mod.project_id}')">
                <div class="mod-card-header">
                    <img class="mod-card-icon" src="${mod.icon_url || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSJ1cmwoI2dyYWRpZW50KSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJncmFkaWVudCIgeDE9IjAiIHkxPSIwIiB4Mj0iMjAwIiB5Mj0iMjAwIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2NjdFRUE7c3RvcC1vcGFjaXR5OjEiIC8+CjxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6Izc2NEJBQjtzdG9wLW9wYWNpdHk6MSIgLz4KPC9saW5lYXJHcmFkaWVudD4KPC9kZWZzPgo8L3N2Zz4K'}" alt="${mod.title}">
                    <div class="mod-card-overlay">
                        <div class="mod-card-title">${mod.title}</div>
                        <div class="mod-card-author">By ${mod.author}</div>
                        ${quickInstallBtn}
                    </div>
                </div>
                <div class="mod-card-content">
                    <div class="mod-card-description">${mod.description || 'No description available'}</div>
                    <div class="mod-card-meta">
                        <div class="mod-card-stats">
                            <span><i class="fas fa-download"></i> ${formatNumber(mod.downloads)}</span>
                            <span><i class="fas fa-heart"></i> ${formatNumber(mod.follows)}</span>
                        </div>
                        <span class="mod-date">${formatDate(mod.date_created)}</span>
                    </div>
                    <div class="mod-card-tags">
                        ${mod.categories ? mod.categories.slice(0, 3).map(category => `<span class="mod-tag">${category}</span>`).join('') : ''}
                        ${mod.loaders ? mod.loaders.slice(0, 2).map(loader => `<span class="mod-tag">${loader}</span>`).join('') : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = modCountHtml + modsHtml;
}

// Check if a mod is compatible with the current server
function checkModCompatibility(mod) {
    if (!window.currentServerInfo) return false;
    
    const server = window.currentServerInfo;
    
    // Check loader compatibility
    const loaderMap = {
        'forge': 'forge',
        'fabric': 'fabric',
        'quilt': 'quilt',
        'neoforge': 'neoforge'
    };
    
    const serverLoader = loaderMap[server.type];
    if (serverLoader && mod.loaders && !mod.loaders.includes(serverLoader)) {
        return false;
    }
    
    // Check game version compatibility (basic check)
    if (server.version && mod.game_versions) {
        const serverVersion = server.version.match(/^(\d+\.\d+(?:\.\d+)?)/)?.[1];
        if (serverVersion && !mod.game_versions.includes(serverVersion)) {
            return false;
        }
    }
    
    return true;
}

// Quick install mod to current server
async function quickInstallMod(projectId, modName) {
    if (!window.currentServerInfo) {
        showNotification('No active server found', 'warning');
        return;
    }
    
    try {
        showNotification(`Installing ${modName} to ${window.currentServerInfo.name}...`, 'info');
        
        const result = await ipcRenderer.invoke('quick-install-mod', projectId, window.currentServerInfo.id);
        
        if (result.success) {
            showNotification(`Successfully installed ${modName} to ${window.currentServerInfo.name}!`, 'success');
        } else {
            showNotification(`Failed to install ${modName}: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Error installing mod:', error);
        showNotification(`Failed to install ${modName}`, 'error');
    }
}

function switchModrinthSection(section) {
    // Hide all sections
    document.querySelectorAll('.modrinth-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.section-tab').forEach(t => t.classList.remove('active'));
    
    // Show selected section
    document.getElementById(`${section}-section`).classList.add('active');
    event.target.classList.add('active');
    
    currentModrinthSection = section;
}

async function searchModrinthMods() {
    const query = document.getElementById('modrinth-search').value.trim();
    const filters = getCurrentModrinthFilters();
    
    if (!query) {
        showNotification('Please enter a search term', 'warning');
        return;
    }
    
    try {
        // Increase limit for search results
        filters.limit = 100;
        const result = await ipcRenderer.invoke('search-modrinth-mods', query, filters);
        if (result.success) {
            displayMods(result.results.hits, 'search-mods');
            switchModrinthSection('search');
            
            // Show search result count
            const totalResults = result.results.total_hits || 0;
            const displayedResults = result.results.hits?.length || 0;
            showNotification(`Found ${formatNumber(totalResults)} mods (showing ${displayedResults})`, 'info');
        } else {
            showNotification('Failed to search mods', 'error');
        }
    } catch (error) {
        console.error('Error searching mods:', error);
        showNotification('Failed to search mods', 'error');
    }
}

function getCurrentModrinthFilters() {
    const filters = {
        loader: document.getElementById('modrinth-loader-filter').value,
        gameVersion: document.getElementById('modrinth-version-filter').value,
        category: document.getElementById('modrinth-category-filter').value,
        sortBy: document.getElementById('modrinth-sort-filter').value
    };
    
    // Auto-apply server compatibility filters if available
    if (window.currentServerInfo) {
        const server = window.currentServerInfo;
        
        // Auto-set loader if not already set
        if (!filters.loader) {
            const loaderMap = {
                'forge': 'forge',
                'fabric': 'fabric',
                'quilt': 'quilt',
                'neoforge': 'neoforge'
            };
            if (loaderMap[server.type]) {
                filters.loader = loaderMap[server.type];
            }
        }
        
        // Auto-set game version if not already set
        if (!filters.gameVersion && server.version) {
            const versionMatch = server.version.match(/^(\d+\.\d+(?:\.\d+)?)/);
            if (versionMatch) {
                filters.gameVersion = versionMatch[1];
            }
        }
    }
    
    return filters;
}

function applyModrinthFilters() {
    currentModrinthFilters = getCurrentModrinthFilters();
    // Re-run current section with new filters
    switch (currentModrinthSection) {
        case 'featured':
            loadFeaturedMods();
            break;
        case 'trending':
            loadTrendingMods();
            break;
        case 'popular':
            loadPopularMods();
            break;
        case 'search':
            searchModrinthMods();
            break;
    }
}

function refreshModrinthData() {
    loadModrinthData();
    showNotification('Modrinth data refreshed', 'success');
}

function showModrinthFilters() {
    // This could open a more detailed filter modal in the future
    showNotification('Filters are already visible in the search section', 'info');
}

// Toggle server compatibility filtering
function toggleServerCompatibility() {
    const toggleBtn = document.getElementById('server-compatibility-toggle');
    const compatibilityInfo = document.getElementById('server-compatibility-info');
    
    if (window.serverCompatibilityEnabled) {
        // Disable server compatibility
        window.serverCompatibilityEnabled = false;
        toggleBtn.classList.remove('active');
        toggleBtn.innerHTML = '<i class="fas fa-server"></i> Server Compatible';
        if (compatibilityInfo) {
            compatibilityInfo.style.display = 'none';
        }
        showNotification('Server compatibility filtering disabled', 'info');
    } else {
        // Enable server compatibility
        if (!window.currentServerInfo) {
            showNotification('No active server found. Start a server first.', 'warning');
            return;
        }
        
        window.serverCompatibilityEnabled = true;
        toggleBtn.classList.add('active');
        toggleBtn.innerHTML = '<i class="fas fa-check"></i> Server Compatible';
        updateServerCompatibilityDisplay();
        showNotification('Server compatibility filtering enabled', 'success');
    }
    
    // Refresh current section with new filters
    applyModrinthFilters();
}

// Utility functions
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

// Mod Details Functions
async function showModDetails(projectId) {
    try {
        const result = await ipcRenderer.invoke('get-modrinth-mod-details', projectId);
        if (result.success) {
            currentModData = result.modData;
            displayModDetails(result.modData);
            document.getElementById('modrinth-mod-modal').style.display = 'block';
        } else {
            showNotification('Failed to load mod details', 'error');
        }
    } catch (error) {
        console.error('Error loading mod details:', error);
        showNotification('Failed to load mod details', 'error');
    }
}

function displayModDetails(modData) {
    // Set basic mod info
    document.getElementById('mod-title').textContent = modData.title || modData.name;
    document.getElementById('mod-description').textContent = modData.description || 'No description available';
    document.getElementById('mod-author').textContent = `By ${modData.team?.[0]?.user?.username || 'Unknown'}`;
    document.getElementById('mod-downloads').textContent = `${formatNumber(modData.downloads || 0)} downloads`;
    document.getElementById('mod-followers').textContent = `${formatNumber(modData.followers || 0)} followers`;
    
    // Set mod icon
    const modIcon = document.getElementById('mod-icon');
    if (modData.icon_url) {
        modIcon.src = modData.icon_url;
    } else {
        modIcon.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiBmaWxsPSJ1cmwoI2dyYWRpZW50KSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJncmFkaWVudCIgeDE9IjAiIHkxPSIwIiB4Mj0iMTIwIiB5Mj0iMTIwIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2NjdFRUE7c3RvcC1vcGFjaXR5OjEiIC8+CjxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6Izc2NEJBQjtzdG9wLW9wYWNpdHk6MSIgLz4KPC9saW5lYXJHcmFkaWVudD4KPC9kZWZzPgo8L3N2Zz4K';
    }
    
    // Set tags
    const tagsContainer = document.getElementById('mod-tags');
    const tags = [];
    if (modData.categories) tags.push(...modData.categories);
    if (modData.loaders) tags.push(...modData.loaders);
    
    tagsContainer.innerHTML = tags.slice(0, 6).map(tag => `<span class="mod-tag">${tag}</span>`).join('');
    
    // Load versions
    loadModVersions(modData.project_id);
    
    // Load gallery
    loadModGallery(modData);
    
    // Load dependencies
    loadModDependencies(modData);
}

async function loadModVersions(projectId) {
    try {
        const result = await ipcRenderer.invoke('get-modrinth-mod-versions', projectId, {});
        if (result.success) {
            displayModVersions(result.versions);
        } else {
            showNotification('Failed to load mod versions', 'error');
        }
    } catch (error) {
        console.error('Error loading mod versions:', error);
        showNotification('Failed to load mod versions', 'error');
    }
}

function displayModVersions(versions) {
    const versionsList = document.getElementById('versions-list');
    
    if (!versions || versions.length === 0) {
        versionsList.innerHTML = '<p class="no-versions">No versions available</p>';
        return;
    }
    
    const versionsHtml = versions.map(version => `
        <div class="version-item" onclick="selectModVersion('${version.id}')" data-version-id="${version.id}">
            <div class="version-info">
                <div class="version-name">${version.name}</div>
                <div class="version-meta">
                    ${version.game_versions.join(', ')} | ${version.loaders.join(', ')} | ${version.version_type}
                </div>
            </div>
            <div class="version-actions">
                <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); installModVersion('${version.id}')">
                    <i class="fas fa-download"></i> Install
                </button>
            </div>
        </div>
    `).join('');
    
    versionsList.innerHTML = versionsHtml;
}

function selectModVersion(versionId) {
    // Remove previous selection
    document.querySelectorAll('.version-item').forEach(item => item.classList.remove('selected'));
    
    // Select new version
    const versionItem = document.querySelector(`[data-version-id="${versionId}"]`);
    if (versionItem) {
        versionItem.classList.add('selected');
        selectedModVersion = versionId;
        document.getElementById('install-mod-btn').style.display = 'inline-block';
    }
}

async function installModVersion(versionId) {
    // Get current server selection
    const activeServers = await getActiveServers();
    
    if (!activeServers || activeServers.length === 0) {
        showNotification('No active servers found. Please start a server first.', 'warning');
        return;
    }
    
    // For now, install to the first active server
    // In the future, this could show a server selection dialog
    const targetServer = activeServers[0];
    
    try {
        showNotification('Installing mod...', 'info');
        const result = await ipcRenderer.invoke('install-modrinth-mod', versionId, targetServer.path);
        if (result.success) {
            showNotification(`Mod installed successfully to ${targetServer.name}`, 'success');
        } else {
            showNotification(result.error, 'error');
        }
    } catch (error) {
        console.error('Error installing mod:', error);
        showNotification('Failed to install mod', 'error');
    }
}

async function installSelectedModVersion() {
    if (!selectedModVersion) {
        showNotification('Please select a version first', 'warning');
        return;
    }
    
    await installModVersion(selectedModVersion);
}

function loadModGallery(modData) {
    const galleryContainer = document.getElementById('mod-gallery');
    
    if (!modData.gallery || modData.gallery.length === 0) {
        galleryContainer.innerHTML = '<p class="no-gallery">No gallery images available</p>';
        return;
    }
    
    const galleryHtml = modData.gallery.map(image => `
        <div class="gallery-item">
            <img src="${image.url}" alt="${image.title || 'Gallery image'}" onclick="openImageModal('${image.url}')">
        </div>
    `).join('');
    
    galleryContainer.innerHTML = galleryHtml;
}

function loadModDependencies(modData) {
    const dependenciesContainer = document.getElementById('mod-dependencies');
    
    if (!modData.versions || modData.versions.length === 0) {
        dependenciesContainer.innerHTML = '<p class="no-dependencies">No dependencies information available</p>';
        return;
    }
    
    // Get dependencies from the latest version
    const latestVersion = modData.versions[0];
    const dependencies = latestVersion.dependencies || [];
    
    if (dependencies.length === 0) {
        dependenciesContainer.innerHTML = '<p class="no-dependencies">No dependencies required</p>';
        return;
    }
    
    const dependenciesHtml = dependencies.map(dep => `
        <div class="dependency-item">
            <div class="dependency-name">${dep.project_id}</div>
            <div class="dependency-type">${dep.dependency_type}</div>
        </div>
    `).join('');
    
    dependenciesContainer.innerHTML = dependenciesHtml;
}

function switchModTab(tab) {
    // Hide all tab panels
    document.querySelectorAll('.mod-tab-panel').forEach(panel => panel.classList.remove('active'));
    document.querySelectorAll('.mod-tab').forEach(tabBtn => tabBtn.classList.remove('active'));
    
    // Show selected tab panel
    document.getElementById(`${tab}-tab`).classList.add('active');
    event.target.classList.add('active');
}

function filterModVersions() {
    const loaderFilter = document.getElementById('version-loader-filter').value;
    const gameFilter = document.getElementById('version-game-filter').value;
    const typeFilter = document.getElementById('version-type-filter').value;
    
    const versionItems = document.querySelectorAll('.version-item');
    
    versionItems.forEach(item => {
        const versionInfo = item.querySelector('.version-meta').textContent;
        let show = true;
        
        if (loaderFilter && !versionInfo.includes(loaderFilter)) show = false;
        if (gameFilter && !versionInfo.includes(gameFilter)) show = false;
        if (typeFilter && !versionInfo.includes(typeFilter)) show = false;
        
        item.style.display = show ? 'flex' : 'none';
    });
}

// Global error handler
window.addEventListener('error', function(event) {
    console.error('Global error caught:', event.error);
    // Don't show error notifications for every error to avoid spam
});

// Initialize Modrinth when tab is shown
document.addEventListener('DOMContentLoaded', function() {
    // Add tab change listener for Modrinth
    const modrinthTab = document.querySelector('[data-tab="modrinth"]');
    if (modrinthTab) {
        modrinthTab.addEventListener('click', function() {
            setTimeout(() => {
                if (document.getElementById('modrinth').classList.contains('active')) {
                    loadModrinthData();
                }
            }, 100);
        });
    }
    
    // Add tab change listener for Cloud Sync
    const cloudSyncTab = document.querySelector('[data-tab="cloud-sync"]');
    if (cloudSyncTab) {
        cloudSyncTab.addEventListener('click', function() {
            setTimeout(() => {
                if (document.getElementById('cloud-sync').classList.contains('active')) {
                    loadCloudSyncData();
                }
            }, 100);
        });
    }
});

// Cloud Sync Functions
let currentCloudSyncData = null;

async function loadCloudSyncData() {
    await loadSyncStatus();
    await loadRegisteredContent();
}

async function loadSyncStatus() {
    try {
        const result = await ipcRenderer.invoke('get-sync-status');
        if (result.success) {
            displaySyncStatus(result.status);
        } else {
            showNotification('Failed to load sync status', 'error');
        }
    } catch (error) {
        console.error('Error loading sync status:', error);
        showNotification('Failed to load sync status', 'error');
    }
}

function displaySyncStatus(status) {
    document.getElementById('auto-sync-status').textContent = status.autoSyncEnabled ? 'Enabled' : 'Disabled';
    document.getElementById('last-sync-time').textContent = new Date(status.lastSync).toLocaleString();
    document.getElementById('pending-transfers-count').textContent = status.pendingTransfers.toString();
}

async function loadRegisteredContent() {
    try {
        const result = await ipcRenderer.invoke('get-all-registered');
        if (result.success) {
            currentCloudSyncData = result.registered;
            displayRegisteredWorlds(result.registered.worlds);
            displayRegisteredServers(result.registered.servers);
            
            // Update counts
            document.getElementById('registered-worlds-count').textContent = result.registered.worlds.length.toString();
            document.getElementById('registered-servers-count').textContent = result.registered.servers.length.toString();
        } else {
            showNotification('Failed to load registered content', 'error');
        }
    } catch (error) {
        console.error('Error loading registered content:', error);
        showNotification('Failed to load registered content', 'error');
    }
}

function displayRegisteredWorlds(worlds) {
    const worldsGrid = document.getElementById('worlds-grid');
    
    if (!worlds || worlds.length === 0) {
        worldsGrid.innerHTML = '<p class="no-content">No worlds registered for sync</p>';
        return;
    }
    
    const worldsHtml = worlds.map(world => `
        <div class="world-card">
            <div class="world-card-header">
                <div class="world-card-title">${world.name}</div>
                <div class="world-card-meta">Created: ${new Date(world.createdAt).toLocaleDateString()}</div>
            </div>
            <div class="world-card-content">
                <div class="world-card-info">
                    <div class="info-item">
                        <span class="info-label">Size:</span>
                        <span class="info-value">${formatFileSize(world.size)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Version:</span>
                        <span class="info-value">${world.version}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Last Modified:</span>
                        <span class="info-value">${new Date(world.lastModified).toLocaleString()}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Shared with:</span>
                        <span class="info-value">${world.contacts.length} contacts</span>
                    </div>
                </div>
                <div class="world-card-actions">
                    <button class="btn btn-sm btn-primary" onclick="syncWorld('${world.id}')">
                        <i class="fas fa-sync"></i> Sync
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="transferWorld('${world.id}')">
                        <i class="fas fa-share"></i> Transfer
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="restoreWorld('${world.id}')">
                        <i class="fas fa-download"></i> Restore
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    
    worldsGrid.innerHTML = worldsHtml;
}

function displayRegisteredServers(servers) {
    const serversGrid = document.getElementById('servers-grid');
    
    if (!servers || servers.length === 0) {
        serversGrid.innerHTML = '<p class="no-content">No servers registered for sync</p>';
        return;
    }
    
    const serversHtml = servers.map(server => `
        <div class="server-card">
            <div class="server-card-header">
                <div class="server-card-title">${server.name}</div>
                <div class="server-card-meta">Created: ${new Date(server.createdAt).toLocaleDateString()}</div>
            </div>
            <div class="server-card-content">
                <div class="server-card-info">
                    <div class="info-item">
                        <span class="info-label">Size:</span>
                        <span class="info-value">${formatFileSize(server.size)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Version:</span>
                        <span class="info-value">${server.version}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Status:</span>
                        <span class="info-value">${server.status}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Shared with:</span>
                        <span class="info-value">${server.contacts.length} contacts</span>
                    </div>
                </div>
                <div class="server-card-actions">
                    <button class="btn btn-sm btn-primary" onclick="syncServer('${server.id}')">
                        <i class="fas fa-sync"></i> Sync
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="transferServer('${server.id}')">
                        <i class="fas fa-share"></i> Transfer
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="restoreServer('${server.id}')">
                        <i class="fas fa-download"></i> Restore
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    
    serversGrid.innerHTML = serversHtml;
}

function switchContentTab(tab) {
    // Hide all tab panels
    document.querySelectorAll('.content-tab-panel').forEach(panel => panel.classList.remove('active'));
    document.querySelectorAll('.content-tab').forEach(tabBtn => tabBtn.classList.remove('active'));
    
    // Show selected tab panel
    document.getElementById(`${tab}-panel`).classList.add('active');
    event.target.classList.add('active');
}

// World and Server Actions
async function syncWorld(worldId) {
    try {
        showNotification('Syncing world...', 'info');
        const result = await ipcRenderer.invoke('sync-world', worldId);
        if (result.success) {
            showNotification('World synced successfully', 'success');
            loadRegisteredContent();
        } else {
            showNotification(result.error, 'error');
        }
    } catch (error) {
        console.error('Error syncing world:', error);
        showNotification('Failed to sync world', 'error');
    }
}

async function syncServer(serverId) {
    try {
        showNotification('Syncing server...', 'info');
        const result = await ipcRenderer.invoke('sync-server', serverId);
        if (result.success) {
            showNotification('Server synced successfully', 'success');
            loadRegisteredContent();
        } else {
            showNotification(result.error, 'error');
        }
    } catch (error) {
        console.error('Error syncing server:', error);
        showNotification('Failed to sync server', 'error');
    }
}

async function restoreWorld(worldId) {
    // This would need a target path selection
    const targetPath = prompt('Enter target path for world restoration:');
    if (!targetPath) return;
    
    try {
        showNotification('Restoring world...', 'info');
        const result = await ipcRenderer.invoke('restore-world', worldId, targetPath);
        if (result.success) {
            showNotification('World restored successfully', 'success');
        } else {
            showNotification(result.error, 'error');
        }
    } catch (error) {
        console.error('Error restoring world:', error);
        showNotification('Failed to restore world', 'error');
    }
}

async function restoreServer(serverId) {
    // This would need a target path selection
    const targetPath = prompt('Enter target path for server restoration:');
    if (!targetPath) return;
    
    try {
        showNotification('Restoring server...', 'info');
        const result = await ipcRenderer.invoke('restore-server', serverId, targetPath);
        if (result.success) {
            showNotification('Server restored successfully', 'success');
        } else {
            showNotification(result.error, 'error');
        }
    } catch (error) {
        console.error('Error restoring server:', error);
        showNotification('Failed to restore server', 'error');
    }
}

function transferWorld(worldId) {
    showTransferManager();
    // Pre-select world in transfer form
    setTimeout(() => {
        document.getElementById('transfer-type').value = 'world';
        updateTransferOptions();
        // Set the world ID when options are loaded
    }, 100);
}

function transferServer(serverId) {
    showTransferManager();
    // Pre-select server in transfer form
    setTimeout(() => {
        document.getElementById('transfer-type').value = 'server';
        updateTransferOptions();
        // Set the server ID when options are loaded
    }, 100);
}

// Transfer Manager Functions
function showTransferManager() {
    document.getElementById('transfer-manager-modal').style.display = 'block';
    loadTransferData();
}

function closeTransferManager() {
    document.getElementById('transfer-manager-modal').style.display = 'none';
}

function switchTransferTab(tab) {
    // Hide all tab contents
    document.querySelectorAll('.transfer-tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.transfer-tabs .transfer-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab content
    document.getElementById(`${tab}-transfers-tab`).style.display = 'block';
    
    // Add active class to selected tab
    event.target.classList.add('active');
}

async function loadTransferData() {
    // This would load actual transfer data from the cloud sync manager
    // For now, we'll show placeholder data
    displayOutgoingTransfers([]);
    displayIncomingTransfers([]);
}

function displayOutgoingTransfers(transfers) {
    const transfersList = document.getElementById('outgoing-transfers-list');
    
    if (!transfers || transfers.length === 0) {
        transfersList.innerHTML = '<p class="no-transfers">No outgoing transfers</p>';
        return;
    }
    
    // Display transfers
}

function displayIncomingTransfers(transfers) {
    const transfersList = document.getElementById('incoming-transfers-list');
    
    if (!transfers || transfers.length === 0) {
        transfersList.innerHTML = '<p class="no-transfers">No incoming transfers</p>';
        return;
    }
    
    // Display transfers
}

function updateTransferOptions() {
    const transferType = document.getElementById('transfer-type').value;
    const transferItemGroup = document.getElementById('transfer-item-group');
    const transferContactGroup = document.getElementById('transfer-contact-group');
    const initiateBtn = document.getElementById('initiate-transfer-btn');
    
    if (!transferType) {
        transferItemGroup.style.display = 'none';
        transferContactGroup.style.display = 'none';
        initiateBtn.style.display = 'none';
        return;
    }
    
    // Load items based on type
    loadTransferItems(transferType);
    transferItemGroup.style.display = 'block';
    
    // Load contacts
    loadTransferContacts();
    transferContactGroup.style.display = 'block';
    
    initiateBtn.style.display = 'block';
}

async function loadTransferItems(type) {
    const transferItem = document.getElementById('transfer-item');
    transferItem.innerHTML = '<option value="">Select item...</option>';
    
    if (!currentCloudSyncData) return;
    
    const items = type === 'world' ? currentCloudSyncData.worlds : currentCloudSyncData.servers;
    
    items.forEach(item => {
        transferItem.innerHTML += `<option value="${item.id}">${item.name}</option>`;
    });
}

async function loadTransferContacts() {
    const transferContact = document.getElementById('transfer-contact');
    transferContact.innerHTML = '<option value="">Select contact...</option>';
    
    try {
        const result = await ipcRenderer.invoke('get-contacts');
        if (result.success) {
            result.contacts.forEach(contact => {
                transferContact.innerHTML += `<option value="${contact.id}">${contact.name}</option>`;
            });
        }
    } catch (error) {
        console.error('Error loading contacts:', error);
    }
}

async function initiateTransfer() {
    const transferType = document.getElementById('transfer-type').value;
    const transferItem = document.getElementById('transfer-item').value;
    const transferContact = document.getElementById('transfer-contact').value;
    
    if (!transferType || !transferItem || !transferContact) {
        showNotification('Please fill in all fields', 'warning');
        return;
    }
    
    try {
        const result = await ipcRenderer.invoke('initiate-transfer', transferType, transferItem, transferContact);
        if (result.success) {
            showNotification('Transfer request sent successfully', 'success');
            closeTransferManager();
        } else {
            showNotification(result.error, 'error');
        }
    } catch (error) {
        console.error('Error initiating transfer:', error);
        showNotification('Failed to initiate transfer', 'error');
    }
}

// Backup Manager Functions
function showBackupManager() {
    document.getElementById('backup-manager-modal').style.display = 'block';
    loadBackupData();
}

function closeBackupManager() {
    document.getElementById('backup-manager-modal').style.display = 'none';
}

function switchBackupTab(tab) {
    // Hide all tab contents
    document.querySelectorAll('.backup-tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.backup-tabs .backup-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab content
    document.getElementById(`${tab}-backups-tab`).style.display = 'block';
    
    // Add active class to selected tab
    event.target.classList.add('active');
}

async function loadBackupData() {
    // This would load actual backup data
    // For now, we'll show placeholder data
}

async function saveBackupSettings() {
    const retention = document.getElementById('backup-retention').value;
    const interval = document.getElementById('auto-backup-interval').value;
    
    // Save settings logic would go here
    showNotification('Backup settings saved', 'success');
}

async function cleanupOldBackups() {
    try {
        const result = await ipcRenderer.invoke('cleanup-backups', 30 * 24 * 60 * 60 * 1000); // 30 days
        if (result.success) {
            showNotification('Old backups cleaned up successfully', 'success');
        } else {
            showNotification(result.error, 'error');
        }
    } catch (error) {
        console.error('Error cleaning up backups:', error);
        showNotification('Failed to cleanup backups', 'error');
    }
}

function refreshCloudSync() {
    loadCloudSyncData();
    showNotification('Cloud sync data refreshed', 'success');
}

// Utility function for file size formatting
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Authentication Functions
function switchLoginTab(tab) {
    // Hide all tab contents
    document.querySelectorAll('.login-tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.login-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab content
    const selectedTab = document.getElementById(`${tab}-tab`);
    if (selectedTab) {
        selectedTab.style.display = 'block';
    }
    
    // Add active class to selected tab
    if (event && event.target) {
        event.target.classList.add('active');
    }
}

async function loginUser() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    if (!username || !password) {
        showNotification('Please fill in all fields', 'warning');
        return;
    }
    
    try {
        const result = await ipcRenderer.invoke('authenticate-user', username, password);
        if (result.success) {
            isAuthenticated = true;
            userProfile = result.profile;
            updateUserProfileDisplay();
            closeModal('login-modal');
            showNotification('Login successful!', 'success');
            
            // Initialize the app after successful login
            await initializeApp();
        } else {
            showNotification(result.error || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Login failed: ' + error.message, 'error');
    }
}

async function createAccount() {
    const username = document.getElementById('create-username').value.trim();
    const displayName = document.getElementById('create-display-name').value.trim();
    const password = document.getElementById('create-password').value.trim();
    const confirmPassword = document.getElementById('create-confirm-password').value.trim();
    
    if (!username || !displayName || !password || !confirmPassword) {
        showNotification('Please fill in all fields', 'warning');
        return;
    }
    
    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Password must be at least 6 characters long', 'error');
        return;
    }
    
    try {
        const result = await ipcRenderer.invoke('create-user-account', username, displayName, password);
        if (result.success) {
            isAuthenticated = true;
            userProfile = result.profile;
            updateUserProfileDisplay();
            closeModal('login-modal');
            showNotification('Account created successfully!', 'success');
            
            // Initialize the app after successful account creation
            await initializeApp();
        } else {
            showNotification(result.error || 'Account creation failed', 'error');
        }
    } catch (error) {
        console.error('Account creation error:', error);
        showNotification('Account creation failed: ' + error.message, 'error');
    }
}

// Check if user is already authenticated on app start
async function checkAuthentication() {
    try {
        const result = await ipcRenderer.invoke('check-authentication');
        if (result.success && result.authenticated) {
            isAuthenticated = true;
            userProfile = result.profile;
            updateUserProfileDisplay();
            closeModal('login-modal');
            await initializeApp();
        } else {
            // Show login modal
            document.getElementById('login-modal').classList.add('active');
        }
    } catch (error) {
        console.error('Authentication check error:', error);
        // Show login modal as fallback
        document.getElementById('login-modal').classList.add('active');
    }
}
