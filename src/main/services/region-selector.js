/**
 * Region Selector Service
 *
 * Manages the region selection overlay window for screen capture
 */

import { BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDetectionService } from './detection.js';
import { getStorageService } from './storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let selectorWindow = null;
let positionPickerWindow = null;
let previewWindow = null;
let resolvePromise = null;
let rejectPromise = null;
let previewResolve = null;

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
 * Uses physical pixel coordinates to properly span all monitors
 */
function getAllDisplaysBounds() {
  const displays = screen.getAllDisplays();

  console.log('[RegionSelector] Calculating bounds for displays:', displays.map(d => ({
    id: d.id,
    bounds: d.bounds,
    scaleFactor: d.scaleFactor
  })));

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const display of displays) {
    const { x, y, width, height } = display.bounds;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  }

  const bounds = {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };

  console.log('[RegionSelector] Combined bounds:', bounds);

  return bounds;
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
    enableLargerThanScreen: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Store bounds offset for coordinate translation
  selectorWindow.displayOffset = { x: bounds.x, y: bounds.y };

  // Explicitly set bounds after creation to ensure proper multi-monitor coverage
  selectorWindow.setBounds(bounds);

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
    enableLargerThanScreen: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  positionPickerWindow.displayOffset = { x: bounds.x, y: bounds.y };

  // Explicitly set bounds after creation to ensure proper multi-monitor coverage
  positionPickerWindow.setBounds(bounds);

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
 * Close the preview window
 */
function closePreviewWindow() {
  if (previewWindow && !previewWindow.isDestroyed()) {
    previewWindow.close();
    previewWindow = null;
  }
}

/**
 * Show a preview window with the captured image and return user decision
 * @param {string} imagePath - Path to the captured image file
 * @param {{x,y,width,height}} region - The captured region dimensions
 * @param {string} defaultName - Default name for the image
 * @returns {Promise<{decision: 'confirm'|'redo'|'cancel', name?: string}>}
 */
function showCapturePreview(imagePath, region, defaultName) {
  return new Promise((resolve) => {
    previewResolve = resolve;

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;
    const winW = Math.min(800, screenW - 100);
    const winH = Math.min(600, screenH - 100);

    previewWindow = new BrowserWindow({
      width: winW,
      height: winH,
      x: Math.round((screenW - winW) / 2),
      y: Math.round((screenH - winH) / 2),
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    previewWindow.loadFile(path.join(__dirname, '../../renderer/capture-preview.html'));

    previewWindow.webContents.once('did-finish-load', () => {
      previewWindow.webContents.send('preview-image-data', {
        imagePath: imagePath.replace(/\\/g, '/'),
        region,
        defaultName
      });
    });

    previewWindow.on('closed', () => {
      previewWindow = null;
      if (previewResolve) {
        previewResolve({ decision: 'cancel' });
        previewResolve = null;
      }
    });
  });
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

  // Preview window handlers
  ipcMain.on('capture-preview-confirm', (event, data) => {
    closePreviewWindow();
    if (previewResolve) {
      previewResolve({ decision: 'confirm', name: data?.name });
      previewResolve = null;
    }
  });

  ipcMain.on('capture-preview-redo', () => {
    closePreviewWindow();
    if (previewResolve) {
      previewResolve({ decision: 'redo' });
      previewResolve = null;
    }
  });

  ipcMain.on('capture-preview-cancel', () => {
    closePreviewWindow();
    if (previewResolve) {
      previewResolve({ decision: 'cancel' });
      previewResolve = null;
    }
  });

  // Handler to capture a region and save as template (with preview/redo loop)
  ipcMain.handle('capture-region-template', async (event, options = {}) => {
    try {
      const detection = getDetectionService();

      while (true) {
        // Let user select a region
        const region = await selectRegion();

        if (!region) {
          return { success: false, cancelled: true };
        }

        // Small delay to ensure overlay is fully gone before capturing
        await new Promise(r => setTimeout(r, 150));

        // Capture the selected region to a temp file for preview
        const tempId = `preview-temp-${Date.now()}`;
        const result = await detection.captureTemplate(region, tempId);

        // Show preview and wait for user decision
        const defaultName = options.name || `template-${Date.now()}`;
        const { decision, name: userChosenName } = await showCapturePreview(result.path, region, defaultName);

        if (decision === 'confirm') {
          // Rename temp file to final name using user-provided name
          const storage = getStorageService();
          const imageId = userChosenName || defaultName;
          const finalPath = storage.getImagePath(imageId);

          if (result.path !== finalPath) {
            fs.renameSync(result.path, finalPath);
          }

          return {
            success: true,
            imageId: imageId,
            path: finalPath,
            region: region
          };
        } else if (decision === 'redo') {
          // Clean up temp file and loop again
          try { fs.unlinkSync(result.path); } catch (e) { /* ignore */ }
          continue;
        } else {
          // Cancel - clean up temp file
          try { fs.unlinkSync(result.path); } catch (e) { /* ignore */ }
          return { success: false, cancelled: true };
        }
      }
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
