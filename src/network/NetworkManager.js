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
    this.discoverySocket = null;
    this.communicationSocket = null;
    this.server = null;
    this.isInitialized = false;
    this.profilesDir = path.join(os.homedir(), '.multimc-hub', 'profiles');
    this.ensureProfilesDirectory();
  }

  ensureProfilesDirectory() {
    fs.ensureDirSync(this.profilesDir);
  }

  async initialize() {
    try {
      await this.startDiscoveryService();
      await this.startCommunicationService();
      await this.startWebServer();
      this.isInitialized = true;
      
      // Start periodic discovery broadcast
      setInterval(() => {
        this.broadcastDiscovery();
      }, 5000);

      console.log('NetworkManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize NetworkManager:', error);
      throw error;
    }
  }

  async startDiscoveryService() {
    this.discoverySocket = dgram.createSocket('udp4');
    
    this.discoverySocket.on('error', (err) => {
      console.error('Discovery socket error:', err);
    });

    this.discoverySocket.on('message', (msg, rinfo) => {
      this.handleDiscoveryMessage(msg, rinfo);
    });

    this.discoverySocket.on('listening', () => {
      const address = this.discoverySocket.address();
      console.log(`Discovery service listening on ${address.address}:${address.port}`);
    });

    this.discoverySocket.bind(this.discoveryPort);
  }

  async startCommunicationService() {
    this.communicationSocket = dgram.createSocket('udp4');
    
    this.communicationSocket.on('error', (err) => {
      console.error('Communication socket error:', err);
    });

    this.communicationSocket.on('message', (msg, rinfo) => {
      this.handleCommunicationMessage(msg, rinfo);
    });

    this.communicationSocket.on('listening', () => {
      const address = this.communicationSocket.address();
      console.log(`Communication service listening on ${address.address}:${address.port}`);
    });

    this.communicationSocket.bind(this.communicationPort);
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
    
    return new Promise((resolve) => {
      server.listen(3003, () => {
        console.log('Web server listening on port 3003');
        resolve();
      });
    });
  }

  handleDiscoveryMessage(msg, rinfo) {
    try {
      const message = JSON.parse(msg.toString());
      
      if (message.type === 'discovery' && message.peerId !== this.localPeerId) {
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
        this.discoverySocket.send(message, 0, message.length, this.discoveryPort, iface.address);
      }
    });
  }

  sendDiscoveryResponse(rinfo) {
    const response = {
      type: 'discovery-response',
      peerId: this.localPeerId,
      name: os.hostname(),
      discoveryPort: this.discoveryPort,
      communicationPort: this.communicationPort,
      timestamp: Date.now()
    };

    const message = Buffer.from(JSON.stringify(response));
    this.discoverySocket.send(message, 0, message.length, rinfo.port, rinfo.address);
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
        this.communicationSocket.send(messageBuffer, 0, messageBuffer.length, peer.communicationPort, peer.address);
      } catch (error) {
        console.error(`Failed to send broadcast to peer ${peerId}:`, error);
      }
    }

    // Also broadcast via WebSocket
    if (this.io) {
      this.io.emit('broadcast', message);
    }
  }

  addPeer(peerId, peerInfo) {
    if (peerId !== this.localPeerId) {
      const existingPeer = this.peers.get(peerId);
      if (!existingPeer) {
        this.peers.set(peerId, peerInfo);
        this.emit('peer-joined', peerId, peerInfo);
        console.log(`Peer joined: ${peerInfo.displayName || peerInfo.name} (${peerId})`);
      } else {
        // Update existing peer info
        existingPeer.lastSeen = Date.now();
        existingPeer.address = peerInfo.address;
        existingPeer.displayName = peerInfo.displayName;
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
    if (this.discoverySocket) {
      this.discoverySocket.close();
    }
    if (this.communicationSocket) {
      this.communicationSocket.close();
    }
    if (this.server) {
      this.server.close();
    }
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
}

module.exports = { NetworkManager }; 