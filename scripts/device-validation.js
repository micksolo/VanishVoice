#!/usr/bin/env node

/**
 * Device Validation and Selection Enforcement for VanishVoice Mobile Testing
 * 
 * This script provides utilities to ensure correct device selection when using
 * MCP mobile testing tools, preventing accidental use of wrong devices.
 */

const { execSync } = require('child_process');

class DeviceValidator {
  constructor() {
    this.requiredDevice = 'iPhone SE (3rd generation)';
    this.restrictedDevice = 'iPhone SE (2nd generation)';
    this.deviceUUIDs = {
      'iPhone SE (3rd generation)': 'B4D70EA7-103C-42A4-BBCC-0E82140BA087',
      'iPhone SE (2nd generation)': '24EB8CAA-4A23-4F51-B265-F4FF673F3FD8'
    };
  }

  /**
   * Get current iOS simulators with their boot status
   */
  getSimulatorStatus() {
    try {
      const output = execSync('xcrun simctl list devices | grep "iPhone SE"', { encoding: 'utf8' });
      const devices = output.trim().split('\n').map(line => {
        const match = line.match(/(.+?)\s+\(([A-F0-9-]+)\)\s+\((.+?)\)/);
        if (match) {
          return {
            name: match[1].trim(),
            uuid: match[2],
            status: match[3]
          };
        }
        return null;
      }).filter(Boolean);
      
      return devices;
    } catch (error) {
      console.error('Error getting simulator status:', error.message);
      return [];
    }
  }

  /**
   * Check which WebDriverAgent processes are running
   */
  getActiveWebDriverAgents() {
    try {
      const output = execSync('ps aux | grep WebDriverAgentRunner | grep -v grep', { encoding: 'utf8' });
      const agents = output.trim().split('\n').map(line => {
        const uuidMatch = line.match(/Devices\/([A-F0-9-]+)\//);
        if (uuidMatch) {
          const uuid = uuidMatch[1];
          const deviceName = Object.keys(this.deviceUUIDs).find(
            name => this.deviceUUIDs[name] === uuid
          );
          return {
            uuid,
            deviceName: deviceName || 'Unknown Device',
            processLine: line
          };
        }
        return null;
      }).filter(Boolean);
      
      return agents;
    } catch (error) {
      // No WebDriverAgent processes running
      return [];
    }
  }

  /**
   * Validate current device selection against requirements
   */
  validateDeviceSelection() {
    const simulators = this.getSimulatorStatus();
    const activeAgents = this.getActiveWebDriverAgents();
    
    console.log('\n🔍 Device Validation Report');
    console.log('=' * 50);
    
    // Show simulator status
    console.log('\n📱 Available iOS Simulators:');
    simulators.forEach(device => {
      const status = device.status === 'Booted' ? '✅ Booted' : '⚪ Shutdown';
      const restricted = device.name === this.restrictedDevice ? ' ⚠️ RESTRICTED' : '';
      console.log(`  ${device.name}: ${status} (${device.uuid})${restricted}`);
    });

    // Show active WebDriverAgent sessions
    console.log('\n🔗 Active WebDriverAgent Sessions:');
    if (activeAgents.length === 0) {
      console.log('  No active sessions');
    } else {
      activeAgents.forEach(agent => {
        const restricted = agent.deviceName === this.restrictedDevice ? ' ⚠️ RESTRICTED' : '';
        console.log(`  ${agent.deviceName}: ${agent.uuid}${restricted}`);
      });
    }

    // Validation results
    console.log('\n✅ Validation Results:');
    
    const requiredDeviceBooted = simulators.find(
      d => d.name === this.requiredDevice && d.status === 'Booted'
    );
    
    const restrictedDeviceAgent = activeAgents.find(
      a => a.deviceName === this.restrictedDevice
    );
    
    if (!requiredDeviceBooted) {
      console.log(`  ❌ ${this.requiredDevice} is NOT booted`);
      return false;
    }
    
    if (restrictedDeviceAgent) {
      console.log(`  ⚠️ ${this.restrictedDevice} has active WebDriverAgent (potential conflict)`);
      console.log(`     This may cause MCP tools to default to the wrong device`);
    }
    
    console.log(`  ✅ ${this.requiredDevice} is booted and ready`);
    
    return true;
  }

  /**
   * Get device selection instructions for MCP tools
   */
  getDeviceSelectionInstructions() {
    return {
      device: this.requiredDevice,
      deviceType: 'simulator',
      uuid: this.deviceUUIDs[this.requiredDevice],
      verification: {
        expectedScreenSize: '375x667', // Both SE models have same resolution
        verificationMethod: 'uuid_check'
      }
    };
  }

  /**
   * Generate device-specific test setup commands
   */
  generateTestSetup() {
    const instructions = this.getDeviceSelectionInstructions();
    
    return {
      mcpCommands: [
        {
          tool: 'mcp__mobile-mcp__mobile_use_device',
          parameters: {
            device: instructions.device,
            deviceType: instructions.deviceType
          }
        },
        {
          tool: 'mcp__mobile-mcp__mobile_get_screen_size',
          parameters: { noParams: {} },
          purpose: 'Verify device selection (should be 375x667)'
        }
      ],
      validationSteps: [
        'Confirm device selection response matches expected device name',
        'Verify screen size is 375x667 (both SE models have same resolution)',
        'Check device UUID in WebDriverAgent processes if needed',
        'Take screenshot to visually confirm correct device'
      ]
    };
  }
}

// CLI interface
if (require.main === module) {
  const validator = new DeviceValidator();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'validate':
      validator.validateDeviceSelection();
      break;
      
    case 'status':
      console.log(JSON.stringify({
        simulators: validator.getSimulatorStatus(),
        activeAgents: validator.getActiveWebDriverAgents(),
        instructions: validator.getDeviceSelectionInstructions()
      }, null, 2));
      break;
      
    case 'setup':
      console.log(JSON.stringify(validator.generateTestSetup(), null, 2));
      break;
      
    default:
      console.log(`
Usage: node device-validation.js <command>

Commands:
  validate  - Run full device validation report
  status    - Get JSON status of devices and agents
  setup     - Get MCP command setup instructions

Examples:
  node device-validation.js validate
  node device-validation.js status | jq
`);
  }
}

module.exports = DeviceValidator;