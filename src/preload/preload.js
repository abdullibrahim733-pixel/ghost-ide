const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Dialogs
  dialog: {
    openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
    openFolder: (options) => ipcRenderer.invoke('dialog:openFolder', options),
    saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
    showMessageBox: (options) => ipcRenderer.invoke('dialog:showMessageBox', options)
  },

  // File system
  fs: {
    readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
    readDir: (dirPath) => ipcRenderer.invoke('fs:readDir', dirPath),
    mkdir: (dirPath) => ipcRenderer.invoke('fs:mkdir', dirPath),
    delete: (filePath) => ipcRenderer.invoke('fs:delete', filePath),
    rename: (oldPath, newPath) => ipcRenderer.invoke('fs:rename', oldPath, newPath)
  },

  // Project operations
  project: {
    create: (projectPath, projectName, template) => ipcRenderer.invoke('project:create', projectPath, projectName, template),
    open: (projectPath) => ipcRenderer.invoke('project:open', projectPath)
  },

  // Ghost compiler operations
  ghost: {
    build: (projectPath, options) => ipcRenderer.invoke('ghost:build', projectPath, options),
    run: (projectPath, options) => ipcRenderer.invoke('ghost:run', projectPath, options),
    flash: (projectPath, options) => ipcRenderer.invoke('ghost:flash', projectPath, options),
    check: (projectPath, options) => ipcRenderer.invoke('ghost:check', projectPath, options),
    tokens: (filePath) => ipcRenderer.invoke('ghost:tokens', filePath),
    ast: (filePath) => ipcRenderer.invoke('ghost:ast', filePath),
    ir: (filePath) => ipcRenderer.invoke('ghost:ir', filePath),
    llvm: (filePath) => ipcRenderer.invoke('ghost:llvm', filePath),
    c: (filePath) => ipcRenderer.invoke('ghost:c', filePath)
  },

  // Serial port operations
  serial: {
    listPorts: () => ipcRenderer.invoke('serial:listPorts'),
    connect: (portPath, baudRate) => ipcRenderer.invoke('serial:connect', portPath, baudRate),
    disconnect: () => ipcRenderer.invoke('serial:disconnect'),
    write: (data) => ipcRenderer.invoke('serial:write', data)
  },

  // Terminal operations (node-pty via IPC)
  terminal: {
    spawn: (options) => ipcRenderer.invoke('terminal:spawn', options),
    write: (ptyId, data) => ipcRenderer.invoke('terminal:write', ptyId, data),
    resize: (ptyId, cols, rows) => ipcRenderer.invoke('terminal:resize', ptyId, cols, rows),
    kill: (ptyId) => ipcRenderer.invoke('terminal:kill', ptyId)
  },

  // Settings
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll')
  },

  // Recent projects
  projects: {
    getRecent: () => ipcRenderer.invoke('projects:getRecent'),
    clearRecent: () => ipcRenderer.invoke('projects:clearRecent')
  },

  // Window controls
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized')
  },

  // Event listeners
  on: (channel, callback) => {
    const validChannels = [
      'ghost:output',
      'serial:data',
      'serial:error',
      'serial:disconnected',
      'project:fileChanged',
      'session:restore',
      'terminal:data',
      'terminal:exit',
      'menu-new-file',
      'menu-open-file',
      'menu-open-folder',
      'menu-save',
      'menu-save-as',
      'menu-save-all',
      'menu-new-project',
      'menu-open-project',
      'ghost-build',
      'ghost-run',
      'ghost-flash',
      'ghost-serial-monitor',
      'ghost-show-output',
      'ghost-select-target',
      'ghost-compiler-settings',
      'terminal-new',
      'terminal-split',
      'terminal-run-task',
      'terminal-configure-tasks',
      'check-updates',
      'show-about'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },

  off: (channel, callback) => {
    const validChannels = [
      'ghost:output',
      'serial:data',
      'serial:error',
      'serial:disconnected',
      'project:fileChanged',
      'session:restore'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.off(channel, callback);
    }
  },

  // Send to main process
  send: (channel, data) => {
    const validChannels = [
      'session:save'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  }
});

// Expose node modules needed in renderer (limited)
contextBridge.exposeInMainWorld('nodeAPI', {
  path: require('path'),
  os: require('os')
});