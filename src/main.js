const electron = require('electron');
const { app, BrowserWindow, ipcMain, dialog, nativeTheme, Tray, Menu, nativeImage } = electron;
const fs = require("fs");
const log = require("electron-log");
const path = require("path");
const osc = require("osc");
const { SpaceMouse, SpaceMiceManager } = require('./lib');
const utils = require('./utils');
const ElectronPreferences = require('electron-preferences');

// Prevent unhandled EPIPE crashes when stdout/stderr is closed (e.g. AppImage
// launched without an attached terminal, or the terminal is closed mid-run)
process.stdout.on('error', (err) => {
  if (err.code !== 'EPIPE') throw err;
});
process.stderr.on('error', (err) => {
  if (err.code !== 'EPIPE') throw err;
});

// Configure logging
log.transports.file.level = 'info';
// Console transport isn't useful (and can throw EPIPE) once the app is packaged
// and running without an attached terminal.
log.transports.console.level = app.isPackaged ? false : 'info';

// Forward logs to renderer
function sendLogToRenderer(level, ...args) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('log-message', {
      level,
      message: args.join(' '),
      timestamp: new Date().toISOString()
    });
  }
}

// Set up log forwarding
log.hooks.push((message, transport) => {
  if (transport !== log.transports.file) {
    return message;
  }
  sendLogToRenderer(message.level, message.data.join(' '));
  return message;
});

// Global references
let mainWindow = null;
let device = null;
let sendInterval = null;
let defaultDir = null;
let appVersion = null;
let OSCserverIP = "127.0.0.1";  // Default value
let OSCserverPort = 9000;      // Default value
let oUDPport = 12000;  // Default value
let validIpPort = true;
let tray = null;
let udpPort = null;  // Make it globally available
let oscServer = null;
let spaceMiceManager = null;

// Rate limiting variables
let lastOSCSendTime = Date.now();
let lastOSCData = null;

// Get preferences helper
function getPreference(section, key, defaultValue) {
  try {
    // Make sure preferences is initialized
    if (!preferences || !preferences.preferences) {
      return defaultValue;
    }
    return preferences.preferences[section]?.[key] ?? defaultValue;
  } catch (error) {
    log.error('Error getting preference:', error);
    return defaultValue;
  }
}

// Set preferences helper
function setPreference(section, key, value) {
  try {
    // Make sure preferences is initialized
    if (!preferences || !preferences.preferences) {
      preferences.preferences = {};
    }
    if (!preferences.preferences[section]) {
      preferences.preferences[section] = {};
    }
    preferences.preferences[section][key] = value;
    preferences.save();
  } catch (error) {
    log.error('Error setting preference:', error);
  }
}

// Add IPC handler for screen size
const { screen } = require('electron');
ipcMain.handle('get-screen-size', () => {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    return { width, height };
});

// Preferences configuration
const preferences = new ElectronPreferences({
    dataStore: path.resolve(app.getPath('userData'), 'preferences.json'),
    defaults: {
        app: {
            theme: 'system',
            autostart: false,
            minimizeToTray: true
        },
        osc: {
            serverIp: '127.0.0.1',
            serverPort: 9000,
            udpPort: 12000
        },
        device_settings: {
            mode: 'aed',
            sendRate: 33,
            prefix: '/track',
            index: 1,
            precision: 'clear',
            factor: 1
        }
    },
    sections: [
        {
            id: 'app',
            label: 'Application Settings',
            icon: 'settings-gear-63',
            form: {
                groups: [
                    {
                        label: 'Application Behavior',
                        fields: [
                            {
                                label: 'Theme',
                                key: 'theme',
                                type: 'dropdown',
                                options: [
                                    { label: 'System', value: 'system' },
                                    { label: 'Dark', value: 'dark' },
                                    { label: 'Light', value: 'light' }
                                ],
                                help: 'Choose the application theme'
                            },
                            {
                                label: 'Start with Windows',
                                key: 'autostart',
                                type: 'checkbox',
                                help: 'Launch application when Windows starts'
                            },
                            {
                                label: 'Minimize to Tray',
                                key: 'minimizeToTray',
                                type: 'checkbox',
                                help: 'Keep application running in system tray when closed'
                            }
                        ]
                    }
                ]
            }
        },
        {
            id: 'osc',
            label: 'OSC Settings',
            icon: 'network-connection-wireless',
            form: {
                groups: [
                    {
                        label: 'Server Settings',
                        fields: [
                            {
                                label: 'IP',
                                key: 'serverIp',
                                type: 'text',
                                help: 'OSC server IP address'
                            },
                            {
                                label: 'Port',
                                key: 'serverPort',
                                type: 'number',
                                help: 'OSC server port number'
                            },
                            {
                                label: 'UDP Port',
                                key: 'udpPort',
                                type: 'number',
                                help: 'UDP port number'
                            }
                        ]
                    }
                ]
            }
        },
        {
            id: 'device_settings',
            label: 'Device Settings',
            icon: 'mouse',
            form: {
                groups: [
                    {
                        label: 'SpaceMouse Configuration',
                        fields: [
                            {
                                label: 'Mode',
                                key: 'mode',
                                type: 'dropdown',
                                options: [
                                    { label: 'AED', value: 'aed' },
                                    { label: 'AD', value: 'ad' },
                                    { label: 'XYZ', value: 'xyz' },
                                    { label: 'XY', value: 'xy' },
                                    { label: 'Custom1', value: 'custom1' },
                                    { label: 'Custom2', value: 'custom2' },
                                    { label: 'Custom3', value: 'custom3' }
                                ],
                                help: 'Device operation mode'
                            },
                            {
                                label: 'OSC Prefix',
                                key: 'prefix',
                                type: 'text',
                                help: 'OSC message prefix'
                            },
                            {
                                label: 'Index',
                                key: 'index',
                                type: 'number',
                                help: 'Device index number',
                                min: 1,
                                step: 1
                            },
                            {
                                label: 'Precision',
                                key: 'precision',
                                type: 'dropdown',
                                options: [
                                    { label: 'Clear', value: 'clear' },
                                    { label: '1/100000', value: '100000' },
                                    { label: '1/1000', value: '1000' },
                                    { label: '1/100', value: '100' },
                                    { label: '1/10', value: '10' },
                                    { label: '1', value: '1' }
                                ],
                                help: 'Value precision'
                            },
                            {
                                label: 'Factor',
                                key: 'factor',
                                type: 'number',
                                help: 'Scaling factor',
                                min: 0.1,
                                step: 0.1
                            },
                            {
                                label: 'Send Rate',
                                key: 'sendRate',
                                type: 'number',
                                help: 'Data send rate (1 to 100)',
                                min: 1,
                                max: 100,
                                step: 1
                            }
                        ]
                    }
                ]
            }
        }
    ]
});

// Handle preferences changes
preferences.on('save', (preferences) => {
    log.info('Preferences updated:', preferences);
    
    // Apply app settings
    if (preferences.app) {
        handleAutostart(preferences.app.autostart);
        nativeTheme.themeSource = preferences.app.theme;
    }
    
    // Apply OSC settings
    if (preferences.osc) {
        OSCserverIP = preferences.osc.serverIp;
        OSCserverPort = preferences.osc.serverPort;
        oUDPport = preferences.osc.udpPort;
        setupOSC();
    }
    
    // Apply device settings
    if (preferences.device_settings && spaceMiceManager) {
        const settings = preferences.device_settings;
        spaceMiceManager.options.mode = settings.mode;
        spaceMiceManager.options.prefix = settings.prefix;
        spaceMiceManager.options.index = settings.index;
        spaceMiceManager.options.precision = settings.precision;
        spaceMiceManager.options.factor = settings.factor;
        spaceMiceManager.options.sendRate = Number(settings.sendRate);
    }
    
    // Notify renderer of preference changes
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('preferences-updated', preferences);
    }
});

// IPC handlers
ipcMain.handle('getPreferences', () => {
  return preferences.preferences;
});

ipcMain.on('mode-change', (event, mode) => {
  log.info('Mode change received:', mode);
  setPreference('device_settings', 'mode', mode);
  if (spaceMiceManager) {
    spaceMiceManager.options.mode = mode;
  }
});

ipcMain.on('prefix-change', (event, prefix) => {
  log.info('Prefix change received:', prefix);
  setPreference('device_settings', 'prefix', prefix);
  if (spaceMiceManager) {
    spaceMiceManager.options.prefix = prefix;
  }
});

ipcMain.on('index-change', (event, index) => {
  log.info('Index change received:', index);
  setPreference('device_settings', 'index', index);
  if (spaceMiceManager) {
    spaceMiceManager.options.index = index;
  }
});

ipcMain.on('precision-change', (event, precision) => {
  log.info('Precision change received:', precision);
  setPreference('device_settings', 'precision', precision);
  if (spaceMiceManager) {
    spaceMiceManager.options.precision = precision;
  }
});

ipcMain.on('factor-change', (event, factor) => {
  log.info('Factor change received:', factor);
  setPreference('device_settings', 'factor', factor);
  if (spaceMiceManager) {
    spaceMiceManager.options.factor = factor;
  }
});

ipcMain.on('sendRate-change', (event, rate) => {
    log.info('Send rate change received:', rate);
    const numericRate = Number(rate);
    if (!isNaN(numericRate) && numericRate >= 1 && numericRate <= 100) {
        // Update preferences
        setPreference('device_settings', 'sendRate', numericRate);
        
        // Update spaceMiceManager if available
        if (spaceMiceManager) {
            spaceMiceManager.options.sendRate = numericRate;
        }
        
        // Notify renderer to update UI
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('preferences-updated', preferences.preferences);
        }
    } else {
        log.warn('Invalid send rate value:', rate);
    }
});

ipcMain.on('show-preferences', () => {
    preferences.show();
});

ipcMain.on('log-info', (event, ...args) => {
  log.info(...args);
});

ipcMain.on('log-error', (event, ...args) => {
  log.error(...args);
});

ipcMain.on('log-warn', (event, ...args) => {
  log.warn(...args);
});

ipcMain.on('log-debug', (event, ...args) => {
  log.debug(...args);
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

// --- OVERLAY WINDOW ---

let overlayWindow = null;
function showOverlay(screenWidth, screenHeight) {
    // Always destroy any existing overlay window before creating a new one
    if (overlayWindow) {
        try {
            overlayWindow.close();
        } catch (e) {}
        overlayWindow = null;
    }
    overlayWindow = new BrowserWindow({
        width: screenWidth,
        height: screenHeight,
        x: 0,
        y: 0,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        focusable: false,
        fullscreen: true,
        hasShadow: false,
        resizable: false,
        show: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: require('path').join(__dirname, 'preload.js')
        }
    });
    overlayWindow.setIgnoreMouseEvents(true);
    overlayWindow.loadFile(require('path').join(__dirname, 'overlay.html'));
    overlayWindow.webContents.openDevTools({ mode: 'detach' });
}
function hideOverlay() {
    if (overlayWindow) {
        try {
            overlayWindow.close();
        } catch (e) {}
        overlayWindow = null;
    }
}
// IPC handlers for overlay toggle
ipcMain.on('show-overlay', (event, { width, height }) => {
    showOverlay(width, height);
});
ipcMain.on('hide-overlay', () => {
    hideOverlay();
});
function sendOverlayData(data) {
    if (overlayWindow && overlayWindow.webContents) {
        overlayWindow.webContents.send('overlay-data', data);
    }
}

// --- GLOBAL MOUSE FALLBACK (removed) ---
// The old fallback used robotjs to poll the mouse position at 50Hz and
// send it as OSC data. This was problematic (no force-return) and has
// been replaced by the virtual joystick UI in the renderer, which drives
// OSC directly via 'spacemouse-data-with-paths'.

// Fallback mode is enabled by user when no SpaceMouse is detected.
// The renderer shows the virtual joystick; main.js just logs it.
ipcMain.on('enable-mouse-fallback', () => {
    log.info('Fallback mode enabled (virtual joystick).');
});

// Handle real SpaceMouse hardware data (translation/rotation + live OSC
// paths computed by the renderer from the current UI fields/prefix/index).
// Also used by the virtual joystick in fallback mode.
ipcMain.on('spacemouse-data-with-paths', (event, data) => {
    try {
        if (!data || !data.translation || !data.rotation || !data.paths) {
            log.warn('Invalid spacemouse-data-with-paths payload:', data);
            return;
        }
        const sendRate = Number(getPreference('device_settings', 'sendRate', 33));
        if (!shouldSendOSCMessage(sendRate)) {
            return;
        }
        const formattedData = formatDataWithParameters(data);
        sendOSCMessages(formattedData);
    } catch (error) {
        log.error('Error handling spacemouse-data-with-paths:', error);
    }
});

// Store current OSC paths
let currentOSCPaths = {
    translation: {},
    rotation: {}
};

// Handle OSC path updates
ipcMain.on('update-osc-paths', (event, paths) => {
    try {
        if (!paths || typeof paths !== 'object') {
            throw new Error('Invalid paths structure');
        }

        // Store the paths for future use
        currentOSCPaths = paths;

        // Log path update occasionally
        if (Math.random() < 0.1) {
            log.info('Updated OSC paths:', paths);
        }
    } catch (error) {
        log.error('Error updating OSC paths:', error);
    }
});

// Send a {translation, rotation} map of path -> value as OSC messages.
// Returns true if at least one message was sent.
function sendOSCMessages(formattedData, logPrefix = '') {
    if (!udpPort || !udpPort.options || !udpPort.options.remoteAddress) {
        log.error(`${logPrefix}Cannot send OSC: udpPort not initialized or missing remote address`, {
            udpPort: udpPort ? {
                remoteAddress: udpPort.options ? udpPort.options.remoteAddress : undefined,
                remotePort: udpPort.options ? udpPort.options.remotePort : undefined
            } : null
        });
        return false;
    }
    let sentAny = false;
    ['translation', 'rotation'].forEach((group) => {
        const entries = formattedData[group];
        if (!entries) return;
        Object.entries(entries).forEach(([path, value]) => {
            if (!path) return; // Skip if field is hidden/bypassed
            sentAny = true;
            udpPort.send({
                address: path,
                args: [{ type: 'f', value }]
            });
            log.info(`${logPrefix}OSC sent: ${path} => ${value} to ${udpPort.options.remoteAddress}:${udpPort.options.remotePort}`);
        });
    });
    return sentAny;
}

// Format data with parameters
function formatDataWithParameters(data) {
    const mode = getPreference('device_settings', 'mode', 'aed');
    const factor = parseFloat(getPreference('device_settings', 'factor', 1));
    const precision = getPreference('device_settings', 'precision', 'clear');
    const prefix = getPreference('device_settings', 'prefix', '/track');
    const index = getPreference('device_settings', 'index', 1);

    if (!data || !data.translation || !data.rotation || !data.paths) {
        throw new Error('Invalid data structure');
    }

    // Apply factor to all values
    const translation = {
        x: data.translation.x * factor,
        y: data.translation.y * factor,
        z: data.translation.z * factor
    };

    const rotation = {
        x: data.rotation.x * factor,
        y: data.rotation.y * factor,
        z: data.rotation.z * factor
    };

    // Format the data according to paths
    const formattedData = {
        translation: {},
        rotation: {}
    };

    // Add translation paths
    const trPaths = data.paths.translation || {};
    Object.entries(trPaths).forEach(([axis, path]) => {
        if (translation[axis] !== undefined) {
            formattedData.translation[path] = translation[axis];
        }
    });

    // Add rotation paths
    const rotPaths = data.paths.rotation || {};
    Object.entries(rotPaths).forEach(([axis, path]) => {
        if (rotation[axis] !== undefined) {
            formattedData.rotation[path] = rotation[axis];
        }
    });

    return formattedData;
}

function calculateMessageInterval(sendRate) {
    // Base rate is assumed to be 100Hz (10ms interval)
    const baseInterval = 10;
    // Calculate actual interval based on send rate percentage
    return Math.floor(baseInterval * (100 / sendRate));
}

function shouldSendOSCMessage(sendRate) {
    const now = Date.now();
    const interval = calculateMessageInterval(sendRate);
    
    if (now - lastOSCSendTime >= interval) {
        lastOSCSendTime = now;
        return true;
    }
    return false;
}

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
          if (preferencesWindow) {
            preferencesWindow.show();
            preferencesWindow.focus();
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
    mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.resolve(__dirname, 'preload.js'),
        sandbox: false
      }
    });

    // Set proper Content Security Policy
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-hashes'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data:; " +
            "font-src 'self' data:;"
          ]
        }
      });
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // Set up window event handlers
    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    // Handle window minimize
    mainWindow.on('minimize', (event) => {
      try {
        const minimizeToTray = app.getLoginItemSettings().minimizeToTray;
        if (minimizeToTray) {
          event.preventDefault();
          mainWindow.hide();
        }
      } catch (error) {
        log.error('Error handling window minimize:', error);
      }
    });

    // Handle window close
    mainWindow.on('close', handleWindowClose);

    // Open dev tools in development mode
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools();
    }

    return mainWindow;
  } catch (error) {
    log.error('Error creating window:', error);
    throw error;
  }
}

function handleWindowClose(event) {
  try {
    if (!app.isQuitting) {
      const minimizeToTray = app.getLoginItemSettings().minimizeToTray;
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

function setupHIDDevice() {
  try {
    // Get device settings from preferences
    const mode = getPreference('device_settings', 'mode', 'aed');
    const sendRate = getPreference('device_settings', 'sendRate', 33);
    const prefix = getPreference('device_settings', 'prefix', '/track');
    const index = getPreference('device_settings', 'index', 1);
    const precision = getPreference('device_settings', 'precision', 'clear');
    const factor = parseFloat(getPreference('device_settings', 'factor', 1));

    // Initialize SpaceMice manager with options
    spaceMiceManager = new SpaceMiceManager();
    spaceMiceManager.options = {
      mode,
      sendRate,
      prefix,
      index,
      precision,
      factor
    };

    // Initialize devices
    spaceMiceManager.initialize();
    
    // Check if any devices were found
    if (spaceMiceManager.mice.length === 0) {
      log.warn('No SpaceMouse devices found');

      // Prompt user for fallback approval
      if (mainWindow && mainWindow.webContents) {
        dialog.showMessageBox(mainWindow, {
          type: 'question',
          buttons: ['Yes', 'No'],
          defaultId: 0,
          cancelId: 1,
          title: 'Fallback to Mouse',
          message: 'No SpaceMouse device detected. Would you like to use your conventional mouse as a fallback input device?'
        }).then(result => {
          if (result.response === 0) {
            // User approved fallback
            mainWindow.webContents.send('enable-mouse-fallback');
            log.info('User approved fallback to conventional mouse.');
          } else {
            log.info('User declined fallback to conventional mouse.');
          }
        });
      }
      return false;
    }
    
    log.info('Found SpaceMouse devices:', spaceMiceManager.mice);
    
    // Set up data handler
    spaceMiceManager.onData = (data) => {
      try {
        if (mainWindow && mainWindow.webContents) {
          // Format the data for the renderer
          const formattedData = {
            translation: {
              x: data.translate?.x || 0,
              y: data.translate?.y || 0,
              z: data.translate?.z || 0
            },
            rotation: {
              x: data.rotate?.x || 0,
              y: data.rotate?.y || 0,
              z: data.rotate?.z || 0
            },
            buttons: data.buttons || []
          };

          // Send to renderer for UI update and path collection
          mainWindow.webContents.send('spacemouse-data', formattedData);
        }
      } catch (error) {
        log.error('Error handling spacemouse data:', error);
      }
    };

    // Store first device as our main device
    device = spaceMiceManager.mice[0];

    // Notify renderer that a real device is connected (show SpaceMouse UI)
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('device-connected');
    }

    log.info('SpaceMouse device initialized successfully');
    return true;
  } catch (error) {
    log.error('Error setting up SpaceMouse devices:', error);
    return false;
  }
}

function setupOSC() {
  try {
    // Get OSC settings from preferences
    const oscSettings = {
      serverIp: getPreference('osc', 'serverIp', '127.0.0.1'),
      serverPort: getPreference('osc', 'serverPort', 9000),
      udpPort: getPreference('osc', 'udpPort', 12000)
    };

    // Close existing connections if any
    if (udpPort) {
      udpPort.close();
    }

    // Create new UDP connection
    udpPort = new osc.UDPPort({
      localAddress: "0.0.0.0",
      localPort: oscSettings.udpPort,
      remoteAddress: oscSettings.serverIp,
      remotePort: oscSettings.serverPort,
      metadata: true
    });

    udpPort.on("ready", () => {
      log.info(`OSC UDP Port ready on port ${oscSettings.udpPort}`);
      log.info(`Sending to ${oscSettings.serverIp}:${oscSettings.serverPort}`);
      log.info(`Listening for incoming OSC on port ${oscSettings.udpPort}`);
    });

    // Listen for incoming OSC messages (remote control of the app)
    udpPort.on("message", (oscMsg, timeTag, info) => {
      const address = oscMsg.address;
      const args = oscMsg.args;
      log.info(`OSC received: ${address} from ${info.address}:${info.port}`);

      // Forward to renderer for logging/display
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('osc-message', {
          address,
          args,
          source: `${info.address}:${info.port}`
        });
      }

      // Dispatch to known address handlers
      if (oscAddressFunctions[address]) {
        oscAddressFunctions[address](args);
      } else {
        log.debug(`No handler for OSC address: ${address}`);
      }
    });

    udpPort.on("error", (err) => {
      log.error("OSC UDP Port error:", err);
    });

    // Open the socket
    udpPort.open();
    log.info('OSC connection initialized successfully');
    return true;
  } catch (error) {
    log.error('Error setting up OSC:', error);
    return false;
  }
}

async function main() {
  try {
    // Create window and initialize app
    mainWindow = await createWindow();

    // Wait for window to be ready
    mainWindow.webContents.on('did-finish-load', () => {
      // Initialize app components
      setupHIDDevice();
      setupOSC();

      // Set initial theme
      const isDarkMode = nativeTheme.shouldUseDarkColors;
      mainWindow.webContents.send('update-theme', isDarkMode ? 'dark' : 'light');
    });

    // Create tray icon
    createTray();

    // Set initial autostart setting
    const autostart = app.getLoginItemSettings().openAtLogin;
    await handleAutostart(autostart);

    // Handle startup with --hidden flag
    if (process.argv.includes('--hidden')) {
      mainWindow.hide();
    }

  } catch (error) {
    log.error('Error in main:', error);
    app.quit();
  }
}

// Start the app
app.whenReady().then(main).catch((error) => {
  log.error('Failed to start app:', error);
  app.quit();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    main();
  }
});

// OSC address handlers — receive remote control commands via OSC
function handleMode(args) {
  const modeValue = args[0].value;
  log.info(`[OSC IN] mode → ${modeValue}`);
  setPreference('device_settings', 'mode', modeValue);
  if (spaceMiceManager) spaceMiceManager.options.mode = modeValue;
  if (mainWindow && mainWindow.webContents) mainWindow.webContents.send("mode", modeValue);
}

function handlePrefix(args) {
  const prefixValue = args[0].value;
  log.info(`[OSC IN] prefix → ${prefixValue}`);
  setPreference('device_settings', 'prefix', prefixValue);
  if (spaceMiceManager) spaceMiceManager.options.prefix = prefixValue;
  if (mainWindow && mainWindow.webContents) mainWindow.webContents.send("prefix", prefixValue);
}

function handlePrecision(args) {
  const precisionValue = args[0].value;
  log.info(`[OSC IN] precision → ${precisionValue}`);
  setPreference('device_settings', 'precision', precisionValue);
  if (spaceMiceManager) spaceMiceManager.options.precision = precisionValue;
  if (mainWindow && mainWindow.webContents) mainWindow.webContents.send("precision", precisionValue);
}

function handleFactor(args) {
  const factorValue = Number(args[0].value);
  log.info(`[OSC IN] factor → ${factorValue}`);
  setPreference('device_settings', 'factor', factorValue);
  if (spaceMiceManager) spaceMiceManager.options.factor = factorValue;
  if (mainWindow && mainWindow.webContents) mainWindow.webContents.send("factor", factorValue);
}

function handleSendRate(args) {
  const rateValue = Number(args[0].value);
  log.info(`[OSC IN] sendRate → ${rateValue}`);
  if (!isNaN(rateValue) && rateValue >= 1 && rateValue <= 100) {
    setPreference('device_settings', 'sendRate', rateValue);
    if (spaceMiceManager) spaceMiceManager.options.sendRate = rateValue;
    if (mainWindow && mainWindow.webContents) mainWindow.webContents.send("sendRate", rateValue);
  }
}

function handleIndex(args) {
  const indexValue = Number(args[0].value);
  log.info(`[OSC IN] index → ${indexValue}`);
  setPreference('device_settings', 'index', indexValue);
  if (spaceMiceManager) spaceMiceManager.options.index = indexValue;
  if (mainWindow && mainWindow.webContents) mainWindow.webContents.send("index", indexValue);
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
  "/index": handleIndex,
  "/precision": handlePrecision,
  "/factor": handleFactor,
  "/sendRate": handleSendRate,
};
