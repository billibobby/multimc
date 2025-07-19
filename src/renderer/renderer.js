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

// DOM Elements
const tabItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');
const pageTitle = document.getElementById('page-title');
const connectionStatus = document.getElementById('connection-status');
const connectionText = document.getElementById('connection-text');
const userName = document.getElementById('user-name');
const sidebarUserName = document.getElementById('sidebar-user-name');
const sidebarUserPlatform = document.getElementById('sidebar-user-platform');

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
    
    // Add event listener for server type change
    document.addEventListener('DOMContentLoaded', () => {
        const typeSelect = document.getElementById('server-type');
        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                populateVersionDropdown();
            });
        }
    });
}

async function loadInitialData() {
    try {
        // Load user profile first
        await loadUserProfile();

        // Load system status
        systemStatus = await ipcRenderer.invoke('get-system-status');
        updateSystemStatus();

        // Load network status
        networkStatus = await ipcRenderer.invoke('get-network-status');
        updateNetworkStatus();
        updateConnectionStatus();

        // Load server status
        serverStatus = await ipcRenderer.invoke('get-server-status');
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

    content.innerHTML = statusItems.join('');
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

    const serverItems = serverStatus.activeServers.map(server => `
        <div class="server-card" onclick="showServerDetails('${server.id}')">
            <div class="server-header">
                <div class="server-name">${server.name}</div>
                <div class="server-status ${server.status}">${server.status}</div>
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
                    <div class="server-info-label">Host</div>
                    <div class="server-info-value">${server.hostId.substring(0, 8)}...</div>
                </div>
            </div>
        </div>
    `);

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

    const serverCards = serverStatus.activeServers.map(server => `
        <div class="server-card" onclick="showServerDetails('${server.id}')">
            <div class="server-header">
                <div class="server-name">${server.name}</div>
                <div class="server-status ${server.status}">${server.status}</div>
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
    `);

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
    const minecraftVersions = document.getElementById('minecraft-versions');
    const forgeVersions = document.getElementById('forge-versions');

    try {
        // Load Minecraft versions
        if (systemStatus && systemStatus.checks.minecraft) {
            const versions = systemStatus.checks.minecraft.availableVersions || [];
            const installed = systemStatus.checks.minecraft.installedVersions || [];
            
            const versionItems = versions.slice(0, 10).map(version => {
                const isInstalled = installed.includes(version.id);
                return `
                    <div class="version-item">
                        <div class="version-info">
                            <div class="version-name">${version.id}</div>
                            <div class="version-date">${new Date(version.releaseTime).toLocaleDateString()}</div>
                        </div>
                        <button class="btn btn-sm ${isInstalled ? 'btn-secondary' : 'btn-primary'}" 
                                onclick="downloadMinecraft('${version.id}')" 
                                ${isInstalled ? 'disabled' : ''}>
                            ${isInstalled ? 'Installed' : 'Download'}
                        </button>
                    </div>
                `;
            });
            minecraftVersions.innerHTML = versionItems.join('');
        }

        // Load Forge versions (simplified)
        forgeVersions.innerHTML = `
            <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.7);">
                <i class="fas fa-tools" style="font-size: 48px; margin-bottom: 20px;"></i>
                <p>Forge versions will be available soon</p>
            </div>
        `;
    } catch (error) {
        console.error('Failed to load downloads data:', error);
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
    
    // Always refresh system status to get latest version data
    try {
        systemStatus = await ipcRenderer.invoke('get-system-status');
        console.log('System status refreshed:', systemStatus);
    } catch (error) {
        console.error('Failed to load system status:', error);
        showNotification('Failed to load system status', 'error');
    }
    
    // Populate version dropdown
    populateVersionDropdown();
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
                        onclick="downloadMinecraft('${version.id}')" 
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
            <button class="btn btn-sm btn-primary" onclick="downloadForge('1.20.1')">
                <i class="fas fa-download"></i> Download
            </button>
        </div>
        <div class="download-option">
            <div class="download-info">
                <div class="download-name">Forge 1.19.2</div>
                <div class="download-date">Popular modded version</div>
            </div>
            <button class="btn btn-sm btn-primary" onclick="downloadForge('1.19.2')">
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
        </div>
    `;
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
    const name = document.getElementById('server-name').value;
    const type = document.getElementById('server-type').value;
    const version = document.getElementById('server-version').value;
    const port = parseInt(document.getElementById('server-port').value);
    const maxPlayers = parseInt(document.getElementById('max-players-input').value);
    const autoStart = document.getElementById('auto-start-server').checked;

    if (!name || !type || !version) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    // Show loading notification
    showNotification('Starting server...', 'info');

    try {
        const result = await ipcRenderer.invoke('start-server', {
            name,
            type,
            version,
            port,
            maxPlayers,
            autoStart
        });

        if (result.success) {
            showNotification('Server started successfully!', 'success');
            closeModal('start-server-modal');
            refreshStatus();
        } else {
            showNotification(`Failed to start server: ${result.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Error starting server: ${error.message}`, 'error');
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
async function downloadMinecraft(version) {
    try {
        const result = await ipcRenderer.invoke('download-minecraft', version);
        if (result.success) {
            showNotification(`Minecraft ${version} downloaded successfully!`, 'success');
            refreshStatus();
        } else {
            showNotification(`Failed to download Minecraft: ${result.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Error downloading Minecraft: ${error.message}`, 'error');
    }
}

async function downloadForge(version) {
    try {
        const result = await ipcRenderer.invoke('download-forge', version);
        if (result.success) {
            showNotification(`Forge ${version} downloaded successfully!`, 'success');
            refreshStatus();
        } else {
            showNotification(`Failed to download Forge: ${result.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Error downloading Forge: ${error.message}`, 'error');
    }
}

// Utility functions
function populateVersionDropdown() {
    const versionSelect = document.getElementById('server-version');
    const typeSelect = document.getElementById('server-type');
    
    versionSelect.innerHTML = '<option value="">Select version...</option>';
    
    const serverType = typeSelect.value;
    
    // Get available versions from system status based on server type
    let availableVersions = [];
    let installedVersions = [];
    
    if (systemStatus) {
        if (serverType === 'vanilla' && systemStatus.checks.minecraft) {
            availableVersions = systemStatus.checks.minecraft.availableVersions || [];
            installedVersions = systemStatus.checks.minecraft.installedVersions || [];
        } else if (serverType === 'forge' && systemStatus.checks.forge) {
            availableVersions = systemStatus.checks.forge.availableVersions || [];
            installedVersions = systemStatus.checks.forge.installedVersions || [];
        }
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
    }
    
    // Add available versions
    if (availableVersions.length > 0) {
        const availableGroup = document.createElement('optgroup');
        availableGroup.label = 'Available Versions';
        
        availableVersions.slice(0, 10).forEach(version => {
            const option = document.createElement('option');
            option.value = version.id || version;
            option.textContent = version.id ? `${version.id} (${new Date(version.releaseTime).toLocaleDateString()})` : version;
            availableGroup.appendChild(option);
        });
        
        versionSelect.appendChild(availableGroup);
    }
    
    // If no versions are available, add some default options
    if (availableVersions.length === 0 && installedVersions.length === 0) {
        const defaultVersions = serverType === 'vanilla' 
            ? ['1.21.1', '1.20.4', '1.19.4', '1.18.2', '1.17.1']
            : ['1.20.1', '1.19.2', '1.18.2', '1.16.5', '1.15.2'];
            
        defaultVersions.forEach(version => {
            const option = document.createElement('option');
            option.value = version;
            option.textContent = `${version} (Download required)`;
            versionSelect.appendChild(option);
        });
    }
}

function copyServerAddress(address) {
    navigator.clipboard.writeText(address).then(() => {
        showNotification('Server address copied to clipboard!', 'success');
    }).catch(() => {
        showNotification('Failed to copy address', 'error');
    });
}

function refreshStatus() {
    loadInitialData();
}

function refreshNetworkStatus() {
    loadNetworkData();
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
        return check.version || check.message || 'OK';
    } else if (check.status === 'error') {
        return check.message || 'Error';
    } else {
        return check.message || 'Warning';
    }
}

function handleServerUpdate(update) {
    // Update server status when changes occur
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

// Logs functionality
async function loadLogsData() {
    try {
        // Load log files
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
    } catch (error) {
        console.error('Failed to load logs data:', error);
        showNotification('Failed to load logs', 'error');
    }
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
    displayLogs();
}

async function refreshLogs() {
    await loadLogsData();
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
window.selectLogFile = selectLogFile;
window.filterLogs = filterLogs;
window.refreshLogs = refreshLogs;
window.clearLogs = clearLogs;
window.exportLogs = exportLogs; 