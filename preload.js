const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Server control
    startServer: () => ipcRenderer.invoke('server:start'),
    stopServer: () => ipcRenderer.invoke('server:stop'),
    restartServer: () => ipcRenderer.invoke('server:restart'),
    getServerStatus: () => ipcRenderer.invoke('server:status'),

    // App info
    getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
    showItemInFolder: (filePath) => ipcRenderer.invoke('app:showItemInFolder', filePath),
    openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),

    // Terminal
    openTerminal: () => ipcRenderer.invoke('terminal:open'),

    // Events
    onServerStatusChanged: (callback) => ipcRenderer.on('server-status-changed', callback),
    onServerError: (callback) => ipcRenderer.on('server-error', callback),
    
    // Remove listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});