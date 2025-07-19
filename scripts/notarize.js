const { notarize } = require('@electron/notarize');

module.exports = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  
  if (electronPlatformName !== 'darwin') {
    return;
  }
  
  console.log('Notarizing macOS app...');
  
  const appName = context.packager.appInfo.productFilename;
  
  try {
    await notarize({
      tool: 'notarytool',
      appPath: `${appOutDir}/${appName}.app`,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    });
    
    console.log('✅ macOS app notarized successfully');
  } catch (error) {
    console.error('❌ Notarization failed:', error);
    // Don't fail the build if notarization fails
    console.log('Continuing build without notarization...');
  }
}; 