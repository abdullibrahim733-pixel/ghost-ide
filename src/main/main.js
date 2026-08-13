const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const Store = require('electron-store');
const { spawn } = require('child_process');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const chokidar = require('chokidar');
let pty;
try {
  pty = require('node-pty');
} catch (e) {
  console.warn('node-pty not available, terminal features disabled');
}

// Initialize electron store for settings
const store = new Store({
  name: 'ghost-ide-settings',
  defaults: {
    theme: 'dark',
    fontSize: 14,
    tabSize: 2,
    ghostCompilerPath: 'ghc',
    defaultTarget: 'stm32f411',
    autoSave: true,
    showLineNumbers: true,
    wordWrap: 'on',
    minimap: true,
    recentProjects: [],
    openFiles: [],
    lastProject: null,
    terminalFontSize: 13,
    serialPort: null,
    baudRate: 115200
  }
});

// Global references
let mainWindow = null;
let projectWatcher = null;
let serialPort = null;
let serialParser = null;
let ghostProcess = null;

// Window state management
const windowState = {
  bounds: null,
  isMaximized: false
};

function createMainWindow() {
  // Load saved window state
  const savedBounds = store.get('windowBounds');
  const savedMaximized = store.get('windowMaximized');

  mainWindow = new BrowserWindow({
    width: savedBounds?.width || 1400,
    height: savedBounds?.height || 900,
    x: savedBounds?.x,
    y: savedBounds?.y,
    minWidth: 1024,
    minHeight: 768,
    maximized: savedMaximized || false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js'),
      enableRemoteModule: false,
      sandbox: false
    },
    icon: path.join(__dirname, '../resources/icons/icon.png'),
    show: false
  });

  // Load the main HTML file
  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Restore open files from last session if auto-restore is enabled
    if (store.get('autoRestoreSession')) {
      restoreSession();
    }
  });

  // Save window state on changes
  mainWindow.on('resize', () => saveWindowState());
  mainWindow.on('move', () => saveWindowState());
  mainWindow.on('maximize', () => {
    windowState.isMaximized = true;
    store.set('windowMaximized', true);
  });
  mainWindow.on('unmaximize', () => {
    windowState.isMaximized = false;
    store.set('windowMaximized', false);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Create application menu
  createApplicationMenu();

  return mainWindow;
}

function saveWindowState() {
  if (mainWindow) {
    const bounds = mainWindow.getBounds();
    store.set('windowBounds', bounds);
  }
}

function createApplicationMenu() {
  const isMac = process.platform === 'darwin';
  
  const template = [
    // { role: 'appMenu' }
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    // { role: 'fileMenu' }
    {
      label: 'File',
      submenu: [
        {
          label: 'New File',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendToRenderer('menu-new-file')
        },
        {
          label: 'Open File...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendToRenderer('menu-open-file')
        },
        {
          label: 'Open Folder...',
          accelerator: 'CmdOrCtrl+K CmdOrCtrl+O',
          click: () => sendToRenderer('menu-open-folder')
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendToRenderer('menu-save')
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendToRenderer('menu-save-as')
        },
        {
          label: 'Save All',
          accelerator: 'CmdOrCtrl+K S',
          click: () => sendToRenderer('menu-save-all')
        },
        { type: 'separator' },
        {
          label: 'New Project...',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => sendToRenderer('menu-new-project')
        },
        {
          label: 'Open Project...',
          click: () => sendToRenderer('menu-open-project')
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    // { role: 'editMenu' }
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' },
              { role: 'stopSpeaking' }
            ]
          }
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' }
        ])
      ]
    },
    // { role: 'viewMenu' }
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    // Ghost specific menu
    {
      label: 'Ghost',
      submenu: [
        {
          label: 'Build Project',
          accelerator: 'CmdOrCtrl+B',
          click: () => sendToRenderer('ghost-build')
        },
        {
          label: 'Run on Target',
          accelerator: 'F5',
          click: () => sendToRenderer('ghost-run')
        },
        {
          label: 'Flash to Device',
          accelerator: 'CmdOrCtrl+F',
          click: () => sendToRenderer('ghost-flash')
        },
        { type: 'separator' },
        {
          label: 'Open Serial Monitor',
          accelerator: 'CmdOrCtrl+Shift+M',
          click: () => sendToRenderer('ghost-serial-monitor')
        },
        {
          label: 'Show Compiler Output',
          click: () => sendToRenderer('ghost-show-output')
        },
        { type: 'separator' },
        {
          label: 'Select Target...',
          click: () => sendToRenderer('ghost-select-target')
        },
        {
          label: 'Compiler Settings...',
          click: () => sendToRenderer('ghost-compiler-settings')
        }
      ]
    },
    // Terminal menu
    {
      label: 'Terminal',
      submenu: [
        {
          label: 'New Terminal',
          accelerator: 'CmdOrCtrl+`',
          click: () => sendToRenderer('terminal-new')
        },
        {
          label: 'Split Terminal',
          accelerator: 'CmdOrCtrl+Shift+`',
          click: () => sendToRenderer('terminal-split')
        },
        { type: 'separator' },
        {
          label: 'Run Task...',
          click: () => sendToRenderer('terminal-run-task')
        },
        {
          label: 'Configure Tasks...',
          click: () => sendToRenderer('terminal-configure-tasks')
        }
      ]
    },
    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Ghost Language Guide',
          click: () => shell.openExternal('https://ghost-lang.dev/docs')
        },
        {
          label: 'API Reference',
          click: () => shell.openExternal('https://ghost-lang.dev/api')
        },
        { type: 'separator' },
        {
          label: 'Report Issue',
          click: () => shell.openExternal('https://github.com/ghost-lang/ghost/issues')
        },
        {
          label: 'Check for Updates...',
          click: () => sendToRenderer('check-updates')
        },
        { type: 'separator' },
        {
          label: 'About Ghost IDE',
          click: () => sendToRenderer('show-about')
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// IPC Handlers
function setupIpcHandlers() {
  // File operations
  ipcMain.handle('dialog:openFile', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: options?.filters || [
        { name: 'Ghost Files', extensions: ['ghost', 'gh'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    return result;
  });

  ipcMain.handle('dialog:openFolder', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory']
    });
    return result;
  });

  ipcMain.handle('dialog:saveFile', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: options?.filters || [
        { name: 'Ghost Files', extensions: ['ghost', 'gh'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    return result;
  });

  ipcMain.handle('dialog:showMessageBox', async (event, options) => {
    const result = await dialog.showMessageBox(mainWindow, options);
    return result;
  });

  // File system operations
  ipcMain.handle('fs:readFile', async (event, filePath) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fs:writeFile', async (event, filePath, content) => {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fs:readDir', async (event, dirPath) => {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      const result = items.map(item => ({
        name: item.name,
        path: path.join(dirPath, item.name),
        isDirectory: item.isDirectory(),
        isFile: item.isFile()
      }));
      return { success: true, items: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fs:mkdir', async (event, dirPath) => {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fs:delete', async (event, filePath) => {
    try {
      await fs.remove(filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fs:rename', async (event, oldPath, newPath) => {
    try {
      await fs.move(oldPath, newPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Project operations
  ipcMain.handle('project:create', async (event, projectPath, projectName, template) => {
    try {
      const fullPath = path.join(projectPath, projectName);
      await fs.mkdir(fullPath, { recursive: true });
      await fs.mkdir(path.join(fullPath, 'src'), { recursive: true });
      await fs.mkdir(path.join(fullPath, 'build'), { recursive: true });
      
      // Create ghost.toml config
      const config = `[project]
name = "${projectName}"
version = "0.1.0"
target = "${store.get('defaultTarget')}"
author = "Ghost Developer"

[build]
opt_level = 2
debug = true

[dependencies]
`;
      await fs.writeFile(path.join(fullPath, 'ghost.toml'), config);
      
      // Create main.ghost from template
      const templateContent = getTemplateContent(template);
      await fs.writeFile(path.join(fullPath, 'src', 'main.ghost'), templateContent);
      
      // Add to recent projects
      addRecentProject(fullPath);
      
      return { success: true, path: fullPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('project:open', async (event, projectPath) => {
    try {
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
        return { success: false, error: 'Not a directory' };
      }
      
      // Check for ghost.toml
      const configPath = path.join(projectPath, 'ghost.toml');
      const hasConfig = await fs.pathExists(configPath);
      
      addRecentProject(projectPath);
      
      return { success: true, path: projectPath, hasConfig };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Ghost compiler operations
  ipcMain.handle('ghost:build', async (event, projectPath, options) => {
    return runGhostCommand(projectPath, 'build', options);
  });

  ipcMain.handle('ghost:run', async (event, projectPath, options) => {
    return runGhostCommand(projectPath, 'run', options);
  });

  ipcMain.handle('ghost:flash', async (event, projectPath, options) => {
    return runGhostCommand(projectPath, 'flash', options);
  });

  ipcMain.handle('ghost:check', async (event, projectPath, options) => {
    return runGhostCommand(projectPath, 'check', options);
  });

  ipcMain.handle('ghost:tokens', async (event, filePath) => {
    return runGhostCommand(path.dirname(filePath), 'tokens', { input: filePath });
  });

  ipcMain.handle('ghost:ast', async (event, filePath) => {
    return runGhostCommand(path.dirname(filePath), 'ast', { input: filePath });
  });

  ipcMain.handle('ghost:ir', async (event, filePath) => {
    return runGhostCommand(path.dirname(filePath), 'ir', { input: filePath });
  });

  ipcMain.handle('ghost:llvm', async (event, filePath) => {
    return runGhostCommand(path.dirname(filePath), 'llvm', { input: filePath });
  });

  ipcMain.handle('ghost:c', async (event, filePath) => {
    return runGhostCommand(path.dirname(filePath), 'c', { input: filePath });
  });

  // Serial port operations
  ipcMain.handle('serial:listPorts', async () => {
    try {
      const ports = await SerialPort.list();
      return { success: true, ports };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('serial:connect', async (event, portPath, baudRate) => {
    return connectSerial(portPath, baudRate);
  });

  ipcMain.handle('serial:disconnect', async () => {
    return disconnectSerial();
  });

  ipcMain.handle('serial:write', async (event, data) => {
    if (serialPort && serialPort.isOpen) {
      return new Promise((resolve) => {
        serialPort.write(data, (err) => {
          if (err) resolve({ success: false, error: err.message });
          else resolve({ success: true });
        });
      });
    }
    return { success: false, error: 'Port not open' };
  });

  // Settings
  ipcMain.handle('settings:get', (event, key) => {
    return store.get(key);
  });

  ipcMain.handle('settings:set', (event, key, value) => {
    store.set(key, value);
    return { success: true };
  });

  ipcMain.handle('settings:getAll', () => {
    return store.store;
  });

  // Recent projects
  ipcMain.handle('projects:getRecent', () => {
    return store.get('recentProjects', []);
  });

  ipcMain.handle('projects:clearRecent', () => {
    store.set('recentProjects', []);
    return { success: true };
  });

  // Window controls
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle('window:close', () => {
    mainWindow?.close();
  });

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow?.isMaximized() || false;
  });

  // Terminal operations (node-pty)
  const ptyInstances = new Map();
  let ptyCounter = 0;

  ipcMain.handle('terminal:spawn', async (event, options) => {
    if (!pty) {
      return { success: false, error: 'node-pty not available' };
    }
    try {
      ptyCounter++;
      const ptyId = `pty-${ptyCounter}`;
      const instance = pty.spawn(options.shell, [], {
        name: 'xterm-color',
        cols: options.cols || 80,
        rows: options.rows || 24,
        cwd: options.cwd || app.getPath('home'),
        env: options.env || process.env
      });
      
      instance.onData((data) => {
        sendToRenderer('terminal:data', { ptyId, data });
      });
      
      instance.onExit(({ exitCode }) => {
        sendToRenderer('terminal:exit', { ptyId, code: exitCode });
      });
      
      ptyInstances.set(ptyId, instance);
      return { success: true, ptyId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('terminal:write', async (event, ptyId, data) => {
    const instance = ptyInstances.get(ptyId);
    if (instance) {
      instance.write(data);
    }
  });

  ipcMain.handle('terminal:resize', async (event, ptyId, cols, rows) => {
    const instance = ptyInstances.get(ptyId);
    if (instance) {
      instance.resize(cols, rows);
    }
  });

  ipcMain.handle('terminal:kill', async (event, ptyId) => {
    const instance = ptyInstances.get(ptyId);
    if (instance) {
      instance.kill();
      ptyInstances.delete(ptyId);
    }
  });

  // Session save handler
  ipcMain.on('session:save', (event, data) => {
    if (data && data.openFiles) {
      store.set('openFiles', data.openFiles);
    }
  });
}

function getTemplateContent(template) {
  const templates = {
    'blank': `# Ghost v0.1 — Blank Project

async task main()
    println("Hello, Ghost!")
`,
    'blink': `# Ghost v0.1 — LED Blink

pull hardware.pins

async task main()
    let led = Pin<GPIO2, Output>::new()
    
    loop
        led.set_high()
        wait 500
        led.set_low()
        wait 500
`,
    'sensor': `# Ghost v0.1 — Sensor Reading

pull hardware.pins
pull hardware.adc

async task main()
    let sensor = ADC<ADC1, Channel0>::new()
    
    loop
        let value = sensor.read()
        println("Sensor value: ", value)
        wait 100
`,
    'edge-ai': `# Ghost v0.1 — Edge AI Inference

pull hardware.pins
pull ai.tensor
pull ai.model

# Model loaded at compile time
#[model(path = "models/gesture.tflite", quant = INT8)]
static MODEL: Model

async task main()
    let input = tensor<f32, [1, 28, 28, 1]>::zeros()
    let output = tensor<f32, [1, 10]>::zeros()
    
    loop
        # Read sensor data into input tensor
        read_sensor_data(input)
        
        # Run inference
        MODEL.infer(input, output)
        
        let prediction = output.argmax()
        println("Prediction: ", prediction)
        
        wait 100
`
  };
  
  return templates[template] || templates['blank'];
}

function addRecentProject(projectPath) {
  const recent = store.get('recentProjects', []);
  const normalizedPath = path.resolve(projectPath);
  
  // Remove if already exists
  const filtered = recent.filter(p => path.resolve(p) !== normalizedPath);
  
  // Add to front
  filtered.unshift(normalizedPath);
  
  // Keep only last 10
  store.set('recentProjects', filtered.slice(0, 10));
}

async function runGhostCommand(projectPath, command, options = {}) {
  const compilerPath = store.get('ghostCompilerPath', 'ghc');
  const args = [command];
  
  if (options.input) {
    args.push(options.input);
  }
  
  if (options.target) {
    args.push('--target', options.target);
  } else {
    args.push('--target', store.get('defaultTarget', 'stm32f411'));
  }
  
  if (options.optLevel) {
    args.push('--opt', options.optLevel.toString());
  }
  
  if (options.emitLlvm) {
    args.push('--emit-llvm');
  }
  
  if (options.emitC) {
    args.push('--emit-c');
  }
  
  return new Promise((resolve) => {
    const proc = spawn(compilerPath, args, {
      cwd: projectPath,
      env: { ...process.env, PATH: process.env.PATH }
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      // Send real-time output to renderer
      sendToRenderer('ghost:output', { type: 'stdout', data: data.toString() });
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      sendToRenderer('ghost:output', { type: 'stderr', data: data.toString() });
    });
    
    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        code,
        stdout,
        stderr
      });
    });
    
    proc.on('error', (err) => {
      resolve({
        success: false,
        error: err.message
      });
    });
    
    // Store process reference for potential cancellation
    ghostProcess = proc;
  });
}

function connectSerial(portPath, baudRate) {
  return new Promise((resolve) => {
    try {
      serialPort = new SerialPort({
        path: portPath,
        baudRate: baudRate || store.get('baudRate', 115200),
        autoOpen: false
      });
      
      serialParser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));
      
      serialPort.open((err) => {
        if (err) {
          resolve({ success: false, error: err.message });
          return;
        }
        
        serialParser.on('data', (data) => {
          sendToRenderer('serial:data', data.toString());
        });
        
        serialPort.on('error', (err) => {
          sendToRenderer('serial:error', err.message);
        });
        
        serialPort.on('close', () => {
          sendToRenderer('serial:disconnected');
        });
        
        store.set('serialPort', portPath);
        store.set('baudRate', baudRate);
        
        resolve({ success: true });
      });
    } catch (error) {
      resolve({ success: false, error: error.message });
    }
  });
}

function disconnectSerial() {
  return new Promise((resolve) => {
    if (serialPort && serialPort.isOpen) {
      serialPort.close((err) => {
        serialPort = null;
        serialParser = null;
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          resolve({ success: true });
        }
      });
    } else {
      resolve({ success: true });
    }
  });
}

function restoreSession() {
  const openFiles = store.get('openFiles', []);
  const lastProject = store.get('lastProject');
  
  if (lastProject && fs.pathExistsSync(lastProject)) {
    sendToRenderer('session:restore', { project: lastProject, files: openFiles });
  }
}

function watchProject(projectPath) {
  if (projectWatcher) {
    projectWatcher.close();
  }
  
  projectWatcher = chokidar.watch(projectPath, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true
  });
  
  projectWatcher.on('all', (event, filePath) => {
    sendToRenderer('project:fileChanged', { event, path: filePath });
  });
}

// App lifecycle
app.whenReady().then(() => {
  createMainWindow();
  setupIpcHandlers();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Save session
  if (mainWindow) {
    sendToRenderer('session:save');
  }
  
  // Clean up
  if (projectWatcher) {
    projectWatcher.close();
  }
  if (serialPort && serialPort.isOpen) {
    serialPort.close();
  }
  if (ghostProcess) {
    ghostProcess.kill();
  }
});

// Security: Prevent navigation to external URLs
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== 'file://') {
      event.preventDefault();
    }
  });
});