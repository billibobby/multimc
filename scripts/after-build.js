const fs = require('fs-extra');
const path = require('path');

console.log('Running post-build tasks...');

// Post-build tasks
async function afterBuild() {
  try {
    const distPath = path.join(__dirname, '..', 'dist');
    
    // Create a build info file
    const buildInfo = {
      version: require('../package.json').version,
      buildDate: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch
    };
    
    await fs.writeJson(path.join(distPath, 'build-info.json'), buildInfo, { spaces: 2 });
    
    // Copy README to dist folder
    if (await fs.pathExists(path.join(__dirname, '..', 'README.md'))) {
      await fs.copy(
        path.join(__dirname, '..', 'README.md'),
        path.join(distPath, 'README.md')
      );
    }
    
    // Create installer directory structure
    const installerPath = path.join(__dirname, '..', 'build', 'installer');
    await fs.ensureDir(installerPath);
    
    console.log('✅ Post-build tasks completed successfully');
  } catch (error) {
    console.error('❌ Post-build tasks failed:', error);
    process.exit(1);
  }
}

afterBuild(); 