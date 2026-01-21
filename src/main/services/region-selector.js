/**
 * Region Selector Service
 *
 * Manages the region selection overlay window for screen capture
 */

import { BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDetectionService } from './detection.js';
import { getStorageService } from './storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let selectorWindow = null;
let positionPickerWindow = null;
let resolvePromise = null;
let rejectPromise = null;

/**
 * Show region selection overlay and wait for user to select a region
 * @returns {Promise<{x: number, y: number, width: number, height: number} | null>}
 */
export function selectRegion() {
  return new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;

    createSelectorWindow();
  });
}

/**
 * Show position picker overlay and wait for user to click
 * @returns {Promise<{x: number, y: number} | null>}
 */
export function pickPosition() {
  return new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;

    createPositionPickerWindow();
  });
}

/**
 * Calculate the combined bounds of all displays
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
 * Create the fullscreen transparent selection window spanning all displays
 */
function createSelectorWindow() {
  const bounds = getAllDisplaysBounds();

  selectorWindow = new BrowserWindow({
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
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Store bounds offset for coordinate translation
  selectorWindow.displayOffset = { x: bounds.x, y: bounds.y };

  selectorWindow.loadFile(path.join(__dirname, '../../renderer/region-select.html'));

  selectorWindow.on('closed', () => {
    selectorWindow = null;
    if (resolvePromise) {
      resolvePromise(null);
      resolvePromise = null;
      rejectPromise = null;
    }
  });

  // Focus the window once ready
  selectorWindow.once('ready-to-show', () => {
    selectorWindow.focus();
  });
}

/**
 * Create position picker window spanning all displays
 */
function createPositionPickerWindow() {
  const bounds = getAllDisplaysBounds();

  positionPickerWindow = new BrowserWindow({
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
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  positionPickerWindow.displayOffset = { x: bounds.x, y: bounds.y };

  positionPickerWindow.loadFile(path.join(__dirname, '../../renderer/position-picker.html'));

  positionPickerWindow.on('closed', () => {
    positionPickerWindow = null;
    if (resolvePromise) {
      resolvePromise(null);
      resolvePromise = null;
      rejectPromise = null;
    }
  });

  positionPickerWindow.once('ready-to-show', () => {
    positionPickerWindow.focus();
  });
}

/**
 * Close the selector window
 */
function closeSelectorWindow() {
  if (selectorWindow && !selectorWindow.isDestroyed()) {
    selectorWindow.close();
    selectorWindow = null;
  }
}

/**
 * Close the position picker window
 */
function closePositionPickerWindow() {
  if (positionPickerWindow && !positionPickerWindow.isDestroyed()) {
    positionPickerWindow.close();
    positionPickerWindow = null;
  }
}

/**
 * Initialize IPC handlers for region selection
 */
export function initRegionSelectorIPC() {
  ipcMain.on('region-selected', async (event, region) => {
    // Translate window-relative coordinates to absolute screen coordinates
    const offset = selectorWindow?.displayOffset || { x: 0, y: 0 };
    const absoluteRegion = {
      x: region.x + offset.x,
      y: region.y + offset.y,
      width: region.width,
      height: region.height
    };

    closeSelectorWindow();

    if (resolvePromise) {
      resolvePromise(absoluteRegion);
      resolvePromise = null;
      rejectPromise = null;
    }
  });

  ipcMain.on('region-cancelled', () => {
    closeSelectorWindow();

    if (resolvePromise) {
      resolvePromise(null);
      resolvePromise = null;
      rejectPromise = null;
    }
  });

  // Position picker handlers
  ipcMain.on('position-picked', async (event, position) => {
    const offset = positionPickerWindow?.displayOffset || { x: 0, y: 0 };
    const absolutePosition = {
      x: position.x + offset.x,
      y: position.y + offset.y
    };

    closePositionPickerWindow();

    if (resolvePromise) {
      resolvePromise(absolutePosition);
      resolvePromise = null;
      rejectPromise = null;
    }
  });

  ipcMain.on('position-cancelled', () => {
    closePositionPickerWindow();

    if (resolvePromise) {
      resolvePromise(null);
      resolvePromise = null;
      rejectPromise = null;
    }
  });

  // Handler to pick a position
  ipcMain.handle('pick-screen-position', async () => {
    try {
      const position = await pickPosition();
      return position;
    } catch (error) {
      console.error('Position pick failed:', error);
      return null;
    }
  });

  // Handler to capture a region and save as template
  ipcMain.handle('capture-region-template', async (event, options = {}) => {
    try {
      // First, let user select a region
      const region = await selectRegion();

      if (!region) {
        return { success: false, cancelled: true };
      }

      // Capture the selected region
      const detection = getDetectionService();
      const storage = getStorageService();

      const imageId = options.name || `template-${Date.now()}`;
      const result = await detection.captureTemplate(region, imageId);

      return {
        success: true,
        imageId: result.id,
        path: result.path,
        region: region
      };
    } catch (error) {
      console.error('Region capture failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Handler to just select a region without capturing
  ipcMain.handle('select-screen-region', async () => {
    try {
      const region = await selectRegion();
      return region;
    } catch (error) {
      console.error('Region selection failed:', error);
      return null;
    }
  });
}

export default {
  selectRegion,
  pickPosition,
  initRegionSelectorIPC
};
