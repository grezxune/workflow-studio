/**
 * Workflow Preview Overlay Service
 * 
 * Creates a transparent fullscreen overlay that displays all mouse targets,
 * bounding boxes, and click positions from a workflow so the user can verify
 * their screen is set up correctly.
 */

import { BrowserWindow, screen, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let previewWindow = null;
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
 * Extract all visual targets from a workflow
 */
function extractTargets(workflow) {
  const targets = [];
  if (!workflow || !workflow.actions) return targets;

  function processActions(actions, prefix = '') {
    actions.forEach((action, i) => {
      const step = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      const label = action.name || '';

      if (action.type === 'mouse_move') {
        if (action.moveMode === 'bounds' && action.bounds) {
          targets.push({
            type: 'bounds',
            step,
            label,
            actionType: 'mouse_move',
            x: action.bounds.x,
            y: action.bounds.y,
            width: action.bounds.width,
            height: action.bounds.height
          });
        } else if (action.x !== undefined && action.y !== undefined) {
          targets.push({
            type: 'point',
            step,
            label,
            actionType: 'mouse_move',
            x: action.x,
            y: action.y
          });
        }
      } else if (action.type === 'mouse_click') {
        if (action.x !== undefined && action.y !== undefined) {
          targets.push({
            type: 'click',
            step,
            label,
            actionType: 'mouse_click',
            x: action.x,
            y: action.y,
            button: action.button || 'left',
            clickType: action.clickType || 'single'
          });
        }
      }

      // Recurse into nested actions
      if (action.type === 'loop' && action.actions) {
        processActions(action.actions, `${step}L`);
      }
      if (action.type === 'conditional') {
        if (action.thenActions) processActions(action.thenActions, `${step}T`);
        if (action.elseActions) processActions(action.elseActions, `${step}E`);
      }
    });
  }

  processActions(workflow.actions);
  return targets;
}

/**
 * Show the preview overlay
 */
export function showPreviewOverlay(workflow, mainWin) {
  if (previewWindow) {
    closePreviewOverlay();
    return;
  }

  mainWindow = mainWin;
  const bounds = getAllDisplaysBounds();
  const targets = extractTargets(workflow);

  if (targets.length === 0) {
    return { success: false, error: 'No visual targets found in workflow' };
  }

  previewWindow = new BrowserWindow({
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
    focusable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  previewWindow.setIgnoreMouseEvents(true, { forward: true });
  previewWindow.displayOffset = { x: bounds.x, y: bounds.y };
  previewWindow.setBounds(bounds);

  previewWindow.loadFile(path.join(__dirname, '../../renderer/workflow-preview.html'));

  previewWindow.on('closed', () => {
    previewWindow = null;
    if (mainWindow) {
      mainWindow.webContents.send('workflow-preview:closed');
    }
  });

  previewWindow.once('ready-to-show', () => {
    previewWindow.webContents.send('workflow-preview:init', {
      targets,
      offset: previewWindow.displayOffset,
      workflowName: workflow.name || 'Untitled'
    });
  });

  return { success: true, targetCount: targets.length };
}

/**
 * Close the preview overlay
 */
export function closePreviewOverlay() {
  if (previewWindow) {
    previewWindow.close();
    previewWindow = null;
  }
}

/**
 * Check if preview is currently open
 */
export function isPreviewOpen() {
  return previewWindow !== null;
}

/**
 * Initialize IPC handlers
 */
export function initPreviewIPC() {
  ipcMain.on('workflow-preview:close', () => {
    closePreviewOverlay();
  });
}

export default {
  show: showPreviewOverlay,
  close: closePreviewOverlay,
  isOpen: isPreviewOpen,
  initIPC: initPreviewIPC
};
