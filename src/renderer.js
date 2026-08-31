const { ipcRenderer, log } = window.electron;

// Fallback: Enable conventional mouse as input if user approves
let mouseFallbackActive = false;

// Overlay toggle state
let overlayActive = false;
window.addEventListener('keydown', async (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyO') {
        e.preventDefault();
        overlayActive = !overlayActive;
        if (overlayActive) {
            // Get screen size from main
            let width = 1920, height = 1080;
            try {
                const sz = await ipcRenderer.invoke('get-screen-size');
                width = sz.width; height = sz.height;
            } catch {}
            ipcRenderer.send('show-overlay', { width, height });
        } else {
            ipcRenderer.send('hide-overlay');
        }
    }
});


ipcRenderer.on('enable-mouse-fallback', () => {
    if (!mouseFallbackActive) {
        mouseFallbackActive = true;
        log.info('Mouse fallback mode enabled.');
        log.info('UserAgent:', navigator.userAgent);
        if (navigator.platform) log.info('Platform:', navigator.platform);
        if (navigator.hardwareConcurrency) log.info('CPUs:', navigator.hardwareConcurrency);
        // Make translation fields visible for fallback mode
        ['at_tr_x', 'at_tr_y', 'at_tr_z'].forEach(id => {
            const field = document.getElementById(id);
            if (field) {
                const cell = field.closest('.at');
                if (cell) cell.style.visibility = 'visible';
            }
        });
        updateOSCPaths();
        ipcRenderer.send('enable-mouse-fallback'); // Request global fallback in main process

        // Open Preferences window (fallback mapping section will need to be selected by user)
        ipcRenderer.send('show-preferences');

        // Add mousemove event to send fallback data (in-app only)
        window.addEventListener('mousemove', (e) => {
            if (!mouseFallbackActive) return;
            // Map mouse X/Y to screen
            const x = e.clientX;
            const y = e.clientY;
            // Z is always 0 in fallback mode
            ipcRenderer.send('spacemouse-data', {
                translation: { x, y, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                buttons: [false, false],
                source: 'conventional-mouse'
            });
        });
        const modal = document.getElementById('fallback-mapping-modal');
        if (modal) {
            // Request preferences and screen size, then prefill modal fields
            Promise.all([
                ipcRenderer.invoke('getPreferences'),
                ipcRenderer.invoke('get-screen-size')
            ]).then(([prefs, screen]) => {
                let fm = (prefs && prefs.fallback_mapping) ? prefs.fallback_mapping : {};
                let width = screen.width || 1920;
                let height = screen.height || 1080;
                document.getElementById('fallback-center-x').value = (fm.centerX !== undefined) ? fm.centerX : 0;
                document.getElementById('fallback-center-y').value = (fm.centerY !== undefined) ? fm.centerY : 0;
                document.getElementById('fallback-x-min').value = (fm.xMin !== undefined) ? fm.xMin : -Math.floor(width/2);
                document.getElementById('fallback-x-max').value = (fm.xMax !== undefined) ? fm.xMax : Math.floor(width/2);
                document.getElementById('fallback-y-min').value = (fm.yMin !== undefined) ? fm.yMin : -Math.floor(height/2);
                document.getElementById('fallback-y-max').value = (fm.yMax !== undefined) ? fm.yMax : Math.floor(height/2);
                modal.style.display = 'block';
            }).catch(() => {
                // fallback to 1920x1080 if IPC fails
                document.getElementById('fallback-center-x').value = 0;
                document.getElementById('fallback-center-y').value = 0;
                document.getElementById('fallback-x-min').value = -960;
                document.getElementById('fallback-x-max').value = 960;
                document.getElementById('fallback-y-min').value = -540;
                document.getElementById('fallback-y-max').value = 540;
                modal.style.display = 'block';
            });

            // Modal logic
            const form = document.getElementById('fallback-mapping-form');
            const cancelBtn = document.getElementById('fallback-mapping-cancel');
            const saveBtn = document.getElementById('fallback-mapping-save');
            // Remove previous listeners if any
            form.onsubmit = null;
            cancelBtn.onclick = null;
            // Save handler
            form.onsubmit = function(e) {
                e.preventDefault();
                const settings = {
                    centerX: Number(document.getElementById('fallback-center-x').value),
                    centerY: Number(document.getElementById('fallback-center-y').value),
                    xMin: Number(document.getElementById('fallback-x-min').value),
                    xMax: Number(document.getElementById('fallback-x-max').value),
                    yMin: Number(document.getElementById('fallback-y-min').value),
                    yMax: Number(document.getElementById('fallback-y-max').value)
                };
                // Two-way sync: update Preferences fallback_mapping section as well
                ipcRenderer.invoke('getPreferences').then((prefs) => {
                    prefs = prefs || {};
                    prefs.fallback_mapping = { ...prefs.fallback_mapping, ...settings };
                    ipcRenderer.send('savePreferences', prefs);
                    // Also send to main for live update
                    ipcRenderer.send('fallback-mapping-settings', settings);
                    modal.style.display = 'none';
                }).catch(() => {
                    // Fallback: just send to main if Preferences fetch fails
                    ipcRenderer.send('fallback-mapping-settings', settings);
                    modal.style.display = 'none';
                });
            };
            // Cancel handler
            cancelBtn.onclick = function() {
                modal.style.display = 'none';
            };
        }
    }
});

// Listen for global fallback mouse updates from main process
ipcRenderer.on('fallback-mouse-update', (data) => {
    if (typeof data.mouseX === 'number') {
        const xField = document.getElementById('at_tr_x');
        if (xField) xField.value = data.mouseX.toFixed(1);
    }
    if (typeof data.mouseY === 'number') {
        const yField = document.getElementById('at_tr_y');
        if (yField) yField.value = data.mouseY.toFixed(1);
    }
    // Optionally show mapped OSC values as well (oscX/oscY)
    if (typeof data.oscX === 'number') {
        const oscXField = document.getElementById('osc_tr_x');
        if (oscXField) oscXField.value = data.oscX.toFixed(2);
    }
    if (typeof data.oscY === 'number') {
        const oscYField = document.getElementById('osc_tr_y');
        if (oscYField) oscYField.value = data.oscY.toFixed(2);
    }
});

// Local enableMouseFallback is now obsolete; global fallback is handled by main process/iohook.
// function enableMouseFallback() {
//     // Make translation fields visible for fallback mode
//     ['at_tr_x', 'at_tr_y', 'at_tr_z'].forEach(id => {
//         const field = document.getElementById(id);
//         if (field) {
//             const cell = field.closest('.at');
//             if (cell) cell.style.visibility = 'visible';
//         }
//     });
//     updateOSCPaths();
//     // All mouse event listeners removed. Global fallback now handled in main process.
// }

// State management for bypass buttons
let bypassStates = {
    'byp0': false,
    'byp1': false,
    'byp2': false,
    'byp3': false,
    'byp4': false,
    'byp5': false,
    'byp6': false
};

// Map bypass buttons to input fields (global)
const inputFieldMap = {
    1: 'at_tr_x',
    2: 'at_tr_y',
    3: 'at_tr_z',
    4: 'at_rt_x',
    5: 'at_rt_y',
    6: 'at_rt_z'
};

// Helper function to update image cell border
function updateImageCellBorder(fieldId, visible) {
    let imgCellId = '';
    
    // Map field IDs to image cell IDs
    if (fieldId.includes('tr_x')) imgCellId = 'tr_x_cell';
    else if (fieldId.includes('tr_y')) imgCellId = 'tr_y_cell';
    else if (fieldId.includes('tr_z')) imgCellId = 'tr_z_cell';
    else if (fieldId.includes('rt_x')) imgCellId = 'rt_x_cell';
    else if (fieldId.includes('rt_y')) imgCellId = 'rt_y_cell';
    else if (fieldId.includes('rt_z')) imgCellId = 'rt_z_cell';
    
    if (imgCellId) {
        const imgCell = document.getElementById(imgCellId);
        if (imgCell) {
            imgCell.classList.remove('enabled', 'disabled');
            imgCell.classList.add(visible ? 'enabled' : 'disabled');
        }
    }
}

// Initialize border colors based on initial bypass states
function initializeBorderColors() {
    // Get all field IDs
    const fieldIds = [
        'at_tr_x', 'at_tr_y', 'at_tr_z',
        'at_rt_x', 'at_rt_y', 'at_rt_z'
    ];

    // Update border colors based on field visibility
    fieldIds.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            const container = field.closest('.at');
            if (container) {
                const isVisible = container.style.visibility !== 'hidden';
                updateImageCellBorder(fieldId, isVisible);
            }
        }
    });
}

// Helper function to set visibility and update cell border
const setFieldVisibility = (field, visible) => {
    if (field) {
        const container = field.closest('.at');
        if (container) {
            container.style.visibility = visible ? 'visible' : 'hidden';
            updateImageCellBorder(field.id, visible);
        }
    }
};

// Function to update OSC paths
function updateOSCPaths() {
    const paths = getOSCPaths();
    ipcRenderer.send('update-osc-paths', paths);
}

// Get OSC paths from at_ fields
function getOSCPaths() {
    try {
        const indexField = document.getElementById('index');
        const prefix = document.getElementById('prefix').value || '/track';
        const useIndex = indexField && indexField.style.visibility !== 'hidden';
        const index = useIndex ? indexField.value || '1' : '';

        // Helper function to format path
        const formatPath = (fieldValue) => {
            // Remove any leading slashes from field value to prevent double slashes
            const cleanFieldValue = fieldValue.startsWith('/') ? fieldValue.substring(1) : fieldValue;
            
            // Make sure prefix has exactly one trailing slash
            const cleanPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;

            if (useIndex) {
                return `${cleanPrefix}/${index}/${cleanFieldValue}`;
            }
            return `${cleanPrefix}/${cleanFieldValue}`;
        };

        const paths = {
            translation: {},
            rotation: {}
        };

        // Map translation fields
        const trFields = {
            'at_tr_x': ['x', 'tr/x'],
            'at_tr_y': ['y', 'tr/y'],
            'at_tr_z': ['z', 'tr/z']
        };

        // Map rotation fields
        const rtFields = {
            'at_rt_x': ['x', 'rt/x'],
            'at_rt_y': ['y', 'rt/y'],
            'at_rt_z': ['z', 'rt/z']
        };

        // Add translation paths if fields are visible
        Object.entries(trFields).forEach(([fieldId, [axis, defaultPath]]) => {
            const field = document.getElementById(fieldId);
            const cell = field?.closest('.at');
            if (field && cell && cell.style.visibility !== 'hidden') {
                paths.translation[axis] = formatPath(field.value || defaultPath);
            }
        });

        // Add rotation paths if fields are visible
        Object.entries(rtFields).forEach(([fieldId, [axis, defaultPath]]) => {
            const field = document.getElementById(fieldId);
            const cell = field?.closest('.at');
            if (field && cell && cell.style.visibility !== 'hidden') {
                paths.rotation[axis] = formatPath(field.value || defaultPath);
            }
        });

        // Ensure we have at least one path
        if (Object.keys(paths.translation).length === 0 && Object.keys(paths.rotation).length === 0) {
            console.warn('No visible fields found for OSC paths');
            // Add default paths
            paths.translation = {
                x: formatPath('tr/x'),
                y: formatPath('tr/y'),
                z: formatPath('tr/z')
            };
            paths.rotation = {
                x: formatPath('rt/x'),
                y: formatPath('rt/y'),
                z: formatPath('rt/z')
            };
        }

        return paths;
    } catch (error) {
        console.error('Error getting OSC paths:', error);
        // Return default paths
        return {
            translation: {
                x: '/track/tr/x',
                y: '/track/tr/y',
                z: '/track/tr/z'
            },
            rotation: {
                x: '/track/rt/x',
                y: '/track/rt/y',
                z: '/track/rt/z'
            }
        };
    }
}

// Initialize bypass buttons and field visibility states
const initializeStates = () => {
    // Initialize index field cell
    const indexCell = document.getElementById('index-cell');
    const indexField = document.getElementById('index');
    if (indexCell && indexField) {
        const isVisible = indexField.style.visibility !== 'hidden';
        indexCell.classList.toggle('enabled', isVisible);
        indexCell.classList.toggle('disabled', !isVisible);
        bypassStates['byp0'] = isVisible;

        // Add click handler for index cell
        indexCell.addEventListener('click', (event) => {
            // Only handle clicks directly on the cell, not on the input
            if (event.target === indexCell || event.target.tagName !== 'INPUT') {
                const newVisible = indexField.style.visibility === 'hidden';
                indexField.style.visibility = newVisible ? 'visible' : 'hidden';
                indexCell.classList.toggle('enabled', newVisible);
                indexCell.classList.toggle('disabled', !newVisible);
                bypassStates['byp0'] = newVisible;
                ipcRenderer.send('bypass-button-pressed', { id: 0, state: newVisible });
                updateOSCPaths();
            }
        });
    }

    // Initialize image cell click handlers
    const imgCells = document.querySelectorAll('.img-cell[data-byp]');
    imgCells.forEach(cell => {
        const bypId = cell.getAttribute('data-byp');
        const fieldId = inputFieldMap[bypId];
        const field = document.getElementById(fieldId);
        
        if (field) {
            const parentCell = field.closest('.at');
            if (parentCell) {
                const isVisible = parentCell.style.visibility !== 'hidden';
                cell.classList.toggle('enabled', isVisible);
                cell.classList.toggle('disabled', !isVisible);
                bypassStates[`byp${bypId}`] = !isVisible;

                // Add click handler
                cell.addEventListener('click', () => {
                    const newVisible = parentCell.style.visibility === 'hidden';
                    parentCell.style.visibility = newVisible ? 'visible' : 'hidden';
                    cell.classList.toggle('enabled', newVisible);
                    cell.classList.toggle('disabled', !newVisible);
                    bypassStates[`byp${bypId}`] = !newVisible;
                    updateImageCellBorder(fieldId, newVisible);
                    ipcRenderer.send('bypass-button-pressed', { id: parseInt(bypId), state: !newVisible });
                    updateOSCPaths();
                });
            }
        }
    });
};

// Listen for bypass state changes from main process
ipcRenderer.on('bypass-state-changed', (data) => {
    if (data && typeof data.id === 'number' && typeof data.state === 'boolean') {
        const buttonId = `byp${data.id}`;
        bypassStates[buttonId] = data.state;

        // Get the corresponding input field
        const fieldId = inputFieldMap[data.id];
        if (fieldId) {
            const field = document.getElementById(fieldId);
            setFieldVisibility(field, !data.state);
            updateOSCPaths();
        }
    }
});

// Call initialization when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    log.info('DOM fully loaded');
    initializeStates();
    setupEventListeners();
    loadInitialPreferences();
    initializeBorderColors();
});

// Listen for preference updates from main process
ipcRenderer.on('preferences-updated', (event, preferences) => {
    log.info('Preferences updated, syncing UI');
    if (preferences && preferences.device_settings) {
        updateUIFromPreferences(preferences.device_settings);
    }
    // --- Unify fallback mapping with Preferences as source of truth ---
    if (preferences && preferences.fallback_mapping) {
        ipcRenderer.send('fallback-mapping-settings', preferences.fallback_mapping);
    }
});

function updateUIFromPreferences(settings) {
    // Update UI elements with preference values
    const elements = {
        'mode': settings.mode || 'aed',
        'prefix': settings.prefix || '/track',
        'index': settings.index || 1,
        'precision': settings.precision || 'clear',
        'factor': settings.factor || 1,
        'sendRate': settings.sendRate !== undefined ? Number(settings.sendRate) : 33
    };

    // Update each element if it exists
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            if (element.type === 'number') {
                element.value = Number(value);
            } else {
                element.value = value;
            }
            log.info(`Updated ${id} to ${value}`);
        }
    });
}

async function loadInitialPreferences() {
    try {
        const preferences = await ipcRenderer.invoke('getPreferences');
        if (preferences && preferences.device_settings) {
            updateUIFromPreferences(preferences.device_settings);
        }
    } catch (error) {
        log.error('Error loading preferences:', error);
    }
}

function setupEventListeners() {
    // Mode selection
    const modeSelect = document.getElementById('mode');
    if (modeSelect) {
        modeSelect.addEventListener('change', (event) => {
            const mode = event.target.value;
            log.info('Mode changed:', mode);
            ipcRenderer.send('mode-change', mode);

            // Get all relevant fields
            const trFields = {
                x: document.getElementById('at_tr_x'),
                y: document.getElementById('at_tr_y'),
                z: document.getElementById('at_tr_z')
            };
            const rtFields = {
                x: document.getElementById('at_rt_x'),
                y: document.getElementById('at_rt_y'),
                z: document.getElementById('at_rt_z')
            };

            // Set visibility based on mode
            switch (mode) {
                case 'xy':
                    // XY mode - show only X and Y translation fields
                    setFieldVisibility(trFields.x, true);
                    setFieldVisibility(trFields.y, true);
                    setFieldVisibility(trFields.z, false);
                    setFieldVisibility(rtFields.x, false);
                    setFieldVisibility(rtFields.y, false);
                    setFieldVisibility(rtFields.z, false);
                    break;
                case 'ae':
                    // AE mode - show only X and Y rotation fields
                    setFieldVisibility(trFields.x, false);
                    setFieldVisibility(trFields.y, false);
                    setFieldVisibility(trFields.z, false);
                    setFieldVisibility(rtFields.x, true);
                    setFieldVisibility(rtFields.y, true);
                    setFieldVisibility(rtFields.z, false);
                    break;
                case 'xyz':
                    // XYZ mode - show all translation fields
                    setFieldVisibility(trFields.x, true);
                    setFieldVisibility(trFields.y, true);
                    setFieldVisibility(trFields.z, true);
                    setFieldVisibility(rtFields.x, false);
                    setFieldVisibility(rtFields.y, false);
                    setFieldVisibility(rtFields.z, false);
                    break;
                case 'aed':
                    // AED mode - show all rotation fields
                    setFieldVisibility(trFields.x, false);
                    setFieldVisibility(trFields.y, false);
                    setFieldVisibility(trFields.z, false);
                    setFieldVisibility(rtFields.x, true);
                    setFieldVisibility(rtFields.y, true);
                    setFieldVisibility(rtFields.z, true);
                    break;
                default:
                    // Default to showing all fields
                    setFieldVisibility(trFields.x, true);
                    setFieldVisibility(trFields.y, true);
                    setFieldVisibility(trFields.z, true);
                    setFieldVisibility(rtFields.x, true);
                    setFieldVisibility(rtFields.y, true);
                    setFieldVisibility(rtFields.z, true);
            }

            // Update bypass button states based on field visibility
            const updateBypassButton = (buttonId, fieldId) => {
                const button = document.getElementById(buttonId);
                const field = document.getElementById(fieldId);
                if (button && field) {
                    const container = field.closest('.at');
                    if (container) {
                        const isVisible = container.style.visibility === 'visible';
                        button.classList.toggle('active', !isVisible);
                        bypassStates[buttonId] = !isVisible;
                        // Notify main process of bypass state change
                        const id = parseInt(buttonId.replace('byp', ''));
                        if (!isNaN(id)) {
                            ipcRenderer.send('bypass-button-pressed', { id, state: !isVisible });
                        }
                    }
                }
            };

            // Update all bypass buttons
            updateBypassButton('byp1', 'at_tr_x');
            updateBypassButton('byp2', 'at_tr_y');
            updateBypassButton('byp3', 'at_tr_z');
            updateBypassButton('byp4', 'at_rt_x');
            updateBypassButton('byp5', 'at_rt_y');
            updateBypassButton('byp6', 'at_rt_z');

            // Update OSC paths after changing visibility
            const paths = getOSCPaths();
            ipcRenderer.send('spacemouse-data-with-paths', {
                translation: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                paths: paths
            });
        });
    }

    // Input fields
    const inputFields = {
        'prefix': (value) => ipcRenderer.send('prefix-change', value),
        'index': (value) => ipcRenderer.send('index-change', parseInt(value)),
        'precision': (value) => ipcRenderer.send('precision-change', value),
        'factor': (value) => ipcRenderer.send('factor-change', parseFloat(value)),
        'sendRate': (value) => ipcRenderer.send('sendRate-change', parseInt(value))
    };

    Object.entries(inputFields).forEach(([id, handler]) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', (event) => {
                const value = event.target.value;
                log.info(`${id} changed:`, value);
                handler(value);
                // Prefix/index are part of the formatted OSC address, so refresh
                // the paths used for OSC sending whenever they change.
                if (id === 'prefix' || id === 'index') {
                    updateOSCPaths();
                }
            });
        }
    });

    // OSC address suffix fields (e.g. "/x++"). Keep the paths used for OSC
    // sending in sync as the user edits them; otherwise the previously
    // applied path keeps being sent until some other action (mode/bypass
    // change) happens to trigger a refresh.
    ['at_tr_x', 'at_tr_y', 'at_tr_z', 'at_rt_x', 'at_rt_y', 'at_rt_z'].forEach((id) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', updateOSCPaths);
        }
    });

    // Handle SpaceMouse data
    ipcRenderer.on('spacemouse-data', (data) => {
        try {
            if (!data || typeof data !== 'object') {
                console.warn('Invalid SpaceMouse data:', data);
                return;
            }

            // Get OSC paths
            const paths = getOSCPaths();
            
            // Create the complete data structure with defaults
            const completeData = {
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
                paths: paths
            };

            // Log data occasionally for debugging
            if (Math.random() < 0.001) {
                console.log('Sending SpaceMouse data:', completeData);
            }

            // Send the complete data structure to main process
            ipcRenderer.send('spacemouse-data-with-paths', completeData);
        } catch (error) {
            console.error('Error handling SpaceMouse data:', error);
        }
    });

    // Handle SpaceMouse button events
    ipcRenderer.on('spacemouse-button', (event, { button, state }) => {
        // Handle SpaceMouse button events without affecting bypass states
        log.info('SpaceMouse button event:', { button, state });
    });

    // Logs visibility toggle
    const viewLogsButton = document.getElementById('viewlogs');
    const loggingElement = document.getElementById('logging');
    
    if (viewLogsButton && loggingElement) {
        viewLogsButton.addEventListener('click', () => {
            // Toggle display instead of visibility for better behavior
            const isVisible = loggingElement.style.display !== 'none';
            loggingElement.style.display = isVisible ? 'none' : 'block';
            viewLogsButton.textContent = isVisible ? '►' : '▼';  
            log.info(`Logs visibility set to: ${!isVisible}`);
        });

        // Set initial state
        loggingElement.style.display = 'none';
        viewLogsButton.textContent = '►';  
    }

    // Clear logs
    const clearLogButton = document.getElementById('clearLog');
    const loggingDiv = document.getElementById('logging');
    if (clearLogButton && loggingDiv) {
        clearLogButton.addEventListener('click', () => {
            // Keep the anchor div but clear everything else
            const anchor = document.getElementById('anchor');
            loggingDiv.innerHTML = '';
            if (anchor) {
                loggingDiv.appendChild(anchor);
            }
            log.info('Logs cleared');
        });
    }

    // Preferences button
    const preferencesButton = document.getElementById('preferences-button');
    if (preferencesButton) {
        preferencesButton.addEventListener('click', () => {
            log.info('Opening preferences');
            ipcRenderer.send('show-preferences');
        });
    }

    // Add log message handler
    ipcRenderer.on('log-message', (logEntry) => {
        const logging = document.getElementById('logging');
        const anchor = document.getElementById('anchor');
        if (!logging || !anchor) return;

        // Format the log message
        let formattedMessage = logEntry.message;
        if (typeof logEntry.message === 'object') {
            formattedMessage = JSON.stringify(logEntry.message, null, 2);
        }

        // Create log element with proper timestamp
        const logElement = document.createElement('div');
        logElement.className = `log-entry log-${logEntry.level}`;
        
        // Format timestamp
        const timestamp = logEntry.timestamp ? new Date(logEntry.timestamp) : new Date();
        const timeStr = timestamp.toLocaleTimeString();
        
        logElement.textContent = `${timeStr} - ${formattedMessage}`;
        
        // Insert at the top (after anchor)
        if (logging.firstChild) {
            logging.insertBefore(logElement, logging.firstChild);
        } else {
            logging.appendChild(logElement);
        }
        
        // Limit number of log entries to prevent memory issues
        const maxLogs = 100;
        while (logging.children.length > maxLogs) {
            logging.removeChild(logging.lastChild);
        }
    });

    // Set up IPC listeners for spacemouse data
    ipcRenderer.on('spacemouse-data', (data) => {
        try {
            if (!data || !data.translation || !data.rotation) {
                log.warn('Received invalid spacemouse data');
                return;
            }

            // Update translation values
            const translationElements = {
                'translation-x': data.translation.x,
                'translation-y': data.translation.y,
                'translation-z': data.translation.z
            };

            // Update rotation values
            const rotationElements = {
                'rotation-x': data.rotation.x,
                'rotation-y': data.rotation.y,
                'rotation-z': data.rotation.z
            };

            // Update all values in the UI
            Object.entries(translationElements).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = value.toFixed(6);
                }
            });

            Object.entries(rotationElements).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = value.toFixed(6);
                }
            });

            // Get OSC paths and send them with the data
            const oscPaths = getOSCPaths();
            ipcRenderer.send('spacemouse-data-with-paths', { data, paths: oscPaths });

            // Handle button states if present
            if (data.buttons && Array.isArray(data.buttons)) {
                data.buttons.forEach((state, index) => {
                    const buttonId = `byp${index}`;
                    const button = document.getElementById(buttonId);
                    if (button && bypassStates[buttonId] !== state) {
                        bypassStates[buttonId] = state;
                        button.classList.toggle('button_down', state);
                        button.classList.toggle('button_up', !state);
                    }
                });
            }
        } catch (error) {
            log.error('Error handling spacemouse data:', error);
        }
    });
}
