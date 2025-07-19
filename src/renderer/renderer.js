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

// DOM Elements
const tabItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');
const pageTitle = document.getElementById('page-title');
const connectionStatus = document.getElementById('connection-status');
const connectionText = document.getElementById('connection-text');
const userName = document.getElementById('user-name');
const sidebarUserName = document.getElementById('sidebar-user-name');
const sidebarUserPlatform = document.getElementById('sidebar-user-platform');

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
    initializeApp();
    setupEventListeners();
    loadInitialData();
});

function initializeApp() {
    // Set up tab navigation
    tabItems.forEach(item => {
        item.addEventListener('click', async (e) => {
            e.preventDefault();
            const tab = item.getAttribute('data-tab');
            await switchTab(tab);
        });
    });
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
        // Try to get profile from network manager
        const response = await fetch('http://localhost:3003/api/profile');
        if (response.ok) {
            userProfile = await response.json();
        } else {
            // Create default profile if none exists
            userProfile = {
                id: require('crypto').randomUUID(),
                name: require('os').hostname(),
                displayName: require('os').hostname(),
                platform: require('os').platform(),
                createdAt: new Date().toISOString(),
                lastSeen: new Date().toISOString()
            };
            await saveUserProfile(userProfile);
        }
        
        updateUserProfileDisplay();
    } catch (error) {
        console.error('Failed to load user profile:', error);
        // Create a basic profile as fallback
        userProfile = {
            id: require('crypto').randomUUID(),
            name: require('os').hostname(),
            displayName: require('os').hostname(),
            platform: require('os').platform(),
            createdAt: new Date().toISOString(),
            lastSeen: new Date().toISOString()
        };
        updateUserProfileDisplay();
    }
}

async function saveUserProfile(profile) {
    try {
        const response = await fetch('http://localhost:3003/api/profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(profile)
        });
        
        if (response.ok) {
            userProfile = profile;
            updateUserProfileDisplay();
            return true;
        } else {
            throw new Error('Failed to save profile');
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

    if (serverStatus.activeServers.length === 0) {
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

    if (serverStatus.activeServers.length === 0) {
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
    if (networkStatus.peers.length === 0) {
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

async function refreshEntireApp() {
    console.log('=== REFRESHING ENTIRE APPLICATION ===');
    console.log('refreshEntireApp function called!');
    alert('Refresh function called!'); // Temporary alert for testing
    
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
        
        // Broadcast profile update to peers
        try {
            await fetch('http://localhost:3003/api/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetId: 'broadcast',
                    message: 'profile-updated',
                    data: { peerId: userProfile.id, profile: updatedProfile }
                })
            });
        } catch (error) {
            console.error('Failed to broadcast profile update:', error);
        }
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
    try {
        console.log(`=== DOWNLOADING ${loader.toUpperCase()} ${version} ===`);
        
        // Show download progress modal
        showDownloadProgressModal(loader, version);
        
        // Update progress modal with initial status
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

// Global functions for onclick handlers
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