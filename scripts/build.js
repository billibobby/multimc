const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

console.log('🚀 MultiMC Hub Desktop App Builder');
console.log('====================================');

async function buildApp() {
  try {
    const platform = process.argv[2] || 'all';
    const isDev = process.argv.includes('--dev');
    
    console.log(`Building for platform: ${platform}`);
    console.log(`Development mode: ${isDev}`);
    
    // Clean previous builds
    console.log('\n🧹 Cleaning previous builds...');
    await fs.remove(path.join(__dirname, '..', 'dist'));
    await fs.remove(path.join(__dirname, '..', 'node_modules', '.cache'));
    
    // Install dependencies if needed
    console.log('\n📦 Checking dependencies...');
    if (!await fs.pathExists(path.join(__dirname, '..', 'node_modules'))) {
      console.log('Installing dependencies...');
      execSync('npm install', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    }
    
    // Generate icons if they don't exist
    console.log('\n🎨 Generating app icons...');
    await generateIcons();
    
    // Build based on platform
    switch (platform.toLowerCase()) {
      case 'win':
      case 'windows':
        await buildWindows();
        break;
      case 'mac':
      case 'macos':
        await buildMacOS();
        break;
      case 'linux':
        await buildLinux();
        break;
      case 'all':
        await buildAll();
        break;
      default:
        console.error('❌ Invalid platform. Use: win, mac, linux, or all');
        process.exit(1);
    }
    
    console.log('\n✅ Build completed successfully!');
    console.log('📁 Check the "dist" folder for your builds.');
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

async function generateIcons() {
  // This would normally use a tool like ImageMagick or similar
  // For now, we'll create placeholder icons
  console.log('Creating placeholder icons...');
  
  const iconSizes = [16, 32, 48, 64, 128, 256, 512];
  const buildPath = path.join(__dirname, '..', 'build');
  
  // Create PNG icon
  await fs.copy(
    path.join(__dirname, '..', 'assets', 'icon.png'),
    path.join(buildPath, 'icon.png')
  );
  
  // Create placeholder ICO and ICNS files
  // In a real implementation, you'd convert the SVG to these formats
  console.log('Note: Please convert build/icon.svg to .ico and .icns formats for production');
}

async function buildWindows() {
  console.log('\n🪟 Building for Windows...');
  execSync('npm run build:win', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
}

async function buildMacOS() {
  console.log('\n🍎 Building for macOS...');
  execSync('npm run build:mac', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
}

async function buildLinux() {
  console.log('\n🐧 Building for Linux...');
  execSync('npm run build:linux', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
}

async function buildAll() {
  console.log('\n🌍 Building for all platforms...');
  
  // Build Windows
  try {
    await buildWindows();
  } catch (error) {
    console.error('Windows build failed:', error.message);
  }
  
  // Build macOS
  try {
    await buildMacOS();
  } catch (error) {
    console.error('macOS build failed:', error.message);
  }
  
  // Build Linux
  try {
    await buildLinux();
  } catch (error) {
    console.error('Linux build failed:', error.message);
  }
}

// Run the build
buildApp(); 