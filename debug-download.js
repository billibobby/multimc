const { LoaderManager } = require('./src/utils/LoaderManager');
const https = require('https');
const http = require('http');

async function debugDownload() {
  console.log('🔍 Debugging Fabric Download...\n');
  
  try {
    const loaderManager = new LoaderManager();
    
    // Test 1: Check if we can reach the Fabric API
    console.log('1️⃣ Testing Fabric API connectivity...');
    try {
      const data = await new Promise((resolve, reject) => {
        https.get('https://meta.fabricmc.net/v2/versions/installer', (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                const installers = JSON.parse(data);
                resolve(installers);
              } catch (e) {
                reject(new Error('Invalid JSON response'));
              }
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          });
        }).on('error', reject);
      });
      
      console.log('   ✅ Fabric API is accessible');
      console.log(`   Found ${data.length} installers`);
      const stableInstaller = data.find(installer => installer.stable);
      if (stableInstaller) {
        console.log(`   Stable installer: ${stableInstaller.version}`);
        console.log(`   URL: ${stableInstaller.url}`);
      }
    } catch (error) {
      console.log(`   ❌ Cannot reach Fabric API: ${error.message}`);
    }
    
    // Test 2: Check if we can reach Minecraft API
    console.log('\n2️⃣ Testing Minecraft API connectivity...');
    try {
      const data = await new Promise((resolve, reject) => {
        https.get('https://launchermeta.mojang.com/mc/game/version_manifest.json', (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                const manifest = JSON.parse(data);
                resolve(manifest);
              } catch (e) {
                reject(new Error('Invalid JSON response'));
              }
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          });
        }).on('error', reject);
      });
      
      console.log('   ✅ Minecraft API is accessible');
      console.log(`   Found ${data.versions.length} versions`);
    } catch (error) {
      console.log(`   ❌ Cannot reach Minecraft API: ${error.message}`);
    }
    
    // Test 3: Check Java installation
    console.log('\n3️⃣ Testing Java installation...');
    try {
      const javaPath = await loaderManager.getJavaPath();
      if (javaPath) {
        console.log(`   ✅ Java found at: ${javaPath}`);
      } else {
        console.log('   ❌ Java not found');
      }
    } catch (error) {
      console.log(`   ❌ Java check failed: ${error.message}`);
    }
    
    // Test 4: Check directory permissions
    console.log('\n4️⃣ Testing directory permissions...');
    const fs = require('fs-extra');
    const path = require('path');
    const os = require('os');
    
    const baseDir = path.join(os.homedir(), '.multimc-hub');
    const fabricDir = path.join(baseDir, 'loaders', 'fabric');
    
    try {
      await fs.ensureDir(fabricDir);
      console.log('   ✅ Can create directories');
      
      // Test write permission
      const testFile = path.join(fabricDir, 'test-write.txt');
      await fs.writeFile(testFile, 'test');
      await fs.remove(testFile);
      console.log('   ✅ Can write files');
    } catch (error) {
      console.log(`   ❌ Directory permission issue: ${error.message}`);
    }
    
    // Test 5: Try a small download test
    console.log('\n5️⃣ Testing small download...');
    try {
      const data = await new Promise((resolve, reject) => {
        https.get('https://httpbin.org/bytes/1024', (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode === 200) {
              resolve(data);
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          });
        }).on('error', reject);
      });
      
      console.log(`   ✅ Download test successful (${data.length} bytes)`);
    } catch (error) {
      console.log(`   ❌ Download test failed: ${error.message}`);
    }
    
    console.log('\n🎯 Recommendations:');
    console.log('   • If APIs are not accessible, check your internet connection');
    console.log('   • If Java is missing, install Java 8 or higher');
    console.log('   • If permissions fail, run as administrator/sudo');
    console.log('   • If download test fails, check firewall/antivirus settings');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugDownload(); 