const { withAndroidManifest, withMainActivity } = require('@expo/config-plugins');

/**
 * Expo Config Plugin for Screenshot Prevention
 * This plugin modifies the Android MainActivity to add FLAG_SECURE
 * which prevents screenshots and screen recording on Android devices
 */

// Plugin to modify AndroidManifest.xml if needed
const withScreenshotPreventionManifest = (config) => {
  return withAndroidManifest(config, async (config) => {
    // We don't need manifest changes for FLAG_SECURE
    // But keeping this here for potential future security attributes
    return config;
  });
};

// Plugin to modify MainActivity.java to add FLAG_SECURE
const withScreenshotPreventionActivity = (config) => {
  return withMainActivity(config, async (config) => {
    const { modResults } = config;
    const { contents } = modResults;
    
    // Check if we already have the necessary imports
    const hasWindowManagerImport = contents.includes('import android.view.WindowManager');
    const hasOsBundle = contents.includes('import android.os.Bundle');
    
    let modifiedContents = contents;
    
    // Add imports if not present
    if (!hasWindowManagerImport) {
      // Add import after the package declaration
      const packageMatch = modifiedContents.match(/package .*;\n/);
      if (packageMatch && packageMatch[0]) {
        const packageLine = packageMatch[0];
        modifiedContents = modifiedContents.replace(
          packageLine,
          packageLine + '\nimport android.view.WindowManager;'
        );
      }
    }
    
    if (!hasOsBundle) {
      const packageMatch = modifiedContents.match(/package .*;\n/);
      if (packageMatch && packageMatch[0]) {
        const packageLine = packageMatch[0];
        modifiedContents = modifiedContents.replace(
          packageLine,
          packageLine + '\nimport android.os.Bundle;'
        );
      }
    }
    
    // Check if we already have the FLAG_SECURE code
    const hasFlagSecure = modifiedContents.includes('FLAG_SECURE');
    
    if (!hasFlagSecure) {
      // Add the onCreate method with FLAG_SECURE
      // First check if onCreate already exists
      const hasOnCreate = modifiedContents.includes('onCreate(Bundle');
      
      if (hasOnCreate) {
        // Modify existing onCreate
        modifiedContents = modifiedContents.replace(
          /onCreate\(Bundle savedInstanceState\)\s*{/,
          `onCreate(Bundle savedInstanceState) {
    // Screenshot prevention for VanishVoice
    if (BuildConfig.ENABLE_SCREENSHOT_PREVENTION) {
      getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
    }`
        );
      } else {
        // Add new onCreate method
        // Find the class declaration and add after it
        modifiedContents = modifiedContents.replace(
          /public class MainActivity extends ReactActivity\s*{/,
          `public class MainActivity extends ReactActivity {
  
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    
    // Screenshot prevention for VanishVoice
    // Disabled by default, will be controlled at runtime via React Native module
    // getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
  }`
        );
      }
    }
    
    // Also add methods to enable/disable at runtime
    if (!modifiedContents.includes('enableScreenshotPrevention')) {
      // Add methods before the closing brace of the class
      const lastBrace = modifiedContents.lastIndexOf('}');
      const methodsToAdd = `
  
  // Methods to control screenshot prevention at runtime
  public void enableScreenshotPrevention() {
    runOnUiThread(new Runnable() {
      @Override
      public void run() {
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
      }
    });
  }
  
  public void disableScreenshotPrevention() {
    runOnUiThread(new Runnable() {
      @Override
      public void run() {
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
      }
    });
  }
`;
      
      modifiedContents = modifiedContents.slice(0, lastBrace) + methodsToAdd + modifiedContents.slice(lastBrace);
    }
    
    modResults.contents = modifiedContents;
    return config;
  });
};

// Main plugin function
const withScreenshotPrevention = (config, props = {}) => {
  const { enabled = true } = props;
  
  if (!enabled) {
    return config;
  }
  
  // Apply Android modifications
  config = withScreenshotPreventionManifest(config);
  config = withScreenshotPreventionActivity(config);
  
  return config;
};

module.exports = withScreenshotPrevention;