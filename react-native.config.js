module.exports = {
  dependencies: {
    'screenshot-prevent': {
      platforms: {
        android: {
          sourceDir: './modules/screenshot-prevent/android',
          packageImportPath: 'import com.vanishvoice.modules.screenshotprevent.ScreenshotPreventPackage;',
        },
        ios: {
          sourceDir: './modules/screenshot-prevent/ios',
        },
      },
    },
  },
};