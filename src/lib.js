//import hid from "node-hid";
hid = require("node-hid");
hidDevices = hid.devices();
console.log("list of attached HID devices :");
hidDevices.forEach(device => {console.log("vendor :", device.manufacturer, "/ product :", device.product);});
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

class spaceMouse {
/**
 * Constructor for the device controller.
 * @param {object} dev - The device object.
 */
constructor(dev) {
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
    this.buttons = (new Array(2)).fill(false);
    
    /**
     * Event handler for the data received from the device.
     * @param {function} sm - The handler function.
     */
    this.onData = sm => { };

    /**
     * Event listener for the 'data' event from the device.
     */
    dev.on('data', (data => {
        switch (data[0]) {
            case 1:
                // Update translation values for x, y, and z axes
                this.translate.x = joinInt16(data[1], data[2]) / 350;
                this.translate.y = joinInt16(data[3], data[4]) / 350;
                this.translate.z = joinInt16(data[5], data[6]) / 350;
                break;
            case 2:
                // Update rotation values for x, y, and z axes
                this.rotate.x = joinInt16(data[1], data[2]) / 350;
                this.rotate.y = joinInt16(data[3], data[4]) / 350;
                this.rotate.z = joinInt16(data[5], data[6]) / 350;
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
    }).bind(this));
}
}

class spaceMice {
/**
 * Constructor for the space controller class.
 * Initializes the translate, rotate, buttons, and mice properties.
 * Sets up event listeners for the space mice devices.
 */
constructor() {
    // Initialize translate, rotate, buttons, and mice properties
    this.translate = { x: 0, y: 0, z: 0 };
    this.rotate = { x: 0, y: 0, z: 0 };
    this.buttons = (new Array(2)).fill(false);
    this.mice = [];
    this.onData = sm => { };
    // Filter and initialize space mice devices
    this.devices = hid.devices().filter(dev => (dev.vendorId == 9583 | dev.vendorId == 1133) && dev.product.includes("Space")); //9583 Spacemouse, 1133 Pro, XXXX Enterprise, XXXX Wireless, XXXX Pro Wireless?
    this.devices.forEach(dev => {
        try {
            console.log("you've got a "+dev.product+" with id "+dev.vendorId+" and path "+dev.path+"attached!");
            this.mice.push(new spaceMouse(new hid.HID(dev.path), dev))
        } catch (error) {
            // Handle device initialization errors
            // console.log(`can't open device ${dev.productId}, ${dev.product}`);
             //console.log(error);
        }
    });

    // Set up event listeners for space mice data
    this.mice.forEach(mouse => {
        mouse.onData = data => {
            // Update translate and rotate properties based on data from space mice
            this.translate = this.mice.reduce((cval, cm) => {
                return {
                    x: cval.x + cm.translate.x,
                    y: cval.y + cm.translate.y,
                    z: cval.z + cm.translate.z,
                }
            }, { x: 0, y: 0, z: 0 });
            this.rotate = this.mice.reduce((cval, cm) => {
                return {
                    x: cval.x + cm.rotate.x,
                    y: cval.y + cm.rotate.y,
                    z: cval.z + cm.rotate.z,
                }
            }, { x: 0, y: 0, z: 0 });

            // Update buttons state based on data from space mice
            this.buttons.fill(false);
            this.mice.forEach(cm => {
                for (let i = 0; i < this.buttons.length; i++) {
                    this.buttons[i] = this.buttons[i] || cm.buttons[i];       
                }
            });

            // Trigger onData event
            this.onData(this);
        };
    });
}
}

module.exports.spaceMice = new spaceMice();
module.exports.hidDevices = hidDevices