const { EventEmitter } = require('events');
const os = require('os');
const crypto = require('crypto');
const dgram = require('dgram');
const net = require('net');
const http = require('http');
const https = require('https');
const fs = require('fs-extra');
const path = require('path');

class NetworkManager extends EventEmitter {
  constructor() {
    super();
    this.peers = new Map();
    this.localPeerId = crypto.randomUUID();
    this.discoveryPort = 3001;
    this.communicationPort = 3002;
    this.webServerPort = 3003;
    this.discoverySocket = null;
    this.communicationSocket = null;
    this.server = null;
    this.isInitialized = false;
    this.profilesDir = path.join(os.homedir(), '.multimc-hub', 'profiles');
    this.contactsDir = path.join(os.homedir(), '.multimc-hub', 'contacts');
    this.invitesDir = path.join(os.homedir(), '.multimc-hub', 'invites');
    this.ensureDirectories();
    
    // Exclusive network settings
    this.exclusiveMode = true; // Only show approved contacts
    this.requireInvite = true; // Require invitation to join network
    this.autoAcceptInvites = false; // Don't auto-accept invites
    this.contactList = new Map(); // Approved contacts
    this.pendingInvites = new Map(); // Pending invitations
    this.blockedPeers = new Set(); // Blocked peers
  }

  ensureDirectories() {
    fs.ensureDirSync(this.profilesDir);
    fs.ensureDirSync(this.contactsDir);
    fs.ensureDirSync(this.invitesDir);
  }

  async findAvailablePort(startPort) {
    const net = require('net');
    
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.listen(startPort, () => {
        const port = server.address().port;
        server.close(() => {
          resolve(port);
        });
      });
      
      server.on('error', () => {
        // Port is in use, try next port
        this.findAvailablePort(startPort + 1).then(resolve);
      });
    });
  }

  async initialize() {
    try {
      // Load contacts and invites
      await this.loadContacts();
      await this.loadInvites();
      
      // Find available ports
      this.discoveryPort = await this.findAvailablePort(this.discoveryPort);
      this.communicationPort = await this.findAvailablePort(this.communicationPort);
      this.webServerPort = await this.findAvailablePort(this.webServerPort);
      
      console.log(`Using ports - Discovery: ${this.discoveryPort}, Communication: ${this.communicationPort}, Web: ${this.webServerPort}`);
      
      await this.startDiscoveryService();
      await this.startCommunicationService();
      await this.startWebServer();
      this.isInitialized = true;
      
      // Start periodic discovery broadcast (only to contacts)
      setInterval(() => {
        this.broadcastDiscovery();
      }, 5000);

      console.log('NetworkManager initialized successfully in exclusive mode');
    } catch (error) {
      console.error('Failed to initialize NetworkManager:', error);
      throw error;
    }
  }

  async startDiscoveryService() {
    return new Promise((resolve, reject) => {
      this.discoverySocket = dgram.createSocket('udp4');
      
      this.discoverySocket.on('error', (err) => {
        console.error('Discovery socket error:', err);
        if (err.code === 'EADDRINUSE') {
          console.log(`Port ${this.discoveryPort} is in use, trying next port...`);
          this.discoveryPort++;
          this.discoverySocket.bind(this.discoveryPort);
        } else {
          reject(err);
        }
      });

      this.discoverySocket.on('message', (msg, rinfo) => {
        this.handleDiscoveryMessage(msg, rinfo);
      });

      this.discoverySocket.on('listening', () => {
        const address = this.discoverySocket.address();
        console.log(`Discovery service listening on ${address.address}:${address.port}`);
        resolve();
      });

      this.discoverySocket.bind(this.discoveryPort);
    });
  }

  async startCommunicationService() {
    return new Promise((resolve, reject) => {
      this.communicationSocket = dgram.createSocket('udp4');
      
      this.communicationSocket.on('error', (err) => {
        console.error('Communication socket error:', err);
        if (err.code === 'EADDRINUSE') {
          console.log(`Port ${this.communicationPort} is in use, trying next port...`);
          this.communicationPort++;
          this.communicationSocket.bind(this.communicationPort);
        } else {
          reject(err);
        }
      });

      this.communicationSocket.on('message', (msg, rinfo) => {
        this.handleCommunicationMessage(msg, rinfo);
      });

      this.communicationSocket.on('listening', () => {
        const address = this.communicationSocket.address();
        console.log(`Communication service listening on ${address.address}:${address.port}`);
        resolve();
      });

      this.communicationSocket.bind(this.communicationPort);
    });
  }

  async startWebServer() {
    const express = require('express');
    const app = express();
    const server = require('http').createServer(app);
    const io = require('socket.io')(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    app.use(express.json());

    // REST API endpoints
    app.get('/api/peers', (req, res) => {
      res.json(Array.from(this.peers.values()));
    });

    app.get('/api/status', (req, res) => {
      res.json(this.getStatus());
    });

    app.get('/api/profile', async (req, res) => {
      try {
        const profile = await this.getCurrentProfile();
        res.json(profile);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/profile', async (req, res) => {
      try {
        const profile = req.body;
        await this.saveProfile(profile);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/message', (req, res) => {
      const { targetId, message, data } = req.body;
      this.sendToPeer(targetId, message, data);
      res.json({ success: true });
    });

    // WebSocket connections for real-time updates
    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('join-network', async (peerInfo) => {
        const profile = await this.getCurrentProfile();
        this.addPeer(socket.id, {
          ...peerInfo,
          ...profile,
          socketId: socket.id,
          address: socket.handshake.address
        });
        socket.emit('network-status', this.getStatus());
      });

      socket.on('update-profile', async (profileData) => {
        await this.saveProfile(profileData);
        // Broadcast profile update to all peers
        this.broadcast('profile-updated', { peerId: this.localPeerId, profile: profileData });
      });

      socket.on('disconnect', () => {
        this.removePeer(socket.id);
      });

      socket.on('server-command', (data) => {
        this.emit('server-command', data);
      });
    });

    this.server = server;
    this.io = io;
    
    return new Promise((resolve, reject) => {
      server.listen(this.webServerPort, () => {
        console.log(`Web server listening on port ${this.webServerPort}`);
        resolve();
      });
      
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`Port ${this.webServerPort} is in use, trying next port...`);
          this.webServerPort++;
          server.listen(this.webServerPort);
        } else {
          reject(err);
        }
      });
    });
  }

  handleDiscoveryMessage(msg, rinfo) {
    try {
      const message = JSON.parse(msg.toString());
      
      if (message.type === 'discovery' && message.peerId !== this.localPeerId) {
        const sourceId = message.peerId;
        
        // Only respond to contacts or if we're not in exclusive mode
        if (!this.exclusiveMode || this.isContact(sourceId)) {
          console.log(`Discovery from contact ${sourceId} at ${rinfo.address}:${rinfo.port}`);
          
          // Found a new peer
          const peerInfo = {
            id: message.peerId,
            name: message.name,
            displayName: message.displayName,
            address: rinfo.address,
            discoveryPort: message.discoveryPort,
            communicationPort: message.communicationPort,
            platform: message.platform,
            lastSeen: Date.now()
          };

          this.addPeer(message.peerId, peerInfo);
          
          // Respond with our own discovery message
          this.sendDiscoveryResponse(rinfo);
        } else {
          console.log(`Ignoring discovery from unknown peer ${sourceId} (exclusive mode)`);
        }
      }
    } catch (error) {
      console.error('Error handling discovery message:', error);
    }
  }

  handleCommunicationMessage(msg, rinfo) {
    try {
      const message = JSON.parse(msg.toString());
      
      if (message.targetId === this.localPeerId || message.targetId === 'broadcast') {
        this.emit('message', message);
        
        // Handle specific message types
        switch (message.type) {
          case 'server-started':
            this.emit('server-started', message.data);
            break;
          case 'server-stopped':
            this.emit('server-stopped', message.data);
            break;
          case 'host-transfer':
            this.emit('host-transfer', message.data);
            break;
          case 'host-takeover-request':
            this.emit('host-takeover-request', message.data);
            break;
          case 'profile-updated':
            this.emit('profile-updated', message.data);
            break;
        }
      }
    } catch (error) {
      console.error('Error handling communication message:', error);
    }
  }

  async broadcastDiscovery() {
    // Check if discovery socket is available
    if (!this.discoverySocket) {
      console.warn('Discovery socket not available, skipping broadcast');
      return;
    }

    const profile = await this.getCurrentProfile();
    const discoveryMessage = {
      type: 'discovery',
      peerId: this.localPeerId,
      name: os.hostname(),
      displayName: profile ? profile.name : os.hostname(),
      discoveryPort: this.discoveryPort,
      communicationPort: this.communicationPort,
      platform: os.platform(),
      timestamp: Date.now()
    };

    const message = Buffer.from(JSON.stringify(discoveryMessage));
    
    // Broadcast to all network interfaces
    const interfaces = this.getNetworkInterfaces();
    interfaces.forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        try {
          this.discoverySocket.send(message, 0, message.length, this.discoveryPort, iface.address);
        } catch (error) {
          console.error(`Failed to send discovery message to ${iface.address}:`, error);
        }
      }
    });
  }

  sendDiscoveryResponse(rinfo) {
    // Check if discovery socket is available
    if (!this.discoverySocket) {
      console.warn('Discovery socket not available, skipping discovery response');
      return;
    }

    const response = {
      type: 'discovery-response',
      peerId: this.localPeerId,
      name: os.hostname(),
      discoveryPort: this.discoveryPort,
      communicationPort: this.communicationPort,
      timestamp: Date.now()
    };

    const message = Buffer.from(JSON.stringify(response));
    try {
      this.discoverySocket.send(message, 0, message.length, rinfo.port, rinfo.address);
    } catch (error) {
      console.error(`Failed to send discovery response to ${rinfo.address}:${rinfo.port}:`, error);
    }
  }

  async sendToPeer(peerId, messageType, data) {
    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new Error(`Peer ${peerId} not found`);
    }

    const message = {
      type: messageType,
      targetId: peerId,
      sourceId: this.localPeerId,
      data: data,
      timestamp: Date.now()
    };

    const messageBuffer = Buffer.from(JSON.stringify(message));
    
    // Try UDP first
    try {
      this.communicationSocket.send(messageBuffer, 0, messageBuffer.length, peer.communicationPort, peer.address);
    } catch (error) {
      console.error('UDP send failed, trying WebSocket:', error);
      
      // Fallback to WebSocket if available
      if (peer.socketId && this.io) {
        this.io.to(peer.socketId).emit('message', message);
      }
    }
  }

  async broadcast(messageType, data) {
    try {
      const message = {
        type: messageType,
        targetId: 'broadcast',
        sourceId: this.localPeerId,
        data: data,
        timestamp: Date.now()
      };

      const messageBuffer = Buffer.from(JSON.stringify(message));
      
      // Send to all peers
      for (const [peerId, peer] of this.peers) {
        try {
          if (this.communicationSocket && !this.communicationSocket.closed) {
            this.communicationSocket.send(messageBuffer, 0, messageBuffer.length, peer.communicationPort, peer.address);
          }
        } catch (error) {
          console.error(`Failed to send broadcast to peer ${peerId}:`, error);
        }
      }

      // Also broadcast via WebSocket
      if (this.io) {
        try {
          this.io.emit('broadcast', message);
        } catch (error) {
          console.error('Failed to broadcast via WebSocket:', error);
        }
      }
    } catch (error) {
      console.error('Failed to create broadcast message:', error);
      throw error;
    }
  }

  addPeer(peerId, peerInfo) {
    if (peerId !== this.localPeerId) {
      // Only add peers who are contacts or if we're not in exclusive mode
      if (!this.exclusiveMode || this.isContact(peerId)) {
        const existingPeer = this.peers.get(peerId);
        if (!existingPeer) {
          this.peers.set(peerId, peerInfo);
          this.emit('peer-joined', peerId, peerInfo);
          console.log(`Contact joined: ${peerInfo.displayName || peerInfo.name} (${peerId})`);
        } else {
          // Update existing peer info
          existingPeer.lastSeen = Date.now();
          existingPeer.address = peerInfo.address;
          existingPeer.displayName = peerInfo.displayName;
        }
      } else {
        console.log(`Ignoring unknown peer ${peerId} (exclusive mode)`);
      }
    }
  }

  removePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (peer) {
      this.peers.delete(peerId);
      this.emit('peer-left', peerId, peer);
      console.log(`Peer left: ${peer.displayName || peer.name} (${peerId})`);
    }
  }

  getPeer(peerId) {
    return this.peers.get(peerId);
  }

  getLocalPeerId() {
    return this.localPeerId;
  }

  getLocalAddress() {
    const interfaces = this.getNetworkInterfaces();
    const externalInterface = interfaces.find(iface => 
      iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')
    );
    return externalInterface ? externalInterface.address : '127.0.0.1';
  }

  getNetworkInterfaces() {
    const interfaces = [];
    const networkInterfaces = os.networkInterfaces();
    
    for (const [name, ifaces] of Object.entries(networkInterfaces)) {
      for (const iface of ifaces) {
        interfaces.push({
          name,
          ...iface
        });
      }
    }
    
    return interfaces;
  }

  async getPublicIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      return null;
    }
  }

  getStatus() {
    return {
      localPeerId: this.localPeerId,
      localAddress: this.getLocalAddress(),
      peers: Array.from(this.peers.values()),
      totalPeers: this.peers.size,
      isInitialized: this.isInitialized
    };
  }

  async cleanup() {
    console.log('Cleaning up NetworkManager...');
    
    try {
      if (this.discoverySocket) {
        this.discoverySocket.close();
        this.discoverySocket = null;
      }
    } catch (error) {
      console.error('Error closing discovery socket:', error);
    }
    
    try {
      if (this.communicationSocket) {
        this.communicationSocket.close();
        this.communicationSocket = null;
      }
    } catch (error) {
      console.error('Error closing communication socket:', error);
    }
    
    try {
      if (this.server) {
        this.server.close();
        this.server = null;
      }
    } catch (error) {
      console.error('Error closing web server:', error);
    }
    
    console.log('NetworkManager cleanup completed');
  }

  // Profile management methods
  async getCurrentProfile() {
    const profilePath = path.join(this.profilesDir, 'current.json');
    if (await fs.pathExists(profilePath)) {
      return await fs.readJson(profilePath);
    }
    return null;
  }

  async saveProfile(profile) {
    const profilePath = path.join(this.profilesDir, 'current.json');
    await fs.writeJson(profilePath, profile, { spaces: 2 });
  }

  async createDefaultProfile() {
    const defaultProfile = {
      id: crypto.randomUUID(),
      name: os.hostname(),
      displayName: os.hostname(),
      platform: os.platform(),
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    };
    await this.saveProfile(defaultProfile);
    return defaultProfile;
  }

  // Contact Management Methods
  async loadContacts() {
    try {
      const contactsPath = path.join(this.contactsDir, 'contacts.json');
      if (await fs.pathExists(contactsPath)) {
        const contacts = await fs.readJson(contactsPath);
        this.contactList = new Map(Object.entries(contacts));
      }
    } catch (error) {
      console.error('Failed to load contacts:', error);
      this.contactList = new Map();
    }
  }

  async saveContacts() {
    try {
      const contactsPath = path.join(this.contactsDir, 'contacts.json');
      const contacts = Object.fromEntries(this.contactList);
      await fs.writeJson(contactsPath, contacts);
    } catch (error) {
      console.error('Failed to save contacts:', error);
    }
  }

  async addContact(peerId, contactInfo) {
    const contact = {
      id: peerId,
      name: contactInfo.name || 'Unknown',
      username: contactInfo.username || peerId,
      addedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      status: 'online',
      ...contactInfo
    };
    
    this.contactList.set(peerId, contact);
    await this.saveContacts();
    this.emit('contact-added', contact);
    return contact;
  }

  async removeContact(peerId) {
    const contact = this.contactList.get(peerId);
    if (contact) {
      this.contactList.delete(peerId);
      await this.saveContacts();
      this.emit('contact-removed', contact);
      return contact;
    }
    return null;
  }

  async blockPeer(peerId) {
    this.blockedPeers.add(peerId);
    await this.removeContact(peerId);
    this.emit('peer-blocked', peerId);
  }

  async unblockPeer(peerId) {
    this.blockedPeers.delete(peerId);
    this.emit('peer-unblocked', peerId);
  }

  isContact(peerId) {
    return this.contactList.has(peerId);
  }

  isBlocked(peerId) {
    return this.blockedPeers.has(peerId);
  }

  getContacts() {
    return Array.from(this.contactList.values());
  }

  // Invitation Management
  async createInvite(peerId, inviteData = {}) {
    const invite = {
      id: crypto.randomUUID(),
      fromPeerId: this.localPeerId,
      toPeerId: peerId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      status: 'pending',
      message: inviteData.message || 'You have been invited to join my MultiMC Hub network!',
      ...inviteData
    };

    this.pendingInvites.set(invite.id, invite);
    await this.saveInvites();
    this.emit('invite-created', invite);
    return invite;
  }

  async acceptInvite(inviteId) {
    const invite = this.pendingInvites.get(inviteId);
    if (!invite) {
      throw new Error('Invite not found');
    }

    if (invite.status !== 'pending') {
      throw new Error('Invite already processed');
    }

    if (new Date() > new Date(invite.expiresAt)) {
      throw new Error('Invite has expired');
    }

    // Add to contacts
    await this.addContact(invite.fromPeerId, {
      name: invite.fromName || 'Unknown',
      username: invite.fromUsername || invite.fromPeerId
    });

    // Update invite status
    invite.status = 'accepted';
    invite.acceptedAt = new Date().toISOString();
    await this.saveInvites();

    this.emit('invite-accepted', invite);
    return invite;
  }

  async declineInvite(inviteId) {
    const invite = this.pendingInvites.get(inviteId);
    if (!invite) {
      throw new Error('Invite not found');
    }

    invite.status = 'declined';
    invite.declinedAt = new Date().toISOString();
    await this.saveInvites();

    this.emit('invite-declined', invite);
    return invite;
  }

  async loadInvites() {
    try {
      const invitesPath = path.join(this.invitesDir, 'invites.json');
      if (await fs.pathExists(invitesPath)) {
        const invites = await fs.readJson(invitesPath);
        this.pendingInvites = new Map(Object.entries(invites));
      }
    } catch (error) {
      console.error('Failed to load invites:', error);
      this.pendingInvites = new Map();
    }
  }

  async saveInvites() {
    try {
      const invitesPath = path.join(this.invitesDir, 'invites.json');
      const invites = Object.fromEntries(this.pendingInvites);
      await fs.writeJson(invitesPath, invites);
    } catch (error) {
      console.error('Failed to save invites:', error);
    }
  }

  getPendingInvites() {
    return Array.from(this.pendingInvites.values()).filter(invite => invite.status === 'pending');
  }

  // Generate invite code for sharing
  generateInviteCode() {
    const inviteCode = crypto.randomBytes(16).toString('hex').toUpperCase();
    const inviteData = {
      code: inviteCode,
      peerId: this.localPeerId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };
    
    const invitePath = path.join(this.invitesDir, `${inviteCode}.json`);
    fs.writeJsonSync(invitePath, inviteData);
    
    return inviteCode;
  }

  async redeemInviteCode(code) {
    const invitePath = path.join(this.invitesDir, `${code.toUpperCase()}.json`);
    
    if (!await fs.pathExists(invitePath)) {
      throw new Error('Invalid invite code');
    }

    const inviteData = await fs.readJson(invitePath);
    
    if (new Date() > new Date(inviteData.expiresAt)) {
      await fs.remove(invitePath);
      throw new Error('Invite code has expired');
    }

    // Create invitation
    const invite = await this.createInvite(inviteData.peerId, {
      fromPeerId: inviteData.peerId,
      inviteCode: code
    });

    // Clean up the code file
    await fs.remove(invitePath);
    
    return invite;
  }
}

module.exports = { NetworkManager }; 