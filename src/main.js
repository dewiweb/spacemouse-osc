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
  //console.log("retour de gui : ", prefix + "/" + index + attr + " " + value)
  ////console.log(index_or_not)
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
    }, OSCserverIP, OSCserverPort)
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
    }, OSCserverIP, OSCserverPort)
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


  function logDefinition() {
    //console.log = log.log;
    Object.assign(console, log.functions);
    log.transports.console.format = '{h}:{i}:{s} / {text}';
    log.catchErrors({
      showDialog: false,
      onError(error) {
        electron.dialog.showMessageBox({
          title: 'An error occurred',
          message: error.message,
          detail: error.stack,
          type: 'error',
          buttons: ['Ignore', 'Preferences', 'Exit'],
        })
          .then((result) => {
            if (result.response === 1) {
              win.webContents.send('resolveError')
            }

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
    //console.log("retour de gui : ", prefix + "/" + index + attr + " " + value)
    ////console.log(index_or_not)
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
      }, OSCserverIP, OSCserverPort)
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
      }, OSCserverIP, OSCserverPort)
    }
  })

  function oscListening() {
    oUDPport = preferences.value('network_settings.osc_receiver_port');
    const oscCli = new osc.UDPPort({
      localAddress: "0.0.0.0",
      localPort: oUDPport,
      metadata: true
    })
    oscCli.open();
    oscCli.on("message", (oscBundle) => {
      //console.log('oscBundle : ', oscBundle);
      let oRaddr = JSON.stringify(oscBundle.address);
      //console.log("OSC Address received", oRaddr);
      let oRargs = JSON.stringify((oscBundle.args[0]).value);
      //console.log("oRargs", oRargs);
      let inc_index = oRargs.match((/\d+/g));
      //console.log('inc_index', inc_index)
      if (inc_index !== undefined) {
        win.webContents.send('incoming_index', Number(inc_index[0]))
      }
    });
    oscCli.on('ready', function () {
      win.webContents.on('did-finish-load', () => {
        win.webContents.send('udpportOK', (preferences.value('network_settings.osc_receiver_port')));
      })
    })
    oscCli.on("error", (error) => {

      msg = error.message;
      win.webContents.on('did-finish-load', () => {
        //console.log("An error occurred with OSC listening: ", error.message);

        win.webContents.send('udpportKO', msg);
        oscCli.close()
      });
    });
  } oscListening()





  win.autoHideMenuBar = "true"
  win.menuBarVisible = "false"
  win.webContents.on('did-finish-load', () => {
    //console.log("appVersion :", appVersion);
    win.webContents.send('appVersion', app.getVersion())

  })

  ipcMain.on('sendOSCserverIP', (event, oServerIP) => {
    //console.log('IP du server OSC distant:', oServerIP);

    ipcMain.on('sendOSCserverPort', (event, oServerPort) => {
      //console.log('Port du server OSC distant:', oServerPort);
      win.webContents.send('oServerOK');
    })
  })

  ipcMain.on('sendRateChange', (event, rate) => {
    //console.log('Rate : ', rate);
    sendFrequency = 100/rate
  })

  async function main() {
    sm = require("./lib.js");
    iteration = 1
    //console.log("operationnal1");
    sm.spaceMice.onData = mouse => {
      console.clear();
      //    //console.log ("operationnal2");
      datas = JSON.stringify(mouse.mice[0], null, 2);
      translateX = mouse.mice[0].translate.x;
      translateY = mouse.mice[0].translate.y;
      translateZ = mouse.mice[0].translate.z;
      rotateX = mouse.mice[0].rotate.x;
      rotateY = mouse.mice[0].rotate.y;
      rotateZ = mouse.mice[0].rotate.z;
      buttons = mouse.mice[0].buttons;
      win.webContents.send("buttons", buttons)

      

      if (iteration < sendFrequency) {
        iteration = iteration + 1
      }
      else {


        ////console.log(datas);
        //console.log(translateX, translateY, translateZ, rotateX, rotateY, rotateZ)
        win.webContents.send("incoming_datas", translateX, translateY, translateZ, rotateX, rotateY, rotateZ)
        iteration = 0
      }
    }



    //win.webContents.send("incoming_datas", translateX,translateY,translateZ,rotateX,rotateY,rotateZ)
  }
  main()





  preferences.on('click', (key) => {
    if (key === 'applyButton') {
      //console.log("listening port changed!")
      win.webContents.send('udpportOK', (preferences.value('network_settings.osc_receiver_port')));
      oscCli.close();
      oscListening();
      oscCli.on("error", function (error) {
        msg = error.message
        //console.log("An error occurred with OSC listening: ", error.message);
        win.webContents.send('udpportKO', msg)
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

