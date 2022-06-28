const { app, BrowserWindow } = require('electron');
const path = require('path');
const { ipcMain } = require('electron')

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
    }
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

/******************Debut de Mon Code******************/

const osc = require('osc')
oscCli = new osc.UDPPort({
  localAddress: "0.0.0.0",
  localPort: 7707,
  metadata: true
});
oscCli.open()
sm = require("./lib.js");
iteration = 1
//console.log ("operationnal1");
sm.spaceMice.onData = mouse => {
    console.clear();
//    console.log ("operationnal2");
datas = JSON.stringify(mouse.mice[0], null, 2);
translateX = mouse.mice[0].translate.x;
translateY = mouse.mice[0].translate.y;
translateZ = mouse.mice[0].translate.z;
rotateX = mouse.mice[0].rotate.x;
rotateY = mouse.mice[0].rotate.y;
rotateZ = mouse.mice[0].rotate.z;
sendFrequency = 3

if (iteration<sendFrequency){
    iteration = iteration+1
  }
  else{


    console.log(datas);
    oscCli.send({
        timeTag: osc.timeTag(0), // Schedules this bundle 60 seconds from now.
        packets: [
//        {
 //       address: "/track/3/z++",
//        args: [
//            {
//                type: "f",
//                value: Math.pow(translateZ*(1), 3)
//            }
//        ]
//    },
    {
        address: "/track/3/azim++",
        args: [
            {
                type: "f",
                value: Math.pow(rotateY*(1), 3)*5
            }
        ]
    },{
        address: "/track/3/dist++",
        args: [
            {
                type: "f",
                value: Math.pow(rotateZ*(1), 3)*5
            }
        ]
    }
]}, "192.168.100.12", 4003)

    iteration=0
}
};


/******************Fin de Mon Code******************/

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
