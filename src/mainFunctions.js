const { dialog, app, nativeTheme } = require('electron');
const fs = require('fs');
const HID = require('node-hid');
const path = require('path');
const Store = require('electron-store');

// Import store instance from main process instead of creating a new one
let store;
try {
  store = require('./main').store;
} catch (error) {
  // Fallback store for when running independently
  store = new Store();
}

// Initialize electron store with schema
const storeSchema = {
  preferences: {
    type: 'object',
    properties: {
      app_settings: {
        type: 'object',
        properties: {
          theme: { type: 'string', enum: ['dark', 'light'], default: 'dark' },
          autostart: { type: 'boolean', default: false },
          minimizeToTray: { type: 'boolean', default: true }
        },
        default: {
          theme: 'dark',
          autostart: false,
          minimizeToTray: true
        }
      },
      osc_settings: {
        type: 'object',
        properties: {
          host: { type: 'string', default: '127.0.0.1' },
          port: { type: 'number', default: 9000 },
          address: { type: 'string', default: '/spacemouse' }
        }
      },
      device_settings: {
        type: 'object',
        properties: {
          sensitivity: { type: 'number', default: 1.0 },
          deadzone: { type: 'number', default: 0.1 }
        }
      }
    }
  }
};

// Math and mapping utilities
module.exports = {
  clip: function (value, range) {
    value = parseFloat(value)
    if (isNaN(value)) value = range[0]
    return Math.max(Math.min(range[0], range[1]), Math.min(value, Math.max(range[0], range[1])))
  },

  mapToScale: function (value, rangeIn, rangeOut, decimals, log, revertlog) {
    value = module.exports.clip(value, [rangeIn[0], rangeIn[1]])
    value = (value - rangeIn[0]) / (rangeIn[1] - rangeIn[0])

    if (log) {
      var logScale = revertlog ? Math.abs(rangeIn[1] - rangeIn[0]) :
        Math.abs(rangeOut[1] - rangeOut[0])

      if (log !== true && log !== -1) logScale = Math.abs(log)
      else if (logScale >= 100) logScale /= 10
      else logScale = Math.max(logScale, 10)

      if (log < 0) revertlog = !revertlog

      value = revertlog ?
        Math.log(value * (logScale - 1) + 1) / Math.log(logScale) :
        Math.pow(logScale, value) / (logScale - 1) - 1 / (logScale - 1)
    }

    value = value * (rangeOut[1] - rangeOut[0]) + rangeOut[0]
    value = module.exports.clip(value, [rangeOut[0], rangeOut[1]])
    if (decimals !== -1) value = parseFloat(value.toFixed(decimals))
    return value
  },

  // OSC utilities
  oscToEmber: function (oscBundle) {
    let oscArgs = JSON.stringify(oscBundle.args);
    oscArgs = oscArgs.replace(/\s|\[|\]/g, "");
    oscArgs = JSON.parse(oscArgs);
    oscArgs = oscArgs.value;
    oscArgs = Number(oscArgs);
    return oscArgs
  },

  embChPath: function (chNumb) {
    let eChPath = 'Channels.Inputs.INP   ';
    eChPath = eChPath.concat(chNumb.toString());
    return eChPath
  },

  embFadLevPath: function (eChPath) {
    let eFadLevPath = eChPath.concat('.Fader.Fader Level');
    return eFadLevPath
  },

  pathToAddress: function (path) {
    let oscAddress = path.replace(/\./g, '/');
    slash = "/";
    oscAddress = slash.concat(oscAddress);
    return oscAddress
  },

  addressToPath: function (address) {
    let path = address.replace(/\//g, '.');
    path = path.slice(1);
    return path
  },

  fromAbsoluteToRelative: function (data, commonRangeXYZ, commonRangeRPY, origins) {
    const [x, y, z, roll, pitch, yaw] = data.split(',');
    
    const [minCommonXYZ, maxCommonXYZ] = commonRangeXYZ;
    const [minCommonRPY, maxCommonRPY] = commonRangeRPY;
    const { prevX, prevY, prevZ, prevRoll, prevPitch, prevYaw } = origins;
  
    // Calculate individual ranges
    const rangeX = [prevX - minCommonXYZ, prevX + maxCommonXYZ];
    const rangeY = [prevY - minCommonXYZ, prevY + maxCommonXYZ];
    const rangeZ = [prevZ - minCommonXYZ, prevZ + maxCommonXYZ];
    const rangeRoll = [prevRoll - minCommonRPY, prevRoll + maxCommonRPY];
    const rangePitch = [prevPitch - minCommonRPY, prevPitch + maxCommonRPY];
    const rangeYaw = [prevYaw - minCommonRPY, prevYaw + maxCommonRPY];
  
    // Map values to relative ranges
    const relX = module.exports.mapToScale(x, rangeX, [-1, 1], 3);
    const relY = module.exports.mapToScale(y, rangeY, [-1, 1], 3);
    const relZ = module.exports.mapToScale(z, rangeZ, [-1, 1], 3);
    const relRoll = module.exports.mapToScale(roll, rangeRoll, [-1, 1], 3);
    const relPitch = module.exports.mapToScale(pitch, rangePitch, [-1, 1], 3);
    const relYaw = module.exports.mapToScale(yaw, rangeYaw, [-1, 1], 3);
  
    return [relX, relY, relZ, relRoll, relPitch, relYaw];
  },

  // Utility functions for preferences and HID
  getPreferences: function() {
    return store.get('preferences');
  },

  setPreferences: function(prefs) {
    store.set('preferences', prefs);
  },

  getTheme: function() {
    return store.get('preferences.app_settings.theme', 'dark');
  },

  getSystemTheme: function() {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  },

  handleAutostart: function(enabled) {
    app.setLoginItemSettings({
      openAtLogin: enabled
    });
  },

  setupHIDDevice: function() {
    try {
      const devices = HID.devices();
      console.log('Available HID devices:', devices);

      const spaceMiceDevices = devices.filter(device => 
        device.vendorId === 0x256F || // 3Dconnexion vendor ID
        device.manufacturer === '3Dconnexion'
      );

      if (spaceMiceDevices.length === 0) {
        console.log('No SpaceMouse devices found');
        return null;
      }

      console.log('Found SpaceMouse devices:', spaceMiceDevices);
      const device = spaceMiceDevices[0];
      console.log('Using device:', device);

      const spaceMouse = new HID.HID(device.path);
      console.log('Successfully connected to SpaceMouse');

      return spaceMouse;
    } catch (error) {
      console.error('Error setting up HID device:', error);
      return null;
    }
  }
};