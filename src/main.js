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
        },
        fallback_mapping: {
            centerX: 0,
            centerY: 0,
            xMin: -960,
            xMax: 960,
            yMin: -540,
            yMax: 540
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
        },
        {
            id: 'fallback_mapping',
            label: 'Fallback Mapping Settings',
            icon: 'mouse',
            form: {
                groups: [
                    {
                        label: 'Fallback Mapping',
                        fields: [
                            {
                                label: 'Center X',
                                key: 'centerX',
                                type: 'number',
                                help: 'Center X coordinate',
                                default: 0,
                                min: -10000,
                                max: 10000,
                                step: 1
                            },
                            {
                                label: 'Center Y',
                                key: 'centerY',
                                type: 'number',
                                help: 'Center Y coordinate',
                                default: 0,
                                min: -10000,
                                max: 10000,
                                step: 1
                            },
                            {
                                label: 'X Min',
                                key: 'xMin',
                                type: 'number',
                                help: 'Minimum X coordinate',
                                default: -960,
                                min: -10000,
                                max: 10000,
                                step: 1
                            },
                            {
                                label: 'X Max',
                                key: 'xMax',
                                type: 'number',
                                help: 'Maximum X coordinate',
                                default: 960,
                                min: -10000,
                                max: 10000,
                                step: 1
                            },
                            {
                                label: 'Y Min',
                                key: 'yMin',
                                type: 'number',
                                help: 'Minimum Y coordinate',
                                default: -540,
                                min: -10000,
                                max: 10000,
                                step: 1
                            },
                            {
                                label: 'Y Max',
                                key: 'yMax',
                                type: 'number',
                                help: 'Maximum Y coordinate',
                                default: 540,
                                min: -10000,
                                max: 10000,
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
    // --- Unify fallback mapping with Preferences as source of truth ---
    if (preferences.fallback_mapping) {
        // Send to main process fallback logic for live update
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('fallback-mapping-settings', preferences.fallback_mapping);
        }
    }
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
    
    // Apply fallback mapping settings
    if (preferences.fallback_mapping) {
        fallbackMappingSettings = preferences.fallback_mapping;
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

// --- GLOBAL MOUSE FALLBACK WITH ROBOTJS ---
let robotjs = null;
let robotjsInterval = null;
let robotjsLastPos = { x: 0, y: 0 };

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

// Fallback mapping settings (defaults)
let fallbackMappingSettings = {
    centerX: 960,
    centerY: 540,
    xMin: 0,
    xMax: 1920,
    yMin: 0,
    yMax: 1080,
    zMin: -1,
    zMax: 1
};

// On startup, initialize fallbackMappingSettings from Preferences if available
app.whenReady().then(() => {
    try {
        const userPrefs = preferences.preferences && preferences.preferences.fallback_mapping;
        if (userPrefs) {
            // Coerce all values to numbers and log any bad values
            for (const key of Object.keys(fallbackMappingSettings)) {
                if (userPrefs[key] !== undefined) {
                    const n = Number(userPrefs[key]);
                    if (isNaN(n)) {
                        log.warn(`[INIT] fallbackMappingSettings: Invalid value for ${key}:`, userPrefs[key]);
                        fallbackMappingSettings[key] = 0;
                    } else {
                        fallbackMappingSettings[key] = n;
                    }
                }
            }
            log.info('[INIT] fallbackMappingSettings initialized from Preferences:', fallbackMappingSettings);
        }
    } catch (e) {
        log.warn('Could not initialize fallbackMappingSettings from Preferences:', e);
    }
});



function startGlobalMouseFallback() {
    if (robotjsInterval) return;
    try {
        robotjs = require('robotjs');
    } catch (err) {
        log.error('Failed to load robotjs for global mouse fallback:', err);
        return;
    }
    robotjsLastPos = robotjs.getMousePos();
    log.info('[DEBUG] Initial global mouse position:', robotjsLastPos);

    // Dynamically detect screen size
    const { screen } = require('electron');
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    const screenCenterX = screenWidth / 2;
    const screenCenterY = screenHeight / 2;

    // If fallbackMappingSettings are still defaults, set to centered system
    if (
        fallbackMappingSettings.centerX === 960 &&
        fallbackMappingSettings.centerY === 540 &&
        fallbackMappingSettings.xMin === 0 &&
        fallbackMappingSettings.xMax === 1920 &&
        fallbackMappingSettings.yMin === 0 &&
        fallbackMappingSettings.yMax === 1080
    ) {
        fallbackMappingSettings = {
            centerX: 0,
            centerY: 0,
            xMin: -Math.floor(screenWidth/2),
            xMax: Math.floor(screenWidth/2),
            yMin: -Math.floor(screenHeight/2),
            yMax: Math.floor(screenHeight/2)
        };
    }

robotjsInterval = setInterval(() => {
    const pos = robotjs.getMousePos();
    // Use user-configured mapping
    const {
        centerX, centerY, xMin, xMax, yMin, yMax
    } = fallbackMappingSettings;

    // If mapping is symmetric around zero and center is zero, map directly
    // Properly normalize to user-specified min/max and screen size
    // mappedX: [0, screenWidth] -> [xMin, xMax]
    // mappedY: [0, screenHeight] -> [yMin, yMax]
    // Map [0, screenWidth] to [xMin, xMax] and add centerX as offset
    let mappedX = xMin + ((pos.x / screenWidth) * (xMax - xMin)) + centerX;
    let mappedY = yMin + ((pos.y / screenHeight) * (yMax - yMin)) + centerY;
    // Z is always 0 in fallback
    const mappedZ = 0;

    // Defensive: ensure mappedX, mappedY, mappedZ are numbers before toFixed
    const safeMappedX = (typeof mappedX === 'number' && isFinite(mappedX)) ? mappedX : 0;
    const safeMappedY = (typeof mappedY === 'number' && isFinite(mappedY)) ? mappedY : 0;
    const safeMappedZ = (typeof mappedZ === 'number' && isFinite(mappedZ)) ? mappedZ : 0;
    log.debug(`[DEBUG] Polling tick: abs=(${pos.x},${pos.y}), mapped=(${safeMappedX.toFixed(3)},${safeMappedY.toFixed(3)},${safeMappedZ.toFixed(3)})`);
    const data = {
        translation: { x: mappedX, y: mappedY, z: mappedZ },
        rotation: { x: 0, y: 0, z: 0 },
        buttons: [false, false],
        source: 'conventional-mouse-global'
    };
    // Send overlay data if overlay is active
    sendOverlayData({
        xMin: fallbackMappingSettings.xMin,
        xMax: fallbackMappingSettings.xMax,
        yMin: fallbackMappingSettings.yMin,
        yMax: fallbackMappingSettings.yMax,
        centerX: fallbackMappingSettings.centerX,
        centerY: fallbackMappingSettings.centerY,
        mouseX: pos.x,
        mouseY: pos.y,
        oscX: mappedX,
        oscY: mappedY,
        screenWidth,
        screenHeight
    });

    // Forward global mouse position and mapped values to renderer for UI update
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('fallback-mouse-update', {
            mouseX: pos.x,
            mouseY: pos.y,
            oscX: mappedX,
            oscY: mappedY
        });
    }
    log.info('[DEBUG] Calling handleFallbackMouseData with:', data);
    handleFallbackMouseData(data);
}, 20); // 50Hz polling

    log.info('Global mouse fallback (robotjs) started.');
}

function stopGlobalMouseFallback() {
    if (robotjsInterval) {
        clearInterval(robotjsInterval);
        robotjsInterval = null;
        log.info('Global mouse fallback (robotjs) stopped.');
    }
}

function stopGlobalMouseFallback() {
    if (!iohookActive || !iohook) return;
    iohook.removeAllListeners('mousemove');
    iohook.removeAllListeners('mousedown');
    iohook.removeAllListeners('mouseup');
    iohook.removeAllListeners('mousewheel');
    iohook.stop();
    iohookActive = false;
    log.info('Global mouse fallback (iohook) stopped.');
}

// Call this when fallback is enabled by user
ipcMain.on('enable-mouse-fallback', () => {
    startGlobalMouseFallback();
});
// Optionally, listen for a disable event:
ipcMain.on('disable-mouse-fallback', () => {
    stopGlobalMouseFallback();
});

// Handle live update of fallback mapping settings from Preferences or modal
ipcMain.on('fallback-mapping-settings', (event, settings) => {
    // Coerce and validate all values
    for (const key of Object.keys(fallbackMappingSettings)) {
        if (settings[key] !== undefined) {
            const n = Number(settings[key]);
            fallbackMappingSettings[key] = isNaN(n) ? 0 : n;
        }
    }
    log.info('[LIVE] fallbackMappingSettings updated via IPC:', fallbackMappingSettings);
    // If overlay is active, send new overlay data immediately
    if (overlayWindow && overlayWindow.webContents) {
        const screenWidth = overlayWindow.getBounds().width;
        const screenHeight = overlayWindow.getBounds().height;
        let mouseX = 0, mouseY = 0;
        try {
            if (robotjs) {
                const pos = robotjs.getMousePos();
                mouseX = pos.x;
                mouseY = pos.y;
            }
        } catch {}
        sendOverlayData({
            xMin: fallbackMappingSettings.xMin,
            xMax: fallbackMappingSettings.xMax,
            yMin: fallbackMappingSettings.yMin,
            yMax: fallbackMappingSettings.yMax,
            centerX: fallbackMappingSettings.centerX,
            centerY: fallbackMappingSettings.centerY,
            mouseX,
            mouseY,
            oscX: 0, // Will update on next poll
            oscY: 0,
            screenWidth,
            screenHeight
        });
    }
});

// Unified handler for fallback mouse data (renderer or global)
function handleFallbackMouseData(data) {
    try {
        log.info('[LITE MODE] Fallback mouse event received:', data);
        // Write fallback mouse event to a debug log file
        const fs = require('fs');
        const fallbackLogPath = path.join(app.getPath('userData'), 'fallback_mouse_debug.log');
        fs.appendFileSync(fallbackLogPath, `[${new Date().toISOString()}] ${JSON.stringify(data)}\n`);
        // Format the data as expected by the rest of the app
        const formattedData = {
            translation: {
                x: data.translation?.x || 0,
                y: data.translation?.y || 0,
                z: data.translation?.z || 0
            },
            rotation: {
                x: data.rotation?.x || 0,
                y: data.rotation?.y || 0,
                z: data.rotation?.z || 0
            },
            buttons: data.buttons || []
        };
        // Send to renderer for UI update
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('spacemouse-data', formattedData);
        }
        // Send OSC messages for fallback mouse data (LITE MODE)
        const sendRate = Number(getPreference('device_settings', 'sendRate', 33));
        if (shouldSendOSCMessage(sendRate)) {
            // Format data for OSC using current paths
            const oscData = {
                translation: {
                    x: data.translation?.x || 0,
                    y: data.translation?.y || 0,
                    z: data.translation?.z || 0
                },
                rotation: {
                    x: 0, y: 0, z: 0 // fallback mouse has no rotation
                },
                paths: currentOSCPaths
            };
            try {
                const formattedData = formatDataWithParameters(oscData);
                // Send translation data
                if (formattedData.translation) {
                    log.info('[LITE MODE] OSC translation paths/values:', formattedData.translation);
                    let sentAny = false;
                    Object.entries(formattedData.translation).forEach(([path, value]) => {
                        log.debug(`[DEBUG] Attempting to send OSC for path: ${path}, value: ${value}`);
                        if (path) { // Only send if path exists (field is visible)
                            sentAny = true;
                            if (udpPort && udpPort.options && udpPort.options.remoteAddress) {
                                log.info(`[DEBUG] udpPort state:`, {
                                    remoteAddress: udpPort.options.remoteAddress,
                                    remotePort: udpPort.options.remotePort
                                });
                                udpPort.send({
                                    address: path,
                                    args: [
                                        {
                                            type: 'f',
                                            value: value
                                        }
                                    ]
                                });
                                log.info(`[LITE MODE] OSC sent: ${path} => ${value} to ${udpPort.options.remoteAddress}:${udpPort.options.remotePort}`);
                            } else {
                                log.error('[LITE MODE] Cannot send OSC: udpPort not initialized or missing remote address', {
                                    udpPort: udpPort ? {
                                        remoteAddress: udpPort.options ? udpPort.options.remoteAddress : undefined,
                                        remotePort: udpPort.options ? udpPort.options.remotePort : undefined
                                    } : null
                                });
                            }
                        }
                    });
                    if (!sentAny) {
                        log.warn('[LITE MODE] No OSC translation paths were found for fallback mouse event; check currentOSCPaths and visibility.');
                    }
                }
                // No rotation for fallback mouse, but keep structure
            } catch (err) {
                log.error('Error formatting OSC data for fallback mouse:', err);
            }
        }
    } catch (error) {
        log.error('Error handling fallback spacemouse data:', error);
    }
}

// Handle fallback mouse data from renderer (legacy, for compatibility)
ipcMain.on('spacemouse-data', (event, data) => {
    if (data.source === 'conventional-mouse' || data.source === 'conventional-mouse-global') {
        handleFallbackMouseData(data);
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
