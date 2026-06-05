/**
 * Floating Execution Bar Service
 *
 * Creates and manages an always-on-top, frameless, draggable native window
 * that shows execution status even when the main window is not focused.
 */

import { BrowserWindow, ipcMain, screen, type IpcMainEvent } from 'electron';
import { getOverlayPreloadPath, loadRendererPage } from '../lib/renderer-path';
import { verifyAuthorizedSender } from '../lib/ipc-guard';
import { hardenBrowserWindow } from '../lib/window-security';
import { getStorageService } from './storage';

let floatingWindow = null;
let mainWindow = null;
const FLOATING_BAR_WIDTH = 900;
const FLOATING_BAR_HEIGHT = 188;
const FLOATING_BAR_MIN_WIDTH = 360;
const FLOATING_BAR_MIN_HEIGHT = 172;
let floatingBarBounds: any = null;
let persistBoundsTimeout: any = null;

/**
 * Show the floating bar window
 */
export function showFloatingBar(mainWin) {
  mainWindow = mainWin;

  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.show();
    return;
  }

  // Position at bottom-center of the primary display
  const storage = getStorageService();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;
  const defaultBounds = {
    width: FLOATING_BAR_WIDTH,
    height: FLOATING_BAR_HEIGHT,
    x: Math.round((screenW - FLOATING_BAR_WIDTH) / 2),
    y: screenH - FLOATING_BAR_HEIGHT - 28
  };
  const storedBounds = storage.getSetting('floatingBarBounds');
  const bounds = sanitizeFloatingBarBounds(floatingBarBounds || storedBounds, defaultBounds);

  floatingWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: FLOATING_BAR_MIN_WIDTH,
    minHeight: FLOATING_BAR_MIN_HEIGHT,
    // Fully custom, frameless window: no native title bar or border, so the
    // branded bar can fill the window all the way to every edge. Dragging is
    // handled in the page via -webkit-app-region.
    frame: false,
    transparent: false,
    title: 'Workflow Runner',
    autoHideMenuBar: true,
    backgroundColor: '#0d111a',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    closable: false,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      preload: getOverlayPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  hardenBrowserWindow(floatingWindow, 'floating-bar-window');

  floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  void loadRendererPage(floatingWindow, 'floating-bar.html');

  floatingWindow.on('resize', () => {
    if (!floatingWindow || floatingWindow.isDestroyed()) return;
    floatingBarBounds = floatingWindow.getBounds();
    persistFloatingBarBounds();
  });

  floatingWindow.on('move', () => {
    if (!floatingWindow || floatingWindow.isDestroyed()) return;
    floatingBarBounds = floatingWindow.getBounds();
    persistFloatingBarBounds();
  });

  floatingWindow.on('closed', () => {
    persistFloatingBarBounds(true);
    floatingWindow = null;
  });
}

/**
 * Hide the floating bar window
 */
export function hideFloatingBar() {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.hide();
  }
}

/**
 * Close and destroy the floating bar window
 */
export function closeFloatingBar() {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    persistFloatingBarBounds(true);
    floatingWindow.destroy();
    floatingWindow = null;
  }
}

function persistFloatingBarBounds(flush = false) {
  const save = () => {
    if (!floatingBarBounds) return;
    getStorageService().setSetting('floatingBarBounds', floatingBarBounds);
  };

  if (flush) {
    if (persistBoundsTimeout) {
      clearTimeout(persistBoundsTimeout);
      persistBoundsTimeout = null;
    }
    save();
    return;
  }

  if (persistBoundsTimeout) {
    clearTimeout(persistBoundsTimeout);
  }
  persistBoundsTimeout = setTimeout(() => {
    persistBoundsTimeout = null;
    save();
  }, 150);
}

function sanitizeFloatingBarBounds(bounds, fallback) {
  if (!bounds || typeof bounds !== 'object') {
    return fallback;
  }

  const width = Math.max(FLOATING_BAR_MIN_WIDTH, Number(bounds.width) || fallback.width);
  const height = Math.max(FLOATING_BAR_MIN_HEIGHT, Number(bounds.height) || fallback.height);
  const x = Number.isFinite(bounds.x) ? bounds.x : fallback.x;
  const y = Number.isFinite(bounds.y) ? bounds.y : fallback.y;

  return { x, y, width, height };
}

/**
 * Send data to the floating bar window
 */
export function sendToFloatingBar(channel, data) {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.webContents.send(channel, data);
  }
}

/**
 * Check if the floating bar is currently visible
 */
export function isFloatingBarVisible() {
  return floatingWindow && !floatingWindow.isDestroyed() && floatingWindow.isVisible();
}

/**
 * Initialize IPC handlers for floating bar button actions
 */
export function initFloatingBarIPC() {
  ipcMain.removeAllListeners('floating-bar:pause');
  ipcMain.removeAllListeners('floating-bar:stop');
  ipcMain.removeAllListeners('floating-bar:expand');
  ipcMain.removeAllListeners('floating-bar:reset-variable');
  ipcMain.removeAllListeners('floating-bar:set-stop-time');
  ipcMain.removeAllListeners('floating-bar:clear-stop-time');

  const allowFloatingSender = (event: IpcMainEvent, channel: string): boolean =>
    verifyAuthorizedSender(event, floatingWindow, channel);

  ipcMain.on('floating-bar:pause', (event) => {
    if (!allowFloatingSender(event, 'floating-bar:pause')) {
      return;
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('floating-bar:pause-clicked');
    }
  });

  ipcMain.on('floating-bar:stop', (event) => {
    if (!allowFloatingSender(event, 'floating-bar:stop')) {
      return;
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('floating-bar:stop-clicked');
    }
  });

  ipcMain.on('floating-bar:expand', (event) => {
    if (!allowFloatingSender(event, 'floating-bar:expand')) {
      return;
    }

    hideFloatingBar();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('floating-bar:expand-clicked');
      mainWindow.show();
      mainWindow.focus();
    }
  });

  ipcMain.on('floating-bar:reset-variable', (event, variableId) => {
    if (!allowFloatingSender(event, 'floating-bar:reset-variable')) {
      return;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('floating-bar:reset-variable-clicked', { variableId });
    }
  });

  ipcMain.on('floating-bar:set-stop-time', (event, data) => {
    if (!allowFloatingSender(event, 'floating-bar:set-stop-time')) {
      return;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('floating-bar:set-stop-time-clicked', data);
    }
  });

  ipcMain.on('floating-bar:clear-stop-time', (event) => {
    if (!allowFloatingSender(event, 'floating-bar:clear-stop-time')) {
      return;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('floating-bar:clear-stop-time-clicked');
    }
  });
}

export default {
  showFloatingBar,
  hideFloatingBar,
  closeFloatingBar,
  sendToFloatingBar,
  isFloatingBarVisible,
  initFloatingBarIPC
};
