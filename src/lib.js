const HID = require('node-hid');
const log = require('electron-log');

/**
 * Joins two 16-bit integers into a single 32-bit integer.
 * 
 * @param {number} min - The minor 16-bit integer.
 * @param {number} maj - The major 16-bit integer.
 * @returns {number} The combined 32-bit integer.
 */
function joinInt16(min, maj) {
    // Determine the sign of the major integer
    var sign = maj & (1 << 7);
    
    // Combine the minor and major integers into a single 32-bit integer
    var x = (((maj & 0xFF) << 8) | (min & 0xFF));
    
    // If the sign is negative, fill in the most significant bits with 1's
    if (sign) {
        x = 0xFFFF0000 | x;  
    }
    
    return x;
}

class SpaceMouse {
    /**
     * Constructor for the device controller.
     * @param {object} dev - The device object.
     * @param {object} options - Configuration options for the device.
     */
    constructor(dev, options = {}) {
        this.device = dev;
        this.options = {
            sensitivity: options.sensitivity || 1.0,
            deadzone: options.deadzone || 0.1,
            ...options
        };

        /**
         * Object for translation values in x, y, and z axes.
         * @type {object}
         */
        this.translate = { x: 0, y: 0, z: 0 };
        
        /**
         * Object for rotation values in x, y, and z axes.
         * @type {object}
         */
        this.rotate = { x: 0, y: 0, z: 0 };
        
        /**
         * Array to store button states.
         * @type {Array<boolean>}
         */
        this.buttons = new Array(2).fill(false);
        
        /**
         * Event handler for the data received from the device.
         * @param {function} sm - The handler function.
         */
        this.onData = sm => { };

        this._setupEventListeners();
    }

    /**
     * Set up event listeners for the device
     * @private
     */
    _setupEventListeners() {
        try {
            this.device.on('data', this._handleData.bind(this));
            this.device.on('error', this._handleError.bind(this));
        } catch (error) {
            log.error('Error setting up SpaceMouse event listeners:', error);
        }
    }

    /**
     * Handle incoming data from the device
     * @private
     */
    _handleData(data) {
        try {
            switch (data[0]) {
                case 1:
                    // Update translation values for x, y, and z axes
                    this.translate.x = this._applySettings(joinInt16(data[1], data[2]) / 350);
                    this.translate.y = this._applySettings(joinInt16(data[3], data[4]) / 350);
                    this.translate.z = this._applySettings(joinInt16(data[5], data[6]) / 350);
                    break;
                case 2:
                    // Update rotation values for x, y, and z axes
                    this.rotate.x = this._applySettings(joinInt16(data[1], data[2]) / 350);
                    this.rotate.y = this._applySettings(joinInt16(data[3], data[4]) / 350);
                    this.rotate.z = this._applySettings(joinInt16(data[5], data[6]) / 350);
                    break;
                case 3:
                    // Update button states
                    data.slice(1, 2).forEach((buttonByte, i) => { 
                        let si = Number(i);
                        let mask = 1;
                        for (let j = 0; j < 2; j++) {
                            this.buttons[si + j] = ((mask << j) & buttonByte) > 0;
                        }
                    });
                    break;
            }
            // Call the onData event handler
            this.onData(this);
        } catch (error) {
            log.error('Error handling SpaceMouse data:', error);
        }
    }

    /**
     * Handle device errors
     * @private
     */
    _handleError(error) {
        log.error('SpaceMouse device error:', error);
    }

    /**
     * Apply sensitivity and deadzone settings to a value
     * @private
     */
    _applySettings(value) {
        // Apply deadzone
        if (Math.abs(value) < this.options.deadzone) {
            return 0;
        }
        // Apply sensitivity
        return value * this.options.sensitivity;
    }

    /**
     * Close the device connection
     */
    close() {
        try {
            this.device.close();
        } catch (error) {
            log.error('Error closing SpaceMouse device:', error);
        }
    }
}

class SpaceMiceManager {
    /**
     * Constructor for the space controller manager.
     * @param {object} options - Configuration options for all devices.
     */
    constructor(options = {}) {
        this.options = options;
        this.translate = { x: 0, y: 0, z: 0 };
        this.rotate = { x: 0, y: 0, z: 0 };
        this.buttons = new Array(2).fill(false);
        this.mice = [];
        this.onData = sm => { };
    }

    /**
     * Initialize available SpaceMouse devices
     */
    initialize() {
        try {
            const devices = HID.devices().filter(device => 
                device.vendorId === 0x256F || // 3Dconnexion vendor ID
                device.manufacturer === '3Dconnexion'
            );

            log.info('Found SpaceMouse devices:', devices);

            this.mice = devices.map(device => {
                try {
                    const hidDevice = new HID.HID(device.path);
                    return new SpaceMouse(hidDevice, this.options);
                } catch (error) {
                    log.error(`Error initializing SpaceMouse device ${device.path}:`, error);
                    return null;
                }
            }).filter(Boolean);

            this._setupEventListeners();
        } catch (error) {
            log.error('Error initializing SpaceMice:', error);
        }
    }

    /**
     * Set up event listeners for all devices
     * @private
     */
    _setupEventListeners() {
        this.mice.forEach(mouse => {
            mouse.onData = this._handleDeviceData.bind(this);
        });
    }

    /**
     * Handle data from any device
     * @private
     */
    _handleDeviceData(device) {
        // Combine data from all devices
        this.translate.x = this.mice.reduce((sum, mouse) => sum + mouse.translate.x, 0);
        this.translate.y = this.mice.reduce((sum, mouse) => sum + mouse.translate.y, 0);
        this.translate.z = this.mice.reduce((sum, mouse) => sum + mouse.translate.z, 0);
        
        this.rotate.x = this.mice.reduce((sum, mouse) => sum + mouse.rotate.x, 0);
        this.rotate.y = this.mice.reduce((sum, mouse) => sum + mouse.rotate.y, 0);
        this.rotate.z = this.mice.reduce((sum, mouse) => sum + mouse.rotate.z, 0);
        
        // Update button states (OR operation between all devices)
        this.buttons = this.buttons.map((_, i) => 
            this.mice.some(mouse => mouse.buttons[i])
        );

        // Call the onData handler with the combined state
        this.onData(this);
    }

    /**
     * Close all device connections
     */
    close() {
        this.mice.forEach(mouse => {
            try {
                mouse.close();
            } catch (error) {
                log.error('Error closing SpaceMouse device:', error);
            }
        });
        this.mice = [];
    }
}

// Export a singleton instance of the SpaceMice manager
module.exports = {
    SpaceMouse,
    SpaceMiceManager,
    spaceMice: new SpaceMiceManager()
};
