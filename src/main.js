const osc = require('osc')
//const oServerIP = "";
//const lib = require('./mainFunctions')
const electron = require('electron')
const { ipcMain } = require('electron')
const nativeTheme = electron.nativeTheme;
nativeTheme.themeSource = 'dark';
const { app, BrowserWindow } = require('electron');
const ElectronPreferences = require('electron-preferences');
const contextMenu = require('electron-context-menu');
const fs = require('fs');
const defaultDir = app.getPath('documents') + '/spacemouse-OSC';
if (!fs.existsSync(defaultDir)) {
  fs.mkdirSync(defaultDir)
};

//const mainFunctions = require('./mainFunctions');
const { dialog } = require('electron')
const { webContents } = require('electron')
const log = require('electron-log');
const hid = require("node-hid");
const { config } = require('process');
const { type } = require('os');


var translateX = 0
var translateY = 0
var translateZ = 0
var rotateX = 0
var rotateY = 0
var rotateZ = 0
//var oServerIP = "0.0.0.0"
//var oServerPort = 0
var sendFrequency = 3
const appVersion = app.getVersion()
var oUDPport = ""; 


console.log('app.getAppPath() : ' + app.getAppPath())









function createWindow() {

  let win = new BrowserWindow({
    width: 1400,
    height: 430,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,

    },
    icon: `${__dirname}/assets/icons/64x64.png`
  })
  win.setMenu(null);
  win.loadFile('src/index.html')
  //win.webContents.openDevTools({ mode: "detach" });
  

  const preferences = new ElectronPreferences({
    dataStore: defaultDir + '/config.json',
    css: './src/style.css',
    //debug : true,
    defaults: {
      "network_settings": {
        "osc_server": "127.0.0.1:12000",
        "osc_receiver_port": "9000",
      },
      "other_settings": {
      },
      "app_settings": {
        "default_mode": "aed",
        "default_precision": "100000",
        "default_send_rate": "33",
        "default_factor": "1",
      }
    },
    sections: [
      {
        id: 'app_settings',
        label: 'App Settings',
        icon: 'preferences',
        form: {
          groups: [
            {
              id:'default_settings',
              label: 'Default settings',
              fields: [
                {
                  label: 'Mode :',
                  key: 'default_mode',
                  type: 'dropdown',
                  options: [
                    { label: 'AED', value: 'aed' },
                    { label: 'AD', value: 'ad' },
                    { label: 'XYZ', value: 'xyz' },
                    { label: 'XY', value: 'xy' },
                  ],
                  help: 'AED is default',
                },
                {
                  label: 'Precision :',
                  key: 'default_precision',
                  type: 'dropdown',
                  options: [
                    { label: 'Clear', value: 'clear' },
                    { label: '1/100000', value: '100000' },
                    { label: '1/1000', value: '1000' },
                    { label: '1/100', value: '100' },
                    { label: '1/10', value: '10' },
                    { label: '1', value: '1' },
                  ],
                  help: 'Clear is default',
                },
                {
                  label: 'Factor :',
                  key: 'default_factor',
                  type: 'number',
                  help: '1 is default',
                },
                {
                  label: 'Send frequency :',
                  key: 'default_send_rate',
                  type: 'number',
                  help: '33(Hz) is default',
                },
              ],
            },
          ],
        },
      },
      {
        id: 'network_settings',
        label: 'Network Settings',
        icon: 'preferences',
        form: {
          groups: [
            {
              id:'osc_settings',
              label: 'OSC settings',
              fields: [
                {
                  label: 'Sending to "Ip Address:Port" :',
                  key: 'osc_server',
                  type: 'text',
                  help: 'example: 127.0.0.1:12000'
                },
                {
                  label: 'Listening on "Port" : ',
                  key: 'osc_receiver_port',
                  type: 'number'
                },
                {
                  label: '',
                  key: 'applyButton',
                  type: 'button',
                  buttonLabel: 'Apply',
                  hideLabel: true,
                },
              ]
            },
          ],
        },
      },
      {
        id: 'other_settings',
        label: 'Other Settings',
        icon: 'settings-gear-63',
        form: {
          groups: [
            {
              label: '',
              fields: [
                {
                  label: '',
                  key: 'osc_id',
                  type: 'checkbox',
                  help: "if incoming message contains number, it's use as index",
                  options: [
                    {
                      label: 'incoming osc control index',
                      value: 'on',

                    },
                  ],
                },
              ]
            },
          ],
        },
      },
      {
        id: 'about',
        label: 'About',
        icon: 'info',
        form: {
          groups: [
            {
              label: '',
              fields: [
                {
                  heading : "actual version :",
                  label: 'Version :',
                  key: 'appVersion',
                  type: 'message',
                  content: appVersion
                },
              ]
            },
          ],
        },
      },
    ],
    browserWindowOverrides:  {
      title: 'Settings',

      //icon: 'src/assets/icons/64x64.png',
      width : 800,
      height : 430
    },
  });


  const OSCserverIP = ((preferences.value('network_settings.osc_server')).split(":"))[0];
  const OSCserverPort = Number(((preferences.value('network_settings.osc_server')).split(":"))[1]);
  oUDPport = Number(((preferences.value('network_settings.osc_receiver_port'))));
  receiveIndex = preferences.value('other_settings.osc_id[0]');
  preferences.on('save', (preferences) => {
    //console.log("preferences:", preferences);
    //console.log(`Preferences were saved.`, JSON.stringify(preferences, null, 4));
  });


/**
 * Configures the logging settings and error handling.
 */
function logDefinition() {
  // Reassign console methods to custom log functions
  Object.assign(console, log.functions);

  // Set the log format for the console
  log.transports.console.format = '{h}:{i}:{s} / {text}';

  // Handle errors with a dialog
  log.catchErrors({
    showDialog: false,
    onError(error) {
      // Show error dialog
      electron.dialog.showMessageBox({
        title: 'An error occurred',
        message: error.message,
        detail: error.stack,
        type: 'error',
        buttons: ['Ignore', 'Preferences', 'Exit'],
      })
        .then((result) => {
          // Resolve error
          if (result.response === 1) {
            win.webContents.send('resolveError');
          }
          // Exit application
          if (result.response === 2) {
            electron.app.quit();
          }
        });
    }
  })
}
  logDefinition();

  contextMenu({
    window: win,
    labels: {
      copy: "📄 | Copy",
      paste: "📋 | Paste",
      cut: "✂ | Cut"
    },
    /* Context Menu Items */
    menu: (actions, params, win, dicSuggestion) => [
      /* System Buttons */
      actions.copy(),
      actions.cut(),
      actions.paste(),
    ]
  })


  
  //------//

//  ipcMain.on("ok_to_send", (event, prefix, index, index_or_not, attr, value, OSCserverIP, OSCserverPort) => {
//    if (index_or_not == "visible") {
//      oscCli.send({
//        timeTag: osc.timeTag(0), // Schedules this bundle 60 seconds from now.
//        packets: [{
//          address: prefix + "/" + index + attr,
//          args: [
//            {
//              type: "f",
//              value: value
//            }
//          ]
//        }
//        ]
//      }, OSCserverIP, OSCserverPort);
//      win.webContents.send("logInfo", prefix + "/" + index + attr + " = " + value)
//    }
//    else {
//      oscCli.send({
//        timeTag: osc.timeTag(0), // Schedules this bundle 60 seconds from now.
//        packets: [{
//          address: prefix + attr,
//          args: [
//            {
//              type: "f",
//              value: value
//            }
//          ]
//        }
//        ]
//      }, OSCserverIP, OSCserverPort);
//      win.webContents.send("logInfo", prefix + "/+" + attr + " = " + value)
//    }
//  })
let validIpPort = true;
ipcMain.on('matchingIpPort',(e)=> {
  //preferences.options.sections[0].form.groups[0].fields[0].help = 'matching IP and Port'
  //preferences.prefsWindow.reload()
  validIpPort = true
})

ipcMain.on('notMatchingIpPort',(e)=> {
  //preferences.options.sections[0].form.groups[0].fields[0].help = 'non-matching IP and Port'
  //preferences.prefsWindow.reload()
  validIpPort = false
})

  ipcMain.on("ok_to_send", (event, prefix, index, index_or_not, attr, value) => {
    if (index_or_not == "visible") {
      oscCli.send({
        timeTag: osc.timeTag(0), // Schedules this bundle 60 seconds from now.
        packets: [{
          address: prefix + "/" + index + attr,
          args: [
            {
              type: "f",
              value: value
            }
          ]
        }
        ]
      }, OSCserverIP, OSCserverPort);
      win.webContents.send("logInfo", prefix + "/" + index + attr +"  " +value +" @ " + OSCserverIP + ":" + OSCserverPort);
    }
    else {
      oscCli.send({
        timeTag: osc.timeTag(0), // Schedules this bundle 60 seconds from now.
        packets: [{
          address: prefix + attr,
          args: [
            {
              type: "f",
              value: value
            }
          ]
        }
        ]
      }, OSCserverIP, OSCserverPort);
      win.webContents.send("logInfo", prefix + attr+"  "+ value +" @ " + OSCserverIP + ":" + OSCserverPort);
    }
  })

/**
  * Listens for OSC messages on the specified port and handles incoming data
  */
function oscListening() {
  
  // Check if the OSC receiver port has changed
  let changed = "";
  if (oUDPport != preferences.value('network_settings.osc_receiver_port')) {
    win.webContents.send("logInfo", "OSC listening port " + oUDPport + " closed!");
    changed = "true";
  } else {
    win.webContents.send("logInfo", "OSC listening port is " + oUDPport);
    changed = "false";
  }

  // Close the existing OSC UDP port
  if (!oscCli) {
  oscCli.close();
  }

  // Update the OSC receiver port
  oUDPport = preferences.value('network_settings.osc_receiver_port');

  // Create a new OSC UDP port
  oscCli = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: oUDPport,
    metadata: true
  });

  // Open the new OSC UDP port
  oscCli.open();



  // When the OSC UDP port is ready
  oscCli.on('ready', function () {
    if (changed == "true") {
      win.webContents.send("logInfo", "OSC port " + oUDPport + " opened");
    }
  });

  oscCli.on("message", (oscBundle) => {
    const oscAddress = oscBundle.address;
    const oscArgs = oscBundle.args;
    win.webContents.send("logInfo", oscAddress+" "+oscArgs[0].value);
    
    if (oscAddressFunctions[oscAddress]) {
      oscAddressFunctions[oscAddress](oscBundle.args);
    } else {
      receiveIndex = preferences.value('other_settings.osc_id[0]');
    if(receiveIndex == "on"){
    // Extract the OSC bundle arguments and find the index
    let oscBundleArguments = JSON.stringify((oscBundle.args[0]).value);
    let inc_index = oscBundleArguments.match((/\d+/g));
    console.log("inc_index :", inc_index)
    if (inc_index !== null ){
      // Send the incoming index to the renderer process
      win.webContents.send('incoming_index', Number(inc_index[0]));
    }else{win.webContents.send("logInfo","No function found for OSC address:"+ oscAddress);}
  }
      
    }
  });

  // Handle any errors with the OSC UDP port
  oscCli.on("error", (error) => {
    // Send a message to the renderer process indicating the error
    msg = error.message;
    win.webContents.on('did-finish-load', () => {
      win.webContents.send('udpPortKO', msg);
      oscCli.close();
    });
  });
}


function handleMode(args) {
  // Function implementation for handling "/mode" address
    const modeValue = args[0].value;
    if (modeValue === "aed"|| modeValue === "ad"|| modeValue === "xyz"|| modeValue === "xy") {
      win.webContents.send("modeChanged", modeValue);
    }else{
      win.webContents.send("logInfo", "Invalid mode value: " + modeValue);
    }
  }

  function handlePrecision(args) {
    // Function implementation for handling "/precision" address
    const precisionValue = args[0].value;
    if (precisionValue === "1" || precisionValue === "10" || precisionValue === "100" || precisionValue === "1000" || precisionValue === "100000" || precisionValue === "clear") {
      win.webContents.send("precisionChanged", precisionValue);
    }else{
      win.webContents.send("logInfo", "Invalid precision value: " + precisionValue);
    }
    
  }

  function handleFactor(args)  {
    // Function implementation for handling "/factor" address
    const factorValue = args[0].value;
    if (factorValue > 0  && factorValue < 100) {
      win.webContents.send("factorChanged", factorValue);
    }else{
      win.webContents.send("logInfo", "Invalid factor value: " + factorValue);
    }
  }

  function handleSendRate(args) {
    // Function implementation for handling "/sendRate" address
    const sendRateValue = args[0].value;
    if (sendRateValue > 0  && sendRateValue < 100) {
      win.webContents.send("sendRateChanged", sendRateValue);
    }else{
      win.webContents.send("logInfo", "Invalid sendRate value: " + sendRateValue);
    }
  }


  const oscAddressFunctions = {
    "/mode": handleMode,
    "/precision": handlePrecision,
    "/factor": handleFactor,
    "/sendRate": handleSendRate
  };
  






  win.autoHideMenuBar = "true"
  win.menuBarVisible = "false"
  win.webContents.on('did-finish-load', () => {
    hidDevices = hid.devices();
  //win.webContents.send("logInfo", "list of attached HID devices :");
  //hidDevices.forEach(device => {win.webContents.send("logInfo", "vendor :"+ device.manufacturer+ "/ product :"+ device.product);});
  spaceMouse = hid.devices().filter(dev => (dev.vendorId == 9583 | dev.vendorId == 1133) && dev.product.includes("Space")); //9583 Spacemouse, 1133 Pro, XXXX Enterprise, XXXX Wireless, XXXX Pro Wireless?
  if(!spaceMouse[0]){
    win.webContents.send("logInfo", "No SpaceMouse attached yet!");
  }
  else{
    win.webContents.send("logInfo", "SpaceMouse devices :");
    spaceMouse.forEach(device => {win.webContents.send("logInfo", "vendor :"+ device.manufacturer+ "/ product :"+ device.product);});

    
  }  
  
  console.log("appVersion :", appVersion);
  console.log("preferences :", preferences);
    handleMode([{value: preferences.value('app_settings.default_mode')}]);
    handlePrecision([{value: preferences.value('app_settings.default_precision')}]);
    handleFactor([{value: preferences.value('app_settings.default_factor')}]);
    handleSendRate([{value: preferences.value('app_settings.default_send_rate')}]);
    //preferences._preferences.about.appVersion = appVersion;
    win.webContents.send('appVersion', app.getVersion())
    oscCli = new osc.UDPPort({
      localAddress: "0.0.0.0",
      localPort: oUDPport,
      metadata: true
    });
    oscCli.open();
    oscCli.on("message", (oscBundle) => {
      const oscAddress = oscBundle.address;
      const oscArgs = oscBundle.args;
      win.webContents.send("logInfo", oscAddress+" "+oscArgs[0].value);
      
      if (oscAddressFunctions[oscAddress]) {
        oscAddressFunctions[oscAddress](oscBundle.args);
      } else {
        receiveIndex = preferences.value('other_settings.osc_id[0]');
      if(receiveIndex == "on"){
      // Extract the OSC bundle arguments and find the index
      let oscBundleArguments = JSON.stringify((oscBundle.args[0]).value);
      let inc_index = oscBundleArguments.match((/\d+/g));
      console.log("inc_index :", inc_index)
      if (inc_index !== null ){
        // Send the incoming index to the renderer process
        win.webContents.send('incoming_index', Number(inc_index[0]));
      }else{win.webContents.send("logInfo","No function found for OSC address:"+ oscAddress);}
    }
        
      }
    });
    
    oscCli.on('ready', function () {
      win.webContents.send("logInfo", "OSC ready to listen on port " + oUDPport);});

  })

  ipcMain.on('sendOscServerIp', (event, oServerIP) => {
    //console.log('IP du server OSC distant:', oServerIP);

    ipcMain.on('sendOscServerPort', (event, oServerPort) => {
      //console.log('Port du server OSC distant:', oServerPort);
      win.webContents.send('oServerOK');
    })
  })

  ipcMain.on('sendRateChange', (event, rate) => {
    //console.log('Rate : ', rate);
    sendFrequency = 100/rate
  })

/**
 * Main function to handle mouse data
 */
async function main() {
  // Importing the required module
  const sm = require("./lib.js");
  // Initializing iteration counter
  let iteration = 1;
  
  // Event handler for receiving mouse data
  sm.spaceMice.onData = mouse => {
    // Clear the console
    console.clear();
    // Stringify the mouse data
    const data = JSON.stringify(mouse.mice[0], null, 2);
    // Extracting translation and rotation values
    const { translate, rotate, buttons } = mouse.mice[0];
    const { x: translateX, y: translateY, z: translateZ } = translate;
    const { x: rotateX, y: rotateY, z: rotateZ } = rotate;
    console.log("buttons : ",buttons)
    // Sending button data to the main window
    win.webContents.send("buttons", buttons);

    // Sending sensor data at a specified frequency
    if (iteration < sendFrequency) {
      iteration++;
    } else {
      win.webContents.send("incoming_data", translateX, translateY, translateZ, rotateX, rotateY, rotateZ);
      iteration = 0;
    }
  }
}
  main()


  



  preferences.on('click', (key) => {
    if (key === 'applyButton') {
      console.log("apply");
      if(validIpPort=== true){
        win.webContents.send('udpPortOK', (preferences.value('network_settings.osc_receiver_port')));
        win.webContents.send('logInfo', "destination server is "+OSCserverIP+":"+OSCserverPort);
        oscListening(); 
        preferences.prefsWindow.close()
        
        oscCli.on("error", function (error) {
          msg = error.message
          //console.log("An error occurred with OSC listening: ", error.message);
          win.webContents.send('udpPortKO', msg)
          win.webContents.send('resolveError')
          
          
        });
      }else{
        dialog.showMessageBox(null, {
          type: 'info',
          title: 'Error in ip:port',
          message: 'destination does not match a valid ip:port format (ex: 89.207.132.170:1234)',
          buttons: ['OK']
        });
      }

      //eGet.connect()
    }
  });
}

app.whenReady().then(createWindow)



app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (win === null) {
    createWindow()
  }
})

