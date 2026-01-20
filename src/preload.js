const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getScripts: () => ipcRenderer.invoke('get-scripts'),
  startScript: (name) => ipcRenderer.invoke('start-script', name),
  stopScript: (name) => ipcRenderer.invoke('stop-script', name),
  getHotkeys: () => ipcRenderer.invoke('get-hotkeys'),
  saveHotkey: (config) => ipcRenderer.invoke('save-hotkey', config),
  deleteHotkey: (id) => ipcRenderer.invoke('delete-hotkey', id),
  openScriptsFolder: () => ipcRenderer.invoke('open-scripts-folder'),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  browseDirectory: () => ipcRenderer.invoke('browse-directory'),

  onScriptOutput: (callback) => {
    ipcRenderer.on('script-output', (event, data) => callback(data));
  },
  onScriptError: (callback) => {
    ipcRenderer.on('script-error', (event, data) => callback(data));
  },
  onScriptStopped: (callback) => {
    ipcRenderer.on('script-stopped', (event, data) => callback(data));
  }
});
