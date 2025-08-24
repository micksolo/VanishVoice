#!/usr/bin/env node

/**
 * Fix Device Selection Issues for VanishVoice Mobile Testing
 * 
 * This script safely resolves WebDriverAgent conflicts and ensures
 * iPhone SE (3rd generation) is properly available for testing.
 */

const { execSync, spawn } = require('child_process');
const DeviceValidator = require('./device-validation.js');

class DeviceSelectionFixer {
  constructor() {
    this.validator = new DeviceValidator();
    this.requiredDevice = 'iPhone SE (3rd generation)';
    this.restrictedDevice = 'iPhone SE (2nd generation)';
    this.requiredUUID = 'B4D70EA7-103C-42A4-BBCC-0E82140BA087';
    this.restrictedUUID = '24EB8CAA-4A23-4F51-B265-F4FF673F3FD8';
  }

  /**
   * Check if WebDriverAgent is running for restricted device
   */
  hasRestrictedWebDriverAgent() {
    try {
      const output = execSync(`ps aux | grep "${this.restrictedUUID}" | grep WebDriverAgent | grep -v grep`, { encoding: 'utf8' });
      return output.trim().length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if WebDriverAgent is running for required device
   */
  hasRequiredWebDriverAgent() {
    try {
      const output = execSync(`ps aux | grep "${this.requiredUUID}" | grep WebDriverAgent | grep -v grep`, { encoding: 'utf8' });
      return output.trim().length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Safely terminate WebDriverAgent for restricted device
   */
  terminateRestrictedWebDriverAgent() {
    console.log(`🔄 Terminating WebDriverAgent for ${this.restrictedDevice}...`);
    
    try {
      // Find processes for the restricted device UUID
      const output = execSync(`ps aux | grep "${this.restrictedUUID}" | grep WebDriverAgent | grep -v grep`, { encoding: 'utf8' });
      
      if (output.trim().length === 0) {
        console.log('✅ No WebDriverAgent running for restricted device');
        return true;
      }

      // Extract PIDs and terminate
      const lines = output.trim().split('\n');
      let terminated = 0;
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[1];
        
        if (pid && /^\d+$/.test(pid)) {
          try {
            execSync(`kill ${pid}`);
            console.log(`  ✅ Terminated WebDriverAgent process ${pid}`);
            terminated++;
          } catch (error) {
            console.log(`  ⚠️ Could not terminate process ${pid}: ${error.message}`);
          }
        }
      }

      // Wait a moment for processes to terminate
      setTimeout(() => {}, 2000);
      
      console.log(`✅ Terminated ${terminated} WebDriverAgent processes`);
      return true;
      
    } catch (error) {
      console.error(`❌ Error terminating WebDriverAgent: ${error.message}`);
      return false;
    }
  }

  /**
   * Start WebDriverAgent for required device
   */
  startRequiredWebDriverAgent() {
    console.log(`🚀 Starting WebDriverAgent for ${this.requiredDevice}...`);
    
    try {
      // Check if WebDriverAgent source is available
      const webDriverPath = '/tmp/WebDriverAgent';
      
      try {
        execSync('ls /tmp/WebDriverAgent/WebDriverAgent.xcodeproj', { encoding: 'utf8' });
      } catch (error) {
        console.log('📦 WebDriverAgent not found, cloning...');
        execSync('cd /tmp && git clone https://github.com/facebookarchive/WebDriverAgent.git', { encoding: 'utf8' });
      }

      // Start WebDriverAgent for the required device
      const command = `cd ${webDriverPath} && xcodebuild -project WebDriverAgent.xcodeproj -scheme WebDriverAgentRunner -destination 'platform=iOS Simulator,name=${this.requiredDevice},OS=latest' test`;
      
      console.log('🔧 Building and starting WebDriverAgent...');
      console.log('  This may take 30-60 seconds...');
      
      // Start as background process
      const child = spawn('bash', ['-c', command], {
        detached: true,
        stdio: 'ignore'
      });
      
      child.unref();
      
      // Wait for WebDriverAgent to start
      console.log('⏳ Waiting for WebDriverAgent to initialize...');
      
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds
      
      const checkStarted = () => {
        attempts++;
        
        if (this.hasRequiredWebDriverAgent()) {
          console.log('✅ WebDriverAgent started successfully!');
          return true;
        }
        
        if (attempts >= maxAttempts) {
          console.log('⚠️ WebDriverAgent startup timeout - may still be initializing');
          return false;
        }
        
        setTimeout(checkStarted, 1000);
      };
      
      setTimeout(checkStarted, 3000); // Give it a few seconds to start
      
      return true;
      
    } catch (error) {
      console.error(`❌ Error starting WebDriverAgent: ${error.message}`);
      return false;
    }
  }

  /**
   * Comprehensive device environment fix
   */
  async fixDeviceEnvironment() {
    console.log('\n🔧 VanishVoice Device Selection Fix');
    console.log('=' * 40);
    
    // Step 1: Initial validation
    console.log('\n📋 Step 1: Validating current environment...');
    this.validator.validateDeviceSelection();
    
    // Step 2: Check for conflicts
    console.log('\n🔍 Step 2: Checking for WebDriverAgent conflicts...');
    const hasRestricted = this.hasRestrictedWebDriverAgent();
    const hasRequired = this.hasRequiredWebDriverAgent();
    
    console.log(`  Restricted device WebDriverAgent: ${hasRestricted ? '❌ ACTIVE' : '✅ Not running'}`);
    console.log(`  Required device WebDriverAgent: ${hasRequired ? '✅ ACTIVE' : '❌ Not running'}`);
    
    // Step 3: Fix conflicts
    if (hasRestricted) {
      console.log('\n🛠️ Step 3: Resolving WebDriverAgent conflict...');
      const terminated = this.terminateRestrictedWebDriverAgent();
      
      if (!terminated) {
        console.error('❌ Failed to terminate conflicting WebDriverAgent');
        return false;
      }
    } else {
      console.log('\n✅ Step 3: No conflicts to resolve');
    }
    
    // Step 4: Ensure required WebDriverAgent is running
    if (!this.hasRequiredWebDriverAgent()) {
      console.log('\n🚀 Step 4: Starting WebDriverAgent for required device...');
      const started = this.startRequiredWebDriverAgent();
      
      if (!started) {
        console.error('❌ Failed to start WebDriverAgent for required device');
        return false;
      }
    } else {
      console.log('\n✅ Step 4: Required WebDriverAgent already running');
    }
    
    // Step 5: Final validation
    console.log('\n✅ Step 5: Final validation...');
    setTimeout(() => {
      const finalValidation = this.validator.validateDeviceSelection();
      
      if (finalValidation) {
        console.log('\n🎉 SUCCESS: Device environment is now properly configured!');
        console.log('\n📱 Next Steps:');
        console.log('  1. Use mcp__mobile-mcp__mobile_use_device with "iPhone SE (3rd generation)"');
        console.log('  2. Verify device selection with screen size check');
        console.log('  3. Proceed with mobile testing');
      } else {
        console.log('\n⚠️ WARNING: Device environment may still need manual intervention');
      }
    }, 5000);
    
    return true;
  }

  /**
   * Quick status check
   */
  getQuickStatus() {
    const simulators = this.validator.getSimulatorStatus();
    const activeAgents = this.validator.getActiveWebDriverAgents();
    
    const requiredBooted = simulators.find(s => s.name === this.requiredDevice && s.status === 'Booted');
    const restrictedAgent = activeAgents.find(a => a.deviceName === this.restrictedDevice);
    const requiredAgent = activeAgents.find(a => a.deviceName === this.requiredDevice);
    
    return {
      status: requiredBooted && !restrictedAgent && requiredAgent ? 'READY' : 'NEEDS_FIX',
      issues: {
        requiredDeviceNotBooted: !requiredBooted,
        conflictingAgent: !!restrictedAgent,
        missingRequiredAgent: !requiredAgent
      },
      recommendation: requiredBooted && !restrictedAgent && requiredAgent 
        ? 'Environment is ready for testing'
        : 'Run fix-device-selection.js fix to resolve issues'
    };
  }
}

// CLI interface
if (require.main === module) {
  const fixer = new DeviceSelectionFixer();
  const command = process.argv[2];
  
  switch (command) {
    case 'fix':
      fixer.fixDeviceEnvironment();
      break;
      
    case 'status':
      console.log(JSON.stringify(fixer.getQuickStatus(), null, 2));
      break;
      
    case 'terminate-restricted':
      console.log('🔄 Terminating restricted device WebDriverAgent...');
      const terminated = fixer.terminateRestrictedWebDriverAgent();
      console.log(terminated ? '✅ Termination complete' : '❌ Termination failed');
      break;
      
    case 'start-required':
      console.log('🚀 Starting required device WebDriverAgent...');
      fixer.startRequiredWebDriverAgent();
      break;
      
    default:
      console.log(`
Usage: node fix-device-selection.js <command>

Commands:
  fix                 - Run comprehensive device environment fix
  status              - Get quick status of device environment
  terminate-restricted - Only terminate conflicting WebDriverAgent
  start-required      - Only start required device WebDriverAgent

Examples:
  node fix-device-selection.js fix
  node fix-device-selection.js status
`);
  }
}

module.exports = DeviceSelectionFixer;