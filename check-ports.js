#!/usr/bin/env node

const net = require('net');

// Ports that MultiMC Hub tries to use
const ports = [3001, 3002, 3003, 25565];

console.log('Checking ports that MultiMC Hub uses...\n');

async function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, () => {
      server.close(() => {
        console.log(`✅ Port ${port} is AVAILABLE`);
        resolve(true);
      });
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`❌ Port ${port} is IN USE`);
        resolve(false);
      } else {
        console.log(`⚠️  Port ${port} error: ${err.message}`);
        resolve(false);
      }
    });
  });
}

async function checkAllPorts() {
  console.log('Port Status:');
  console.log('============');
  
  for (const port of ports) {
    await checkPort(port);
  }
  
  console.log('\nSummary:');
  console.log('========');
  console.log('✅ = Available for MultiMC Hub');
  console.log('❌ = Already in use by another application');
  console.log('\nIf ports are in use, MultiMC Hub will automatically find available ports.');
}

checkAllPorts().catch(console.error); 