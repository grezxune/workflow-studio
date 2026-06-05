/**
 * Workflow Studio - Main Process Entry Point
 */

import {
  app,
  BrowserWindow,
  globalShortcut,
  Menu,
  Tray,
  nativeImage
} from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeIPC, cleanupIPC } from './ipc/index';
import { getSafetyService } from './services/safety';
import { getStorageService } from './services/storage';
import { initRegionSelectorIPC } from './services/region-selector';
import { initAutoUpdater } from './services/auto-updater';
import { getPreloadPath, loadRendererPage } from './lib/renderer-path';
import { configureSessionSecurity, hardenBrowserWindow, openExternalSafely } from './lib/window-security';

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

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#0a0a0a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset'
      : process.platform === 'win32' ? 'hidden'
      : 'default',
    // Windows: hide the native title bar but keep OS-drawn caption buttons
    // (min/max/close) as an overlay so Snap Layouts keep working. Colors blend
    // into the custom titlebar so it reads as borderless.
    titleBarOverlay: process.platform === 'win32'
      ? { color: '#0f1119', symbolColor: '#c8e9f2', height: 52 }
      : false,
    frame: process.platform !== 'darwin',
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    icon: getIconPath(),
    show: false
  });

  hardenBrowserWindow(mainWindow, 'main-window');

  void loadRendererPage(mainWindow, 'index.html');

  const revealWindow = () => {
    if (!mainWindow) return;
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    if (process.env.ELECTRON_RENDERER_URL && !mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.openDevTools();
    }
  };

  mainWindow.once('ready-to-show', revealWindow);
  // Fallback: with titleBarStyle 'hidden' + titleBarOverlay on Windows,
  // 'ready-to-show' can fire late or be skipped, leaving the window hidden
  // (show: false). 'did-finish-load' reliably fires once the renderer loads.
  mainWindow.webContents.once('did-finish-load', revealWindow);

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
  return path.join(__dirname, '../../assets', 'tray-icon.png');
}

function createTray() {
  try {
    let icon;
    const iconPath = getTrayIconPath();
    if (process.platform === 'darwin') {
      icon = nativeImage.createFromPath(iconPath);
    } else {
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
          const { getWorkflowExecutor } = await import('./services/workflow-executor');
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
    panicHotkey: settings.panicHotkey || 'F7',
    pauseHotkey: settings.pauseHotkey || 'F6'
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

  const template: any[] = [
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
            const { getWorkflowExecutor } = await import('./services/workflow-executor');
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
            await openExternalSafely('https://github.com/grez-studios/workflow-studio');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  configureSessionSecurity();

  // Set dock icon on macOS
  if (process.platform === 'darwin') {
    const dockIcon = nativeImage.createFromPath(getIconPath());
    app.dock.setIcon(dockIcon);
  }

  createMenu();
  createWindow();
  createTray();
  initRegionSelectorIPC(() => mainWindow);
  initAutoUpdater(mainWindow);

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
