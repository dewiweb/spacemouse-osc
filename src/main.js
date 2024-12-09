const electron = require('electron');
const { app, BrowserWindow, ipcMain, dialog, nativeTheme } = require('electron');
const ElectronPreferences = require("electron-preferences");
const fs = require("fs");
const log = require("electron-log");
const path = require("path");
const Store = require('electron-store');
const HID = require('node-hid');
const osc = require("osc");

// Initialize electron store with schema
const store = new Store({
  schema: {
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
  }
});

// Configure logging
log.transports.file.level = "debug";
console.log = log.log;

// Global references
let mainWindow = null;
let preferences = null;
let spaceMouse = null;
let oscCli = null;
let device = null;
let sendInterval = null;
let defaultDir = null;
let appVersion = null;
let OSCserverIP = "127.0.0.1";  // Default value
let OSCserverPort = 8000;      // Default value
let oUDPport = 9000;  // Default value
let validIpPort = true;

// Default preferences
const defaultPreferences = {
  app_settings: {
    theme: 'dark',
    autostart: false,
    minimizeToTray: true
  },
  osc_settings: {
    host: '127.0.0.1',
    port: 9000,
    address: '/spacemouse'
  },
  device_settings: {
    sensitivity: 1.0,
    deadzone: 0.1
  }
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 400, // Base height (menu + table + padding)
    minHeight: 400, // Minimum height to show essential elements
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  // Remove menu
  mainWindow.setMenu(null);

  // Set up window properties
  mainWindow.autoHideMenuBar = true;
  mainWindow.menuBarVisible = false;

  // Set up window events
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, 'index.html')).then(() => {
    // Initialize app after window is loaded
    initializeApp();

    // Apply saved theme
    const savedTheme = store.get('preferences.app_settings.theme', 'dark');
    mainWindow.webContents.send('update-theme', savedTheme);
    console.log('Applied saved theme on startup:', savedTheme);
  }).catch((error) => {
    console.error('Error loading index.html:', error);
  });

  return mainWindow;
}

function initializePreferences() {
  // Get current preferences or use defaults
  const currentPrefs = store.get('preferences', defaultPreferences);

  preferences = new ElectronPreferences({
    dataStore: path.resolve(app.getPath('userData'), 'preferences.json'),
    defaults: currentPrefs,
    debug: process.env.NODE_ENV === 'development',
    css: 'src/preferences.css',
    browserWindowOpts: {
      title: 'SpaceMouse OSC Preferences',
      width: 800,
      height: 600,
      resizable: true,
      maximizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        devTools: process.env.NODE_ENV === 'development'
      },
      backgroundColor: '#2e3440'
    },
    sections: [
      {
        id: 'app_settings',
        label: 'Application',
        icon: 'settings-gear-63',
        form: {
          groups: [
            {
              label: 'Application Settings',
              fields: [
                {
                  label: 'Theme',
                  key: 'theme',
                  type: 'radio',
                  options: [
                    { label: 'Dark Theme', value: 'dark' },
                    { label: 'Light Theme', value: 'light' }
                  ],
                  help: 'Choose between dark and light theme'
                },
                {
                  label: 'Auto Start',
                  key: 'autostart',
                  type: 'radio',
                  options: [
                    { label: 'Yes', value: true },
                    { label: 'No', value: false }
                  ],
                  help: 'Start application on system startup'
                },
                {
                  label: 'Minimize to Tray',
                  key: 'minimizeToTray',
                  type: 'radio',
                  options: [
                    { label: 'Yes', value: true },
                    { label: 'No', value: false }
                  ],
                  help: 'Minimize to system tray instead of closing'
                }
              ]
            }
          ]
        }
      },
      {
        id: 'osc_settings',
        label: 'OSC',
        icon: 'vector',
        form: {
          groups: [
            {
              label: 'OSC Settings',
              fields: [
                {
                  label: 'Host',
                  key: 'host',
                  type: 'text',
                  help: 'OSC server host address'
                },
                {
                  label: 'Port',
                  key: 'port',
                  type: 'number',
                  help: 'OSC server port'
                },
                {
                  label: 'Address',
                  key: 'address',
                  type: 'text',
                  help: 'OSC message address'
                }
              ]
            }
          ]
        }
      },
      {
        id: 'device_settings',
        label: 'Device',
        icon: 'compass-05',
        form: {
          groups: [
            {
              label: 'Device Settings',
              fields: [
                {
                  label: 'Sensitivity',
                  key: 'sensitivity',
                  type: 'number',
                  help: 'Movement sensitivity multiplier'
                },
                {
                  label: 'Deadzone',
                  key: 'deadzone',
                  type: 'number',
                  help: 'Minimum movement threshold'
                }
              ]
            }
          ]
        }
      }
    ]
  });

  // Handle window creation
  preferences.on('ready', () => {
    const systemTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    console.log('Preferences window ready, using system theme:', systemTheme);

    // Apply current preferences
    const currentPrefs = store.get('preferences', defaultPreferences);
    preferences.preferences = currentPrefs;

    // Set initial theme class
    preferences.window.webContents.executeJavaScript(`
      document.documentElement.className = 'theme-${systemTheme}';
      document.body.className = 'theme-${systemTheme}';
      console.log('Theme set to:', {
        htmlClass: document.documentElement.className,
        bodyClass: document.body.className,
        preferences: ${JSON.stringify(currentPrefs)}
      });
    `);

    // Only open DevTools in development mode
    if (process.env.NODE_ENV === 'development') {
      preferences.window.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // Listen for system theme changes
  nativeTheme.on('updated', () => {
    const systemTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    console.log('System theme changed to:', systemTheme);

    if (preferences.window) {
      preferences.window.webContents.executeJavaScript(`
        document.documentElement.className = 'theme-${systemTheme}';
        document.body.className = 'theme-${systemTheme}';
        console.log('Theme updated:', {
          htmlClass: document.documentElement.className,
          bodyClass: document.body.className
        });
      `);
    }
  });

  // Listen for preference changes
  preferences.on('save', (prefs) => {
    console.log('Preferences saved:', prefs);
    
    // Update store
    store.set('preferences', prefs);

    // Update theme in main window if changed
    const theme = prefs.app_settings?.theme || 'dark';
    if (mainWindow) {
      mainWindow.webContents.send('update-theme', theme);
      // Update theme in renderer process
      mainWindow.webContents.executeJavaScript(`
        document.documentElement.className = 'theme-${theme}';
        document.body.className = 'theme-${theme}';
        // Update visualizer grid theme
        const visualizers = document.querySelectorAll('.visualizer');
        visualizers.forEach(v => {
          v.className = v.className.replace(/theme-\\w+/, '');
          v.className += ' theme-${theme}';
        });
      `);
    }

    // Handle autostart setting
    if (prefs.app_settings?.autostart !== undefined) {
      app.setLoginItemSettings({
        openAtLogin: prefs.app_settings.autostart
      });
    }

    // Apply other settings as needed
    if (prefs.osc_settings) {
      OSCserverIP = prefs.osc_settings.host || '127.0.0.1';
      OSCserverPort = prefs.osc_settings.port || 9000;
      if (mainWindow) {
        mainWindow.webContents.send('osc-settings-updated', prefs.osc_settings);
      }
    }

    if (prefs.device_settings) {
      // Apply device settings
      if (mainWindow) {
        mainWindow.webContents.send('device-settings-updated', prefs.device_settings);
      }
    }
  });

  return preferences;
}

function setupHIDDevice() {
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

    spaceMouse = new HID.HID(device.path);
    console.log('Successfully connected to SpaceMouse');

    spaceMouse.on('data', (data) => {
      // Handle SpaceMouse data
      console.log('SpaceMouse data:', data);
    });

    spaceMouse.on('error', (error) => {
      console.error('SpaceMouse error:', error);
    });

    return spaceMouse;
  } catch (error) {
    console.error('Error setting up HID device:', error);
    return null;
  }
}

function setupOSC() {
  try {
    if (!validIpPort) {
      console.error('Invalid IP:Port configuration');
      return;
    }

    if (oscCli) {
      oscCli.close();
    }

    oscCli = new osc.UDPPort({
      localAddress: "0.0.0.0",
      localPort: oUDPport,
      metadata: true
    });

    oscCli.on("ready", () => {
      mainWindow.webContents.send("logInfo", "OSC ready to listen on port " + oUDPport);
    });

    oscCli.on("error", (error) => {
      console.error("OSC error:", error);
      mainWindow.webContents.send("logInfo", "OSC error: " + error.message);
      mainWindow.webContents.send("udpPortKO", error.message);
    });

    oscCli.on("message", (oscBundle) => {
      const oscAddress = oscBundle.address;
      const oscArgs = oscBundle.args;
      mainWindow.webContents.send("logInfo", oscAddress + " " + oscArgs[0].value);
      if (oscAddress === "/spacemouse/mode") {
        handleMode(oscArgs);
      } else if (oscAddress === "/spacemouse/prefix") {
        handlePrefix(oscArgs);
      } else if (oscAddress === "/spacemouse/precision") {
        handlePrecision(oscArgs);
      } else if (oscAddress === "/spacemouse/factor") {
        handleFactor(oscArgs);
      } else if (oscAddress === "/spacemouse/sendRate") {
        handleSendRate(oscArgs);
      }
    });

    oscCli.open();
  } catch (error) {
    console.error('Error setting up OSC:', error);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send("logInfo", "Error setting up OSC: " + error.message);
    }
  }
}

function initializeApp() {
  try {
    // Get app version
    appVersion = app.getVersion();
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send("appVersion", appVersion);
    }

    // Create documents directory if it doesn't exist
    defaultDir = path.join(app.getPath("documents"), "spacemouse-OSC");
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir);
    }

    // Start the main process
    main();
  } catch (error) {
    console.error('Error in initializeApp:', error);
    dialog.showErrorBox('Initialization Error', error.message);
  }
}

function main() {
  try {
    // Set up default preferences
    if (preferences && preferences.value) {
      handleMode([{ value: preferences.value("app_settings.default_mode") }]);
      handlePrefix([{ value: preferences.value("app_settings.default_prefix") }]);
      handlePrecision([{ value: preferences.value("app_settings.default_precision") }]);
      handleFactor([{ value: preferences.value("app_settings.default_factor") }]);
      handleSendRate([{ value: preferences.value("app_settings.default_send_rate") }]);
    }

    // Set up HID and OSC after window is ready
    if (mainWindow && mainWindow.webContents) {
      setupHIDDevice();
      setupOSC();
    }
  } catch (error) {
    console.error('Error in main:', error);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send("logInfo", "Error in main: " + error.message);
    }
  }
}

// App event handlers
app.whenReady().then(() => {
  createWindow();
  initializePreferences();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers
ipcMain.on('show-preferences', () => {
  preferences.show();
});

ipcMain.on('get-preferences', (event) => {
  const prefs = store.get('preferences', defaultPreferences);
  event.reply('preferences-updated', prefs);
});

ipcMain.on('save-preferences', (event, newPrefs) => {
  store.set('preferences', newPrefs);
  event.reply('preferences-saved', newPrefs);
});

ipcMain.on('matchingIpPort', () => {
  validIpPort = true;
});

ipcMain.on('notMatchingIpPort', () => {
  validIpPort = false;
});

ipcMain.on("ok_to_send", (event, prefix, index, index_or_not, attr, value) => {
  if (!oscCli) {
    console.error('OSC client not initialized');
    return;
  }

  if (index_or_not === "visible") {
    oscCli.send({
      address: prefix + "/" + index + "/" + attr,
      args: [{
        type: "f",
        value: parseFloat(value)
      }]
    }, OSCserverIP, OSCserverPort);
    
    mainWindow.webContents.send("logInfo", 
      `${prefix}/${index}/${attr} ${value} sent to ${OSCserverIP}:${OSCserverPort}`);
  } else {
    oscCli.send({
      address: prefix + "/" + attr,
      args: [{
        type: "f",
        value: parseFloat(value)
      }]
    }, OSCserverIP, OSCserverPort);
    
    mainWindow.webContents.send("logInfo", 
      `${prefix}${attr} ${value} sent to ${OSCserverIP}:${OSCserverPort}`);
  }
});

ipcMain.on("sendOscServerIp", (event, oServerIP) => {
  OSCserverIP = oServerIP;
});

ipcMain.on("sendOscServerPort", (event, oServerPort) => {
  OSCserverPort = oServerPort;
  mainWindow.webContents.send("oServerOK");
});

ipcMain.on("sendRateChange", (event, rate) => {
  sendFrequency = 100 / rate;
});

ipcMain.on('resize-window', (event, { height }) => {
  if (mainWindow) {
    const [width] = mainWindow.getSize();
    mainWindow.setSize(width, height);
  }
});

// OSC address handlers
function handleMode(args) {
  const modeValue = args[0].value;
  if (modeFunctions[modeValue]) {
    modeFunctions[modeValue](modeValue);
  }
}

function handlePrefix(args) {
  const prefixValue = args[0].value;
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send("prefix", prefixValue);
  }
}

function handlePrecision(args) {
  const precisionValue = args[0].value;
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send("precision", precisionValue);
  }
}

function handleFactor(args) {
  const factorValue = args[0].value;
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send("factor", factorValue);
  }
}

function handleSendRate(args) {
  const rateValue = args[0].value;
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send("sendRate", rateValue);
  }
}

const modeFunctions = {
  aed: handleMode,
  ad: handleMode,
  xyz: handleMode,
  xy: handleMode,
  custom1: handleMode,
  custom2: handleMode,
  custom3: handleMode,
};

const oscAddressFunctions = {
  "/mode": handleMode,
  "/prefix": handlePrefix,
  "/precision": handlePrecision,
  "/factor": handleFactor,
  "/sendRate": handleSendRate,
};
