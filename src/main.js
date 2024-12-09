const electron = require('electron');
const { app, BrowserWindow, ipcMain, dialog, nativeTheme, Tray, Menu, nativeImage } = require('electron');
const ElectronPreferences = require("electron-preferences");
const fs = require("fs");
const log = require("electron-log");
const path = require("path");
const Store = require('electron-store');
const osc = require("osc");
const { spaceMice } = require('./lib');

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

// Global references
let mainWindow = null;
let preferences = null;
let oscCli = null;
let device = null;
let sendInterval = null;
let defaultDir = null;
let appVersion = null;
let OSCserverIP = "127.0.0.1";  // Default value
let OSCserverPort = 8000;      // Default value
let oUDPport = 9000;  // Default value
let validIpPort = true;
let tray = null;

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

// Handle IPC events
ipcMain.on('getPreferences', (event) => {
  try {
    const prefs = store.get('preferences', defaultPreferences);
    event.returnValue = prefs;
  } catch (error) {
    log.error('Error getting preferences:', error);
    event.returnValue = null;
  }
});

ipcMain.handle('updatePreferences', async (event, prefs) => {
  try {
    store.set('preferences', prefs);
    if (prefs.app_settings?.autostart !== undefined) {
      await handleAutostart(prefs.app_settings.autostart);
    }
    mainWindow?.webContents.send('preference-update', prefs);
    return { success: true };
  } catch (error) {
    log.error('Error updating preferences:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.on('savePreferences', async (event, prefs) => {
  try {
    store.set('preferences', prefs);
    event.reply('preferences-saved', prefs);
  } catch (error) {
    log.error('Error saving preferences:', error);
    event.reply('error', error.message);
  }
});

// Create application icon
function createAppIcon() {
  try {
    // Create a 32x32 icon for better window icon quality
    const image = nativeImage.createEmpty();
    const size = { width: 32, height: 32 };
    const imageData = Buffer.alloc(size.width * size.height * 4);
    
    // Create a SpaceMouse-like icon
    for (let y = 0; y < size.height; y++) {
      for (let x = 0; x < size.width; x++) {
        const i = (y * size.width + x) * 4;
        
        // Calculate distance from center
        const centerX = size.width / 2;
        const centerY = size.height / 2;
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Base shape (circular)
        if (distance < 12) {
          // Main body (light blue)
          imageData[i] = 100;     // R
          imageData[i + 1] = 180; // G
          imageData[i + 2] = 255; // B
          imageData[i + 3] = 255; // A
          
          // Add highlight
          if (distance < 8 && x > centerX && y < centerY) {
            imageData[i] = 150;     // R
            imageData[i + 1] = 200; // G
            imageData[i + 2] = 255; // B
          }
        } 
        // Add knob on top
        else if (y < 10 && x > (size.width/2 - 4) && x < (size.width/2 + 4)) {
          imageData[i] = 80;      // R
          imageData[i + 1] = 160; // G
          imageData[i + 2] = 235; // B
          imageData[i + 3] = 255; // A
        }
        // Transparent background
        else {
          imageData[i] = 0;
          imageData[i + 1] = 0;
          imageData[i + 2] = 0;
          imageData[i + 3] = 0;
        }
      }
    }
    
    image.addRepresentation({
      width: size.width,
      height: size.height,
      buffer: imageData,
      scaleFactor: 1.0
    });

    // Also create 16x16 version for tray
    const smallImage = image.resize({ width: 16, height: 16 });

    return { icon: image, trayIcon: smallImage };
  } catch (error) {
    log.error('Error creating app icon:', error);
    return null;
  }
}

function createTray() {
  try {
    const icons = createAppIcon();
    if (!icons) {
      log.error('Failed to create tray icon');
      return;
    }

    // If tray already exists, destroy it first
    if (tray) {
      tray.destroy();
    }

    // Create new tray with the generated icon
    tray = new Tray(icons.trayIcon);
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Window',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      {
        label: 'Preferences',
        click: () => {
          if (preferences) {
            preferences.show();
            preferences.focus();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);

    // Set tray properties
    tray.setToolTip('SpaceMouse OSC');
    tray.setContextMenu(contextMenu);

    // Handle tray click events
    tray.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    log.info('Tray icon created successfully');
  } catch (error) {
    log.error('Error creating tray icon:', error);
  }
}

async function createWindow() {
  try {
    const icons = createAppIcon();
    
    mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      autoHideMenuBar: true,
      icon: icons ? icons.icon : undefined,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    // Set window icon explicitly for Linux
    if (process.platform === 'linux' && icons) {
      mainWindow.setIcon(icons.icon);
      
      // Try setting it as a data URL as fallback
      const dataUrl = icons.icon.toDataURL();
      mainWindow.setIcon(nativeImage.createFromDataURL(dataUrl));
    }

    // Remove menu completely
    mainWindow.setMenu(null);

    // Load the index.html file
    await mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // Handle window minimize
    mainWindow.on('minimize', (event) => {
      try {
        const minimizeToTray = store.get('preferences.app_settings.minimizeToTray', true);
        if (minimizeToTray) {
          event.preventDefault();
          mainWindow.hide();
          // Ensure tray exists when minimizing
          if (!tray) {
            createTray();
          }
        }
      } catch (error) {
        log.error('Error handling window minimize:', error);
      }
    });

    // Handle window close
    mainWindow.on('close', handleWindowClose);

    log.info('Main window created successfully');
    return mainWindow;
  } catch (error) {
    log.error('Error creating main window:', error);
    throw error;
  }
}

function handleWindowClose(event) {
  try {
    if (!app.isQuitting) {
      const minimizeToTray = store.get('preferences.app_settings.minimizeToTray', true);
      if (minimizeToTray) {
        event.preventDefault();
        mainWindow.hide();
        // Ensure tray exists when minimizing to tray
        if (!tray) {
          createTray();
        }
        return false;
      }
    }
  } catch (error) {
    log.error('Error handling window close:', error);
  }
}

function handleAutostart(enabled) {
  try {
    const exePath = app.getPath('exe');
    const name = 'SpaceMouse OSC';

    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: exePath,
      name: name,
      args: ['--hidden']
    });

    log.info('Autostart setting updated:', { enabled, path: exePath });
  } catch (error) {
    log.error('Error updating autostart setting:', error);
  }
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
      handleAutostart(prefs.app_settings.autostart);
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
    const deviceSettings = store.get('preferences.device_settings');
    spaceMice.options = deviceSettings;
    spaceMice.initialize();

    if (spaceMice.mice.length === 0) {
      log.warn('No SpaceMouse devices found');
      return null;
    }

    // Set up data handler
    spaceMice.onData = (data) => {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('spacemouse-data', {
          translate: data.translate,
          rotate: data.rotate,
          buttons: data.buttons
        });
      }

      // Send OSC messages if configured
      if (udpPort) {
        const oscData = {
          translate: data.translate,
          rotate: data.rotate,
          buttons: data.buttons
        };
        sendOSCData(oscData);
      }
    };

    log.info('SpaceMouse devices initialized successfully');
    return spaceMice;
  } catch (error) {
    log.error('Error setting up SpaceMouse devices:', error);
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
app.whenReady().then(async () => {
  try {
    // Create and set application icon
    const icons = createAppIcon();
    if (icons) {
      // Set the app icon
      app.dock?.setIcon(icons.icon); // For macOS
      
      // Set default window icon for Linux
      if (process.platform === 'linux') {
        app.commandLine.appendSwitch('force-app-icon', icons.icon);
      }
    }

    // Create window and initialize preferences
    mainWindow = await createWindow();
    await initializePreferences();

    // Create tray icon
    createTray();

    // Set initial autostart setting
    const autostart = store.get('preferences.app_settings.autostart', false);
    await handleAutostart(autostart);

    // Handle startup with --hidden flag
    if (process.argv.includes('--hidden')) {
      mainWindow.hide();
    }
  } catch (error) {
    log.error('Error initializing app:', error);
    app.quit();
  }
}).catch(error => {
  log.error('Error in app initialization:', error);
  app.quit();
});

// Handle quit
app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  spaceMice.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (!mainWindow) {
    try {
      await createWindow();
    } catch (error) {
      log.error('Error recreating window:', error);
    }
  }
});

// IPC handlers
ipcMain.on('show-preferences', () => {
  preferences.show();
});

ipcMain.on('getPreferences', (event) => {
  const prefs = store.get('preferences', defaultPreferences);
  event.reply('preferences-updated', prefs);
});

ipcMain.on('savePreferences', async (event, newPrefs) => {
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

// Export store for use in other modules
module.exports = { store };
