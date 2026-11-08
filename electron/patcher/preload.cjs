'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fantasyPatcher', {
  onState(callback) { ipcRenderer.on('fa-patcher-state', (_event, state) => callback(state)); },
  retry() { ipcRenderer.send('fa-patcher-retry'); },
});
