const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'electron',
    {
        ipcRenderer: {
            send: (channel, data) => {
                // Whitelist channels
                const validChannels = [
                    'mode-change',
                    'sendRate',
                    'sendRate-change',
                    'show-preferences',
                    'button-pressed',
                    'button-released',
                    'ok_to_send',
                    'sendOscServerIp',
                    'sendOscServerPort',
                    'matchingIpPort',
                    'notMatchingIpPort',
                    'prefix-change',
                    'index-change',
                    'precision-change',
                    'factor-change',
                    'spacemouse-data-with-paths',
                    'bypass-button-pressed',
                    'log-info',
                    'log-error',
                    'log-warn',
                    'log-debug',
                    'update-osc-paths'
                ];
                if (validChannels.includes(channel)) {
                    ipcRenderer.send(channel, data);
                } else {
                    console.warn(`Channel ${channel} is not whitelisted`);
                }
            },
            on: (channel, func) => {
                const validChannels = [
                    'spacemouse-data',
                    'spacemouse-button',
                    'bypass-state-changed',
                    'logInfo',
                    'oServerOK',
                    'prefix',
                    'precision',
                    'factor',
                    'sendRate',
                    'index',
                    'preferences-updated',
                    'log-message',
                    'log-info',
                    'log-error',
                    'log-warn',
                    'log-debug',
                    'update-osc-paths'
                ];
                if (validChannels.includes(channel)) {
                    // Strip event and properly forward the data
                    ipcRenderer.on(channel, (_, data) => {
                        try {
                            // Validate bypass state data
                            if (channel === 'bypass-state-changed') {
                                if (!data || typeof data.id !== 'number' || typeof data.state !== 'boolean') {
                                    console.warn('Invalid bypass state data:', data);
                                    return;
                                }
                            }
                            func(data);
                        } catch (error) {
                            console.error(`Error handling ${channel} event:`, error);
                        }
                    });
                } else {
                    console.warn(`Channel ${channel} is not whitelisted for receiving`);
                }
            },
            invoke: async (channel, data) => {
                const validChannels = ['getPreferences'];
                if (validChannels.includes(channel)) {
                    return await ipcRenderer.invoke(channel, data);
                }
                console.warn(`Channel ${channel} is not whitelisted for invoke`);
                return null;
            }
        },
        log: {
            info: (...args) => {
                const message = args.join(' ');
                console.log(message);
                const logEntry = {
                    level: 'info',
                    message: message,
                    timestamp: new Date().toISOString()
                };
                ipcRenderer.send('log-message', logEntry);
            },
            error: (...args) => {
                const message = args.join(' ');
                console.error(message);
                const logEntry = {
                    level: 'error',
                    message: message,
                    timestamp: new Date().toISOString()
                };
                ipcRenderer.send('log-message', logEntry);
            },
            warn: (...args) => {
                const message = args.join(' ');
                console.warn(message);
                const logEntry = {
                    level: 'warn',
                    message: message,
                    timestamp: new Date().toISOString()
                };
                ipcRenderer.send('log-message', logEntry);
            },
            debug: (...args) => {
                const message = args.join(' ');
                console.debug(message);
                const logEntry = {
                    level: 'debug',
                    message: message,
                    timestamp: new Date().toISOString()
                };
                ipcRenderer.send('log-message', logEntry);
            }
        }
    }
);
