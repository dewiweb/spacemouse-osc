const { ipcRenderer, contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electron", {
    
  });

// White-listed channels.
const ipc = {
    'render': {
        // From render to main.
        'send': [
            'message:fromRender' // Example channel name
        ],
        // From main to render.
        'receive': [
            'message:fromMain' // Example channel name
        ],
        // From render to main and back again.
        'sendReceive': [
            'message:fromRenderAndBackAgain' // Example channel name
        ]
    }
};

// Exposed protected methods in the render process.
contextBridge.exposeInMainWorld(
    // Allowed 'ipcRenderer' methods.
    'ipcRender', {
        // From render to main.
        send: (channel, args) => {
            let validChannels = ipc.render.send;
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, args);
            }
        },
        // From main to render.
        receive: (channel, listener) => {
            let validChannels = ipc.render.receive;
            if (validChannels.includes(channel)) {
                // Deliberately strip event as it includes `sender`.
                ipcRenderer.on(channel, (event, ...args) => listener(...args));
            }
        },
        // From render to main and back again.
        invoke: (channel, args) => {
            let validChannels = ipc.render.sendReceive;
            if (validChannels.includes(channel)) {
                return ipcRenderer.invoke(channel, args);
            }
        }
    }
);
