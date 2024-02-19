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

oscCli = new osc.UDPPort({
  localAddress: "0.0.0.0",
  localPort: 7007,
  metadata: true
})
oscCli.open()





ipcMain.on("ok_to_send", (event, prefix, index, index_or_not, attr, value, OSCserverIP, OSCserverPort) => {
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
    win.webContents.send("logInfo", prefix + "/" + index + attr + " = " + value)
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
    win.webContents.send("logInfo", prefix + attr + " = " + value)
  }
})




function createWindow() {

  let win = new BrowserWindow({
    width: 1200,
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
    browserWindowOpts: {
      title: 'preferences',
      icon: `${__dirname}/assets/icons/64x64.png`
    },
    css: './src/style.css',
    dataStore: defaultDir + '/config.json',
    defaults: {
      "network_settings": {
        "osc_server": "127.0.0.1:12000",
        "osc_receiver_port": "9000",
      },
      "other_settings": {
      }
    },
    sections: [
      {
        id: 'network_settings',
        label: 'Network Settings',
        icon: 'preferences',
        form: {
          groups: [
            {
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
    ],
    //debug:true
  });

  const OSCserverIP = ((preferences.value('network_settings.osc_server')).split(":"))[0];
  const OSCserverPort = Number(((preferences.value('network_settings.osc_server')).split(":"))[1]);

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
      win.webContents.send("logInfo", prefix + "/" + index + attr, value);
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
      win.webContents.send("logInfo", prefix + attr, value);
    }
  })

/**
 * Listens for OSC messages on the specified port and handles incoming data
 */
function oscListening() {
  // Get the OSC receiver port from preferences
  const oUDPport = preferences.value('network_settings.osc_receiver_port');

  // Create a new OSC UDP port
  const oscCli = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: oUDPport,
    metadata: true
  });

  // Open the OSC UDP port
  oscCli.open();

  // Handle incoming OSC messages
  oscCli.on("message", (oscBundle) => {
    // Extract the OSC bundle arguments and find the index
    let oscBundleArguments = JSON.stringify((oscBundle.args[0]).value);
    let inc_index = oscBundleArguments.match((/\d+/g));
    if (inc_index !== undefined) {
      // Send the incoming index to the renderer process
      win.webContents.send('incoming_index', Number(inc_index[0]));
    }
  });

  // When the OSC UDP port is ready
  oscCli.on('ready', function () {
    // When the window finishes loading, send a message indicating the UDP port is OK
    win.webContents.on('did-finish-load', () => {
      win.webContents.send('udpPortOK', (preferences.value('network_settings.osc_receiver_port')));
      win.webContents.send("logInfo", "listening on OSC port : " + (preferences.value('network_settings.osc_receiver_port')));
    });
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





  win.autoHideMenuBar = "true"
  win.menuBarVisible = "false"
  win.webContents.on('did-finish-load', () => {
    //console.log("appVersion :", appVersion);
    win.webContents.send('appVersion', app.getVersion())

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
      //console.log("listening port changed!")
      win.webContents.send('udpPortOK', (preferences.value('network_settings.osc_receiver_port')));
      oscCli.close();
      oscListening();
      oscCli.on("error", function (error) {
        msg = error.message
        //console.log("An error occurred with OSC listening: ", error.message);
        win.webContents.send('udpPortKO', msg)
        win.webContents.send('resolveError')
      });

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

