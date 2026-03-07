/**
 * Quick Record Service
 * 
 * Creates a fullscreen transparent overlay for capturing mouse positions
 * during quick record mode.
 */

import { BrowserWindow, screen, ipcMain, type IpcMainEvent } from 'electron';
import { getOverlayPreloadPath, loadRendererPage } from '../lib/renderer-path';
import { verifyAuthorizedSender } from '../lib/ipc-guard';
import { hardenBrowserWindow } from '../lib/window-security';

let quickRecordWindow = null;
let resolvePromise = null;
let currentMode = 'move+click';
let mainWindow = null;

/**
 * Get combined bounds of all displays
 */
function getAllDisplaysBounds() {
  const displays = screen.getAllDisplays();
  
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  for (const display of displays) {
    const { x, y, width, height } = display.bounds;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Start quick record mode
 */
export function startQuickRecord(options: any = {}, mainWin: any) {
  return new Promise((resolve, reject) => {
    if (quickRecordWindow) {
      resolve({ cancelled: true });
      return;
    }
    
    mainWindow = mainWin;
    currentMode = options.mode || 'move+click';
    resolvePromise = resolve;
    
    createQuickRecordWindow();
  });
}

/**
 * Stop quick record mode
 */
export function stopQuickRecord() {
  if (quickRecordWindow) {
    quickRecordWindow.close();
    quickRecordWindow = null;
  }
  
  if (resolvePromise) {
    resolvePromise({ cancelled: false });
    resolvePromise = null;
  }
}

/**
 * Update the recording mode
 */
export function updateQuickRecordMode(mode) {
  currentMode = mode;
  if (quickRecordWindow) {
    quickRecordWindow.webContents.send('quick-record:mode-changed', mode);
  }
}

/**
 * Create the quick record overlay window
 */
function createQuickRecordWindow() {
  const bounds = getAllDisplaysBounds();
  
  quickRecordWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    fullscreen: false,
    hasShadow: false,
    enableLargerThanScreen: true,
    webPreferences: {
      preload: getOverlayPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  hardenBrowserWindow(quickRecordWindow, 'quick-record-window');
  
  quickRecordWindow.displayOffset = { x: bounds.x, y: bounds.y };
  quickRecordWindow.setBounds(bounds);
  
  void loadRendererPage(quickRecordWindow, 'quick-record.html');
  
  quickRecordWindow.on('closed', () => {
    quickRecordWindow = null;
    if (resolvePromise) {
      resolvePromise({ cancelled: true });
      resolvePromise = null;
    }
  });
  
  quickRecordWindow.once('ready-to-show', () => {
    quickRecordWindow.webContents.send('quick-record:init', {
      mode: currentMode,
      offset: quickRecordWindow.displayOffset
    });
    quickRecordWindow.focus();
  });
}

/**
 * Initialize IPC handlers for quick record
 */
export function initQuickRecordIPC() {
  ipcMain.removeAllListeners('quick-record:position');
  ipcMain.removeAllListeners('quick-record:sequence-change');
  ipcMain.removeAllListeners('quick-record:stop');

  const allowQuickRecordSender = (event: IpcMainEvent, channel: string): boolean =>
    verifyAuthorizedSender(event, quickRecordWindow, channel);

  ipcMain.on('quick-record:position', (event, data) => {
    if (!allowQuickRecordSender(event, 'quick-record:position')) {
      return;
    }

    if (!quickRecordWindow || !mainWindow) return;
    
    const offset = quickRecordWindow.displayOffset || { x: 0, y: 0 };
    const absoluteX = data.x + offset.x;
    const absoluteY = data.y + offset.y;
    
    // Send position and sequence to main window
    mainWindow.webContents.send('quick-record:position-captured', {
      x: absoluteX,
      y: absoluteY,
      sequence: data.sequence || ['move', 'click']
    });
  });
  
  ipcMain.on('quick-record:sequence-change', (event, sequence) => {
    if (!allowQuickRecordSender(event, 'quick-record:sequence-change')) {
      return;
    }

    // Store sequence if needed for future use
  });
  
  ipcMain.on('quick-record:stop', (event) => {
    if (!allowQuickRecordSender(event, 'quick-record:stop')) {
      return;
    }

    stopQuickRecord();
  });
}

export default {
  start: startQuickRecord,
  stop: stopQuickRecord,
  updateMode: updateQuickRecordMode,
  initIPC: initQuickRecordIPC
};
