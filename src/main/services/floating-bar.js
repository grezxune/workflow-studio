/**
 * Floating Execution Bar Service
 *
 * Creates and manages an always-on-top, frameless, draggable native window
 * that shows execution status even when the main window is not focused.
 */

import { BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let floatingWindow = null;
let mainWindow = null;

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
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;
  const barWidth = 380;
  const barHeight = 60;
  const x = Math.round((screenW - barWidth) / 2);
  const y = screenH - barHeight - 20;

  floatingWindow = new BrowserWindow({
    x,
    y,
    width: barWidth,
    height: barHeight,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  floatingWindow.loadFile(path.join(__dirname, '../../renderer/floating-bar.html'));

  floatingWindow.on('closed', () => {
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
    floatingWindow.destroy();
    floatingWindow = null;
  }
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
  ipcMain.on('floating-bar:pause', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('floating-bar:pause-clicked');
    }
  });

  ipcMain.on('floating-bar:stop', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('floating-bar:stop-clicked');
    }
  });

  ipcMain.on('floating-bar:expand', () => {
    hideFloatingBar();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('floating-bar:expand-clicked');
      mainWindow.show();
      mainWindow.focus();
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
