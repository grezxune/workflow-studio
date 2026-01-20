const { app, BrowserWindow, ipcMain, globalShortcut, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const Store = require('electron-store');

const store = new Store();
let mainWindow;
const runningProcesses = new Map();
const registeredHotkeys = new Map();
const hotkeyLastFired = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'default',
    backgroundColor: '#1a1a2e',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  loadSavedHotkeys();

  // Register a test hotkey to verify global shortcuts work
  const testAccelerator = 'Ctrl+Shift+T';
  const testRegistered = globalShortcut.register(testAccelerator, () => {
    console.log('TEST HOTKEY TRIGGERED! Global shortcuts are working.');
  });
  console.log(`Test hotkey (${testAccelerator}) registered: ${testRegistered}`);

  // Log all registered shortcuts for debugging
  setInterval(() => {
    const hotkeys = store.get('hotkeys', []);
    hotkeys.forEach(hk => {
      const accelerator = keysToAccelerator(hk.keys);
      const isRegistered = globalShortcut.isRegistered(accelerator);
      console.log(`Hotkey ${accelerator} registered: ${isRegistered}`);
    });
  }, 10000);
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  runningProcesses.forEach((proc) => proc.kill());
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

function getScriptsPath() {
  const customPath = store.get('scriptsDir');
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }
  return path.join(app.getAppPath(), 'scripts');
}

function getScriptType(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.py': return 'py';
    case '.js': return 'js';
    case '.lua': return 'lua';
    default: return null;
  }
}

function getScriptCommand(scriptType) {
  const commands = store.get('commands', {});
  const defaults = {
    py: 'python3',
    js: 'node',
    lua: 'lua'
  };

  return commands[scriptType] || defaults[scriptType] || null;
}

function loadSavedHotkeys() {
  const hotkeys = store.get('hotkeys', []);
  hotkeys.forEach(hk => registerGlobalHotkey(hk));
}

function registerGlobalHotkey(hotkeyConfig) {
  const { id, keys, text, pressEnter } = hotkeyConfig;
  const accelerator = keysToAccelerator(keys);

  console.log('Registering hotkey:', accelerator, 'for text:', text);

  if (registeredHotkeys.has(id)) {
    const oldAccelerator = registeredHotkeys.get(id);
    console.log('Unregistering old hotkey:', oldAccelerator);
    globalShortcut.unregister(oldAccelerator);
  }

  try {
    const success = globalShortcut.register(accelerator, () => {
      // Debounce: only fire once per 300ms to prevent repeat triggering
      const now = Date.now();
      const lastFired = hotkeyLastFired.get(id) || 0;
      if (now - lastFired < 300) {
        return;
      }
      hotkeyLastFired.set(id, now);

      console.log('Hotkey triggered:', accelerator);
      typeText(text, pressEnter, id, accelerator);
    });

    if (success) {
      console.log('Hotkey registered successfully:', accelerator);
      registeredHotkeys.set(id, accelerator);
      return true;
    } else {
      console.log('Hotkey registration failed (already in use?):', accelerator);
    }
  } catch (e) {
    console.error('Failed to register hotkey:', e);
  }
  return false;
}

function keysToAccelerator(keys) {
  const keyMap = {
    'Control': 'Ctrl',
    'Meta': 'Command',
    'ArrowUp': 'Up',
    'ArrowDown': 'Down',
    'ArrowLeft': 'Left',
    'ArrowRight': 'Right'
  };

  return keys.map(k => keyMap[k] || k).join('+');
}

function typeText(text, pressEnter, hotkeyId, accelerator) {
  console.log('Typing text:', text, 'pressEnter:', pressEnter);

  // Temporarily unregister the hotkey to prevent interference
  if (accelerator) {
    globalShortcut.unregister(accelerator);
  }

  if (process.platform === 'darwin') {
    // macOS: Use AppleScript
    const escapedText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const script = `
      tell application "System Events"
        keystroke "${escapedText}"
        ${pressEnter ? 'keystroke return' : ''}
      end tell
    `;
    const proc = spawn('osascript', ['-e', script]);
    proc.on('close', () => {
      // Re-register the hotkey after typing completes
      if (accelerator && hotkeyId) {
        reRegisterHotkey(hotkeyId);
      }
    });
  } else {
    // Windows: Use PowerShell
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.SendKeys]::SendWait('${text.replace(/'/g, "''").replace(/[+^%~(){}[\]]/g, '{$&}')}')
      ${pressEnter ? "[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')" : ''}
    `;
    const proc = spawn('powershell', ['-Command', script], { shell: true });
    proc.on('close', () => {
      // Re-register the hotkey after typing completes
      if (accelerator && hotkeyId) {
        reRegisterHotkey(hotkeyId);
      }
    });
  }
}

function reRegisterHotkey(id) {
  const hotkeys = store.get('hotkeys', []);
  const hotkeyConfig = hotkeys.find(h => h.id === id);
  if (hotkeyConfig) {
    registerGlobalHotkey(hotkeyConfig);
  }
}

// IPC Handlers
ipcMain.handle('get-scripts', async () => {
  const scriptsPath = getScriptsPath();

  if (!fs.existsSync(scriptsPath)) {
    fs.mkdirSync(scriptsPath, { recursive: true });
    return [];
  }

  const files = fs.readdirSync(scriptsPath)
    .filter(f => {
      const type = getScriptType(f);
      return type !== null;
    })
    .map(f => ({
      name: f,
      path: path.join(scriptsPath, f),
      type: getScriptType(f),
      running: runningProcesses.has(f)
    }));

  return files;
});

ipcMain.handle('start-script', async (event, scriptName) => {
  const scriptPath = path.join(getScriptsPath(), scriptName);
  const scriptType = getScriptType(scriptName);
  const command = getScriptCommand(scriptType);

  if (!command) {
    return { success: false, error: 'Unsupported script type' };
  }

  if (runningProcesses.has(scriptName)) {
    return { success: false, error: 'Script already running' };
  }

  try {
    const proc = spawn(command, [scriptPath], {
      cwd: getScriptsPath(),
      shell: true
    });

    runningProcesses.set(scriptName, proc);

    proc.stdout.on('data', (data) => {
      mainWindow?.webContents.send('script-output', { script: scriptName, data: data.toString() });
    });

    proc.stderr.on('data', (data) => {
      mainWindow?.webContents.send('script-error', { script: scriptName, data: data.toString() });
    });

    proc.on('close', (code) => {
      runningProcesses.delete(scriptName);
      mainWindow?.webContents.send('script-stopped', { script: scriptName, code });
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('stop-script', async (event, scriptName) => {
  const proc = runningProcesses.get(scriptName);
  if (proc) {
    proc.kill();
    runningProcesses.delete(scriptName);
    return { success: true };
  }
  return { success: false, error: 'Script not running' };
});

ipcMain.handle('get-hotkeys', () => {
  return store.get('hotkeys', []);
});

ipcMain.handle('save-hotkey', (event, hotkeyConfig) => {
  const hotkeys = store.get('hotkeys', []);
  const existingIndex = hotkeys.findIndex(h => h.id === hotkeyConfig.id);

  if (existingIndex >= 0) {
    hotkeys[existingIndex] = hotkeyConfig;
  } else {
    hotkeys.push(hotkeyConfig);
  }

  store.set('hotkeys', hotkeys);
  const success = registerGlobalHotkey(hotkeyConfig);
  return { success };
});

ipcMain.handle('delete-hotkey', (event, id) => {
  const hotkeys = store.get('hotkeys', []);
  const filtered = hotkeys.filter(h => h.id !== id);
  store.set('hotkeys', filtered);

  if (registeredHotkeys.has(id)) {
    globalShortcut.unregister(registeredHotkeys.get(id));
    registeredHotkeys.delete(id);
  }

  return { success: true };
});

ipcMain.handle('open-scripts-folder', () => {
  const scriptsPath = getScriptsPath();
  if (!fs.existsSync(scriptsPath)) {
    fs.mkdirSync(scriptsPath, { recursive: true });
  }
  require('electron').shell.openPath(scriptsPath);
});

// Settings handlers
ipcMain.handle('get-settings', () => {
  return {
    scriptsDir: store.get('scriptsDir', ''),
    commands: store.get('commands', {})
  };
});

ipcMain.handle('save-settings', (event, settings) => {
  try {
    // Save scripts directory
    if (settings.scriptsDir) {
      if (!fs.existsSync(settings.scriptsDir)) {
        return { success: false, error: 'Directory does not exist' };
      }
      store.set('scriptsDir', settings.scriptsDir);
    } else {
      store.delete('scriptsDir');
    }

    // Save commands (only non-empty ones)
    if (settings.commands) {
      const commands = {};
      for (const [type, cmd] of Object.entries(settings.commands)) {
        if (cmd) {
          commands[type] = cmd;
        }
      }
      if (Object.keys(commands).length > 0) {
        store.set('commands', commands);
      } else {
        store.delete('commands');
      }
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('browse-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Scripts Directory'
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});
