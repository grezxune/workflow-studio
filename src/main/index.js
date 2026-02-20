/**
 * Workflow Studio - Main Process Entry Point
 */

import { app, BrowserWindow, globalShortcut, Menu, Tray, nativeImage, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeIPC, cleanupIPC } from './ipc/index.js';
import { getSafetyService } from './services/safety.js';
import { getStorageService } from './services/storage.js';
import { initRegionSelectorIPC } from './services/region-selector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable high DPI support for multi-monitor setups with different scaling (Windows)
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('high-dpi-support', '1');
  app.commandLine.appendSwitch('force-device-scale-factor', '1');
}

// Set app name early (before app ready) for macOS menu bar
if (process.platform === 'darwin') {
  app.setName('Workflow Studio');
}

let mainWindow = null;
let tray = null;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#0a0a0a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    icon: getIconPath(),
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting && process.platform === 'darwin') {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  initializeIPC(mainWindow);
  initializeSafety();

  return mainWindow;
}

function getIconPath() {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  return path.join(__dirname, '../../assets', iconName);
}

function getTrayIconPath() {
  if (process.platform === 'darwin') {
    // macOS uses template images, return path without extension
    return path.join(__dirname, '../../assets', 'tray-iconTemplate');
  }
  return path.join(__dirname, '../../assets', 'tray-icon.png');
}

function createTray() {
  try {
    let icon;
    if (process.platform === 'darwin') {
      // For macOS, use the tray icon with @2x for retina
      const iconPath = path.join(__dirname, '../../assets', 'tray-icon.png');
      icon = nativeImage.createFromPath(iconPath);
    } else {
      const iconPath = getIconPath();
      icon = nativeImage.createFromPath(iconPath);
      icon = icon.resize({ width: 16, height: 16 });
    }
    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Workflow Studio',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Emergency Stop (F7)',
        click: async () => {
          const { getWorkflowExecutor } = await import('./services/workflow-executor.js');
          await getWorkflowExecutor().emergencyStop();
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setToolTip('Workflow Studio');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.warn('Could not create tray icon:', err);
  }
}

function initializeSafety() {
  const safety = getSafetyService();
  const storage = getStorageService();
  const settings = storage.getSettings();

  safety.initialize({
    panicHotkey: settings.panicHotkey || 'F7'
  });

  safety.on('panic:triggered', ({ source }) => {
    console.log(`Panic triggered from: ${source}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('safety:panic-triggered', { source });
    }
  });
}

function createMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: 'Workflow Studio',
      submenu: [
        { role: 'about', label: 'About Workflow Studio' },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'Cmd+,',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('navigate', '/settings');
            }
          }
        },
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
    {
      label: 'File',
      submenu: [
        {
          label: 'New Workflow',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('action', 'new-workflow');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Import Workflow...',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('action', 'import-workflow');
            }
          }
        },
        {
          label: 'Export Workflow...',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('action', 'export-workflow');
            }
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
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
    {
      label: 'Workflow',
      submenu: [
        {
          label: 'Run',
          accelerator: 'F5',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('action', 'run-workflow');
            }
          }
        },
        {
          label: 'Dry Run',
          accelerator: 'F9',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('action', 'dry-run-workflow');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Pause',
          accelerator: 'F6',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('action', 'pause-workflow');
            }
          }
        },
        {
          label: 'Emergency Stop',
          accelerator: 'F7',
          click: async () => {
            const { getWorkflowExecutor } = await import('./services/workflow-executor.js');
            await getWorkflowExecutor().emergencyStop();
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            await shell.openExternal('https://github.com/grez-studios/workflow-studio');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  // Set dock icon on macOS
  if (process.platform === 'darwin') {
    const dockIcon = nativeImage.createFromPath(getIconPath());
    app.dock.setIcon(dockIcon);
  }

  createMenu();
  createWindow();
  createTray();
  initRegionSelectorIPC();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  cleanupIPC();
  globalShortcut.unregisterAll();
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});
