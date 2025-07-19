const fs = require('fs-extra');
const path = require('path');

console.log('🎨 MultiMC Hub Icon Converter');
console.log('=============================');

async function convertIcons() {
  try {
    const buildPath = path.join(__dirname, '..', 'build');
    const assetsPath = path.join(__dirname, '..', 'assets');
    
    // Ensure build directory exists
    await fs.ensureDir(buildPath);
    
    console.log('📁 Checking for existing icons...');
    
    // Copy existing icon.png if it exists
    const existingIcon = path.join(assetsPath, 'icon.png');
    if (await fs.pathExists(existingIcon)) {
      await fs.copy(existingIcon, path.join(buildPath, 'icon.png'));
      console.log('✅ Copied existing icon.png');
    } else {
      console.log('⚠️  No existing icon.png found');
    }
    
    // Check for required icon files
    const requiredIcons = [
      { name: 'icon.ico', platform: 'Windows' },
      { name: 'icon.icns', platform: 'macOS' },
      { name: 'icon.png', platform: 'Linux' }
    ];
    
    console.log('\n🔍 Checking required icon files:');
    
    for (const icon of requiredIcons) {
      const iconPath = path.join(buildPath, icon.name);
      if (await fs.pathExists(iconPath)) {
        console.log(`✅ ${icon.name} exists (${icon.platform})`);
      } else {
        console.log(`❌ ${icon.name} missing (${icon.platform})`);
      }
    }
    
    console.log('\n📋 Icon Conversion Instructions:');
    console.log('================================');
    console.log('');
    console.log('To create the missing icon files, you can:');
    console.log('');
    console.log('1. 🖼️  Use Online Converters:');
    console.log('   - ICO: https://convertio.co/png-ico/');
    console.log('   - ICNS: https://cloudconvert.com/png-to-icns');
    console.log('');
    console.log('2. 🛠️  Use Desktop Tools:');
    console.log('   - Windows: Use Paint.NET or GIMP');
    console.log('   - macOS: Use Image2Icon or Icon Composer');
    console.log('   - Linux: Use GIMP or Inkscape');
    console.log('');
    console.log('3. 💻 Use Command Line (if ImageMagick is installed):');
    console.log('   # Convert to ICO (Windows)');
    console.log('   convert build/icon.png -define icon:auto-resize=16,32,48,256 build/icon.ico');
    console.log('');
    console.log('   # Convert to ICNS (macOS) - requires iconutil');
    console.log('   # First create iconset directory structure');
    console.log('   mkdir build/icon.iconset');
    console.log('   convert build/icon.png -resize 16x16 build/icon.iconset/icon_16x16.png');
    console.log('   convert build/icon.png -resize 32x32 build/icon.iconset/icon_16x16@2x.png');
    console.log('   # ... continue for all sizes');
    console.log('   iconutil -c icns build/icon.iconset -o build/icon.icns');
    console.log('');
    console.log('📁 Place the converted icons in the "build/" folder:');
    console.log('   - build/icon.ico (Windows)');
    console.log('   - build/icon.icns (macOS)');
    console.log('   - build/icon.png (Linux)');
    console.log('');
    console.log('🎯 After creating the icons, run:');
    console.log('   npm run build:all');
    
  } catch (error) {
    console.error('❌ Icon conversion check failed:', error);
  }
}

convertIcons(); 