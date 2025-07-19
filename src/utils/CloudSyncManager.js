const { EventEmitter } = require('events');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const archiver = require('archiver');
const extract = require('extract-zip');

class CloudSyncManager extends EventEmitter {
  constructor(networkManager) {
    super();
    this.networkManager = networkManager;
    this.syncDir = path.join(os.homedir(), '.multimc-hub', 'cloud-sync');
    this.worldsDir = path.join(this.syncDir, 'worlds');
    this.serversDir = path.join(this.syncDir, 'servers');
    this.backupsDir = path.join(this.syncDir, 'backups');
    this.metadataDir = path.join(this.syncDir, 'metadata');
    this.ensureDirectories();
    
    // Sync state
    this.syncState = new Map(); // Track sync status for each world/server
    this.pendingTransfers = new Map(); // Track pending transfers
    this.autoSyncEnabled = true;
    this.syncInterval = 5 * 60 * 1000; // 5 minutes
    
    // Start auto-sync
    this.startAutoSync();
  }

  ensureDirectories() {
    fs.ensureDirSync(this.syncDir);
    fs.ensureDirSync(this.worldsDir);
    fs.ensureDirSync(this.serversDir);
    fs.ensureDirSync(this.backupsDir);
    fs.ensureDirSync(this.metadataDir);
  }

  startAutoSync() {
    if (this.autoSyncEnabled) {
      setInterval(() => {
        this.performAutoSync();
      }, this.syncInterval);
    }
  }

  async performAutoSync() {
    try {
      const contacts = this.networkManager.getContacts();
      if (contacts.length === 0) return;

      // Sync all active worlds and servers
      await this.syncAllWorlds();
      await this.syncAllServers();
      
      this.emit('auto-sync-completed', {
        timestamp: new Date().toISOString(),
        contacts: contacts.length
      });
    } catch (error) {
      console.error('Auto-sync failed:', error);
      this.emit('auto-sync-error', error);
    }
  }

  // World Management
  async registerWorld(worldPath, worldName, serverId) {
    const worldId = crypto.randomUUID();
    const worldInfo = {
      id: worldId,
      name: worldName,
      path: worldPath,
      serverId: serverId,
      owner: this.networkManager.getLocalPeerId(),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      size: await this.getDirectorySize(worldPath),
      version: '1.0.0',
      contacts: this.networkManager.getContacts().map(c => c.id)
    };

    const metadataPath = path.join(this.metadataDir, `${worldId}.json`);
    await fs.writeJson(metadataPath, worldInfo);

    // Create initial backup
    await this.createWorldBackup(worldId, worldPath);

    this.emit('world-registered', worldInfo);
    return worldInfo;
  }

  async syncWorld(worldId) {
    const metadataPath = path.join(this.metadataDir, `${worldId}.json`);
    if (!await fs.pathExists(metadataPath)) {
      throw new Error('World not found');
    }

    const worldInfo = await fs.readJson(metadataPath);
    const worldPath = worldInfo.path;

    if (!await fs.pathExists(worldPath)) {
      throw new Error('World directory not found');
    }

    // Check if world has been modified
    const currentSize = await this.getDirectorySize(worldPath);
    const lastModified = await this.getLastModified(worldPath);

    if (currentSize !== worldInfo.size || lastModified > worldInfo.lastModified) {
      // World has been modified, create new backup
      await this.createWorldBackup(worldId, worldPath);
      
      // Update metadata
      worldInfo.size = currentSize;
      worldInfo.lastModified = lastModified;
      worldInfo.version = this.incrementVersion(worldInfo.version);
      
      await fs.writeJson(metadataPath, worldInfo);

      // Notify contacts about the update
      await this.notifyContactsOfUpdate('world', worldId, worldInfo);
    }

    this.emit('world-synced', worldInfo);
    return worldInfo;
  }

  async syncAllWorlds() {
    const worldFiles = await fs.readdir(this.metadataDir);
    const worldMetadatas = worldFiles.filter(f => f.endsWith('.json'));

    for (const metadataFile of worldMetadatas) {
      const worldId = metadataFile.replace('.json', '');
      try {
        await this.syncWorld(worldId);
      } catch (error) {
        console.error(`Failed to sync world ${worldId}:`, error);
      }
    }
  }

  async createWorldBackup(worldId, worldPath) {
    const backupPath = path.join(this.backupsDir, `${worldId}-${Date.now()}.zip`);
    
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(backupPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        this.emit('world-backup-created', { worldId, backupPath });
        resolve(backupPath);
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      archive.directory(worldPath, false);
      archive.finalize();
    });
  }

  async restoreWorld(worldId, targetPath) {
    const metadataPath = path.join(this.metadataDir, `${worldId}.json`);
    if (!await fs.pathExists(metadataPath)) {
      throw new Error('World not found');
    }

    const worldInfo = await fs.readJson(metadataPath);
    const backupFiles = await fs.readdir(this.backupsDir);
    const worldBackups = backupFiles.filter(f => f.startsWith(worldId) && f.endsWith('.zip'));
    
    if (worldBackups.length === 0) {
      throw new Error('No backups found for world');
    }

    // Get the latest backup
    const latestBackup = worldBackups.sort().pop();
    const backupPath = path.join(this.backupsDir, latestBackup);

    // Extract backup to target path
    await extract(backupPath, { dir: targetPath });

    this.emit('world-restored', { worldId, targetPath });
    return { worldId, targetPath, backupUsed: latestBackup };
  }

  // Server Management
  async registerServer(serverPath, serverName, serverConfig) {
    const serverId = crypto.randomUUID();
    const serverInfo = {
      id: serverId,
      name: serverName,
      path: serverPath,
      config: serverConfig,
      owner: this.networkManager.getLocalPeerId(),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      size: await this.getDirectorySize(serverPath),
      version: '1.0.0',
      contacts: this.networkManager.getContacts().map(c => c.id),
      status: 'active'
    };

    const metadataPath = path.join(this.metadataDir, `server-${serverId}.json`);
    await fs.writeJson(metadataPath, serverInfo);

    // Create initial backup
    await this.createServerBackup(serverId, serverPath);

    this.emit('server-registered', serverInfo);
    return serverInfo;
  }

  async syncServer(serverId) {
    const metadataPath = path.join(this.metadataDir, `server-${serverId}.json`);
    if (!await fs.pathExists(metadataPath)) {
      throw new Error('Server not found');
    }

    const serverInfo = await fs.readJson(metadataPath);
    const serverPath = serverInfo.path;

    if (!await fs.pathExists(serverPath)) {
      throw new Error('Server directory not found');
    }

    // Check if server has been modified
    const currentSize = await this.getDirectorySize(serverPath);
    const lastModified = await this.getLastModified(serverPath);

    if (currentSize !== serverInfo.size || lastModified > serverInfo.lastModified) {
      // Server has been modified, create new backup
      await this.createServerBackup(serverId, serverPath);
      
      // Update metadata
      serverInfo.size = currentSize;
      serverInfo.lastModified = lastModified;
      serverInfo.version = this.incrementVersion(serverInfo.version);
      
      await fs.writeJson(metadataPath, serverInfo);

      // Notify contacts about the update
      await this.notifyContactsOfUpdate('server', serverId, serverInfo);
    }

    this.emit('server-synced', serverInfo);
    return serverInfo;
  }

  async syncAllServers() {
    const serverFiles = await fs.readdir(this.metadataDir);
    const serverMetadatas = serverFiles.filter(f => f.startsWith('server-') && f.endsWith('.json'));

    for (const metadataFile of serverMetadatas) {
      const serverId = metadataFile.replace('server-', '').replace('.json', '');
      try {
        await this.syncServer(serverId);
      } catch (error) {
        console.error(`Failed to sync server ${serverId}:`, error);
      }
    }
  }

  async createServerBackup(serverId, serverPath) {
    const backupPath = path.join(this.backupsDir, `server-${serverId}-${Date.now()}.zip`);
    
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(backupPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        this.emit('server-backup-created', { serverId, backupPath });
        resolve(backupPath);
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      archive.directory(serverPath, false);
      archive.finalize();
    });
  }

  async restoreServer(serverId, targetPath) {
    const metadataPath = path.join(this.metadataDir, `server-${serverId}.json`);
    if (!await fs.pathExists(metadataPath)) {
      throw new Error('Server not found');
    }

    const serverInfo = await fs.readJson(metadataPath);
    const backupFiles = await fs.readdir(this.backupsDir);
    const serverBackups = backupFiles.filter(f => f.startsWith(`server-${serverId}`) && f.endsWith('.zip'));
    
    if (serverBackups.length === 0) {
      throw new Error('No backups found for server');
    }

    // Get the latest backup
    const latestBackup = serverBackups.sort().pop();
    const backupPath = path.join(this.backupsDir, latestBackup);

    // Extract backup to target path
    await extract(backupPath, { dir: targetPath });

    this.emit('server-restored', { serverId, targetPath });
    return { serverId, targetPath, backupUsed: latestBackup };
  }

  // Transfer Management
  async initiateTransfer(type, id, targetContactId) {
    const transferId = crypto.randomUUID();
    const transferInfo = {
      id: transferId,
      type: type, // 'world' or 'server'
      sourceId: id,
      sourceContactId: this.networkManager.getLocalPeerId(),
      targetContactId: targetContactId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      progress: 0
    };

    this.pendingTransfers.set(transferId, transferInfo);

    // Notify target contact about the transfer
    await this.networkManager.sendToPeer(targetContactId, 'transfer-request', transferInfo);

    this.emit('transfer-initiated', transferInfo);
    return transferInfo;
  }

  async acceptTransfer(transferId) {
    const transfer = this.pendingTransfers.get(transferId);
    if (!transfer) {
      throw new Error('Transfer not found');
    }

    transfer.status = 'accepted';
    transfer.acceptedAt = new Date().toISOString();

    // Start the actual transfer
    await this.performTransfer(transfer);

    this.emit('transfer-accepted', transfer);
    return transfer;
  }

  async declineTransfer(transferId) {
    const transfer = this.pendingTransfers.get(transferId);
    if (!transfer) {
      throw new Error('Transfer not found');
    }

    transfer.status = 'declined';
    transfer.declinedAt = new Date().toISOString();

    // Notify source contact about the decline
    await this.networkManager.sendToPeer(transfer.sourceContactId, 'transfer-declined', transfer);

    this.emit('transfer-declined', transfer);
    return transfer;
  }

  async performTransfer(transfer) {
    try {
      transfer.status = 'transferring';
      transfer.startedAt = new Date().toISOString();

      if (transfer.type === 'world') {
        await this.transferWorld(transfer);
      } else if (transfer.type === 'server') {
        await this.transferServer(transfer);
      }

      transfer.status = 'completed';
      transfer.completedAt = new Date().toISOString();
      transfer.progress = 100;

      this.emit('transfer-completed', transfer);
    } catch (error) {
      transfer.status = 'failed';
      transfer.error = error.message;
      transfer.failedAt = new Date().toISOString();

      this.emit('transfer-failed', transfer);
      throw error;
    }
  }

  async transferWorld(transfer) {
    // Create a backup of the world
    const worldInfo = await this.getWorldInfo(transfer.sourceId);
    const backupPath = await this.createWorldBackup(transfer.sourceId, worldInfo.path);

    // Send the backup file to the target contact
    await this.sendFileToContact(backupPath, transfer.targetContactId, {
      type: 'world-backup',
      worldId: transfer.sourceId,
      transferId: transfer.id
    });
  }

  async transferServer(transfer) {
    // Create a backup of the server
    const serverInfo = await this.getServerInfo(transfer.sourceId);
    const backupPath = await this.createServerBackup(transfer.sourceId, serverInfo.path);

    // Send the backup file to the target contact
    await this.sendFileToContact(backupPath, transfer.targetContactId, {
      type: 'server-backup',
      serverId: transfer.sourceId,
      transferId: transfer.id
    });
  }

  async sendFileToContact(filePath, contactId, metadata) {
    // This would integrate with the network manager to send files
    // For now, we'll emit an event that the network manager can handle
    this.emit('file-transfer-request', {
      filePath,
      contactId,
      metadata
    });
  }

  // Utility Methods
  async getDirectorySize(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      if (stats.isFile()) {
        return stats.size;
      }

      const files = await fs.readdir(dirPath);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        totalSize += await this.getDirectorySize(filePath);
      }

      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  async getLastModified(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      return stats.mtime.toISOString();
    } catch (error) {
      return new Date().toISOString();
    }
  }

  incrementVersion(version) {
    const parts = version.split('.');
    parts[2] = (parseInt(parts[2]) + 1).toString();
    return parts.join('.');
  }

  async getWorldInfo(worldId) {
    const metadataPath = path.join(this.metadataDir, `${worldId}.json`);
    if (!await fs.pathExists(metadataPath)) {
      throw new Error('World not found');
    }
    return await fs.readJson(metadataPath);
  }

  async getServerInfo(serverId) {
    const metadataPath = path.join(this.metadataDir, `server-${serverId}.json`);
    if (!await fs.pathExists(metadataPath)) {
      throw new Error('Server not found');
    }
    return await fs.readJson(metadataPath);
  }

  async notifyContactsOfUpdate(type, id, info) {
    const contacts = this.networkManager.getContacts();
    
    for (const contact of contacts) {
      try {
        await this.networkManager.sendToPeer(contact.id, `${type}-updated`, {
          type,
          id,
          info,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error(`Failed to notify contact ${contact.id}:`, error);
      }
    }
  }

  // Get sync status
  getSyncStatus() {
    return {
      autoSyncEnabled: this.autoSyncEnabled,
      pendingTransfers: this.pendingTransfers.size,
      lastSync: new Date().toISOString()
    };
  }

  // Get all registered worlds and servers
  async getAllRegistered() {
    const files = await fs.readdir(this.metadataDir);
    const worlds = [];
    const servers = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const metadataPath = path.join(this.metadataDir, file);
        const info = await fs.readJson(metadataPath);
        
        if (file.startsWith('server-')) {
          servers.push(info);
        } else {
          worlds.push(info);
        }
      }
    }

    return { worlds, servers };
  }

  // Clean up old backups
  async cleanupOldBackups(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 days
    const backupFiles = await fs.readdir(this.backupsDir);
    const now = Date.now();

    for (const file of backupFiles) {
      const filePath = path.join(this.backupsDir, file);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        await fs.remove(filePath);
        console.log(`Cleaned up old backup: ${file}`);
      }
    }
  }
}

module.exports = { CloudSyncManager }; 