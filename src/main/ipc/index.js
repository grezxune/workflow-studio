/**
 * IPC Handlers
 *
 * Bridge between main process and renderer
 */

import fs from 'fs';
import { ipcMain, dialog } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants.js';
import { getStorageService } from '../services/storage.js';
import { getWorkflowExecutor } from '../services/workflow-executor.js';
import { getSafetyService } from '../services/safety.js';
import { getDetectionService } from '../services/detection.js';
import { getMouseController } from '../services/mouse-controller.js';
import { getPermissionStatus, requestAccessibilityPermission } from '../lib/permissions.js';
import quickRecord from '../services/quick-record.js';
import workflowPreview from '../services/workflow-preview.js';
import floatingBar from '../services/floating-bar.js';
import { initHotkeyService, getHotkeys, setHotkey, removeHotkey } from '../services/hotkey-service.js';

let mainWindow = null;

export function initializeIPC(window) {
  mainWindow = window;

  const storage = getStorageService();
  const executor = getWorkflowExecutor({
    detectionService: getDetectionService()
  });
  const safety = getSafetyService();
  const detection = getDetectionService();

  // Load stored settings into live service instances
  const storedSettings = storage.getSettings();
  try {
    const mouse = getMouseController();
    if (mouse) mouse.updateSettings(storedSettings);
  } catch (e) {}
  try {
    if (detection) detection.updateSettings(storedSettings);
  } catch (e) {}

  safety.onPanic(async (source) => {
    await executor.emergencyStop();
    sendToRenderer(IPC_CHANNELS.EXECUTION_STOPPED, { source });
  });

  safety.onPause((source) => {
    const status = executor.getStatus();
    if (status.state === 'running') {
      executor.pause();
      sendToRenderer(IPC_CHANNELS.EXECUTION_PAUSED, { source });
    } else if (status.state === 'paused') {
      executor.resume();
      sendToRenderer(IPC_CHANNELS.EXECUTION_RESUMED, { source });
    }
  });

  setupExecutorEvents(executor);
  registerWorkflowHandlers(storage);
  registerExecutionHandlers(executor);
  registerSettingsHandlers(storage);
  registerDetectionHandlers(detection);
  registerSafetyHandlers(safety);
  registerUtilityHandlers();
  registerTemplateHandlers(storage);
  registerQuickRecordHandlers();
  registerPreviewHandlers();
  registerFloatingBarHandlers();
  floatingBar.initFloatingBarIPC();
  registerHotkeyHandlers();
  initHotkeyService(mainWindow);
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function setupExecutorEvents(executor) {
  executor.on('workflow:start', (data) => {
    sendToRenderer(IPC_CHANNELS.EXECUTION_STARTED, data);
  });

  executor.on('workflow:complete', (data) => {
    sendToRenderer(IPC_CHANNELS.EXECUTION_COMPLETED, data);
    floatingBar.closeFloatingBar();
  });

  executor.on('workflow:stopped', (data) => {
    sendToRenderer(IPC_CHANNELS.EXECUTION_STOPPED, data);
    floatingBar.closeFloatingBar();
  });

  executor.on('workflow:error', (data) => {
    sendToRenderer(IPC_CHANNELS.EXECUTION_ERROR, { error: data.error.message });
    floatingBar.closeFloatingBar();
  });

  executor.on('workflow:paused', () => {
    sendToRenderer(IPC_CHANNELS.EXECUTION_PAUSED, {});
  });

  executor.on('workflow:resumed', () => {
    sendToRenderer(IPC_CHANNELS.EXECUTION_RESUMED, {});
  });

  executor.on('action:start', (data) => {
    sendToRenderer(IPC_CHANNELS.ACTION_STARTED, data);
    // Forward to floating bar
    const actionType = data.action?.type || 'unknown';
    const actionNames = { mouse_move: 'Mouse Move', click: 'Click', keyboard: 'Keyboard', wait: 'Wait', loop: 'Loop', conditional: 'Conditional', image_detect: 'Image Detect', pixel_detect: 'Pixel Detect' };
    const name = actionNames[actionType] || actionType;
    floatingBar.sendToFloatingBar('floating-bar:update-action', {
      text: `${name} (${data.index + 1}/${data.total})`
    });
    if (actionType !== 'wait') {
      floatingBar.sendToFloatingBar('floating-bar:wait-hide');
    }
  });

  executor.on('action:complete', (data) => {
    sendToRenderer(IPC_CHANNELS.ACTION_COMPLETED, data);
  });

  executor.on('action:error', (data) => {
    sendToRenderer(IPC_CHANNELS.ACTION_ERROR, { ...data, error: data.error.message });
  });

  executor.on('wait:start', (data) => {
    sendToRenderer('wait:start', data);
    floatingBar.sendToFloatingBar('floating-bar:wait-start', { duration: data.duration });
  });

  executor.on('wait:tick', (data) => {
    sendToRenderer('wait:tick', data);
    floatingBar.sendToFloatingBar('floating-bar:wait-tick', data);
  });

  executor.on('loop:start', (data) => {
    sendToRenderer(IPC_CHANNELS.LOOP_STARTED, data);
  });

  executor.on('loop:end', (data) => {
    sendToRenderer(IPC_CHANNELS.LOOP_COMPLETED, data);
  });

  executor.on('state:change', (data) => {
    sendToRenderer(IPC_CHANNELS.EXECUTION_STATE_CHANGED, data);
  });
}

function registerWorkflowHandlers(storage) {
  ipcMain.handle(IPC_CHANNELS.GET_WORKFLOWS, async () => {
    try {
      console.log('[IPC] GET_WORKFLOWS called');
      const workflows = storage.getAllWorkflows();
      console.log('[IPC] Returning', workflows.length, 'workflows');
      return workflows;
    } catch (error) {
      console.error('[IPC] GET_WORKFLOWS error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_WORKFLOW, async (event, id) => {
    return storage.getWorkflow(id);
  });

  ipcMain.handle(IPC_CHANNELS.CREATE_WORKFLOW, async (event, data) => {
    return storage.createWorkflow(data);
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_WORKFLOW, async (event, { id, updates }) => {
    return storage.updateWorkflow(id, updates);
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_WORKFLOW, async (event, id) => {
    return storage.deleteWorkflow(id);
  });

  ipcMain.handle(IPC_CHANNELS.DUPLICATE_WORKFLOW, async (event, id) => {
    return storage.duplicateWorkflow(id);
  });

  ipcMain.handle(IPC_CHANNELS.EXPORT_WORKFLOW, async (event, id) => {
    const json = storage.exportWorkflow(id);
    if (!json) return null;

    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Workflow',
      defaultPath: `workflow-${id}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (filePath) {
      fs.writeFileSync(filePath, json, 'utf-8');
      return filePath;
    }
    return null;
  });

  ipcMain.handle(IPC_CHANNELS.IMPORT_WORKFLOW, async () => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Workflow',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    });

    if (filePaths && filePaths.length > 0) {
      const json = fs.readFileSync(filePaths[0], 'utf-8');
      return storage.importWorkflow(json);
    }
    return null;
  });

  ipcMain.handle(IPC_CHANNELS.GET_RECENT_WORKFLOWS, async () => {
    return storage.getRecentWorkflows();
  });
}

function registerExecutionHandlers(executor) {
  ipcMain.handle(IPC_CHANNELS.EXECUTE_WORKFLOW, async (event, { workflow, options }) => {
    console.log('[IPC] EXECUTE_WORKFLOW received');
    console.log('[IPC] Options:', JSON.stringify(options));
    try {
      await executor.execute(workflow, options);
      return { success: true };
    } catch (error) {
      console.error('[IPC] Execute error:', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PAUSE_EXECUTION, async () => {
    executor.pause();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.RESUME_EXECUTION, async () => {
    executor.resume();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.STOP_EXECUTION, async () => {
    executor.stop();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.EMERGENCY_STOP, async () => {
    await executor.emergencyStop();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.GET_EXECUTION_STATUS, async () => {
    return executor.getStatus();
  });
}

function registerSettingsHandlers(storage) {
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async () => {
    return storage.getSettings();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_SETTINGS, async (event, updates) => {
    const result = storage.updateSettings(updates);
    
    // Propagate to live service instances
    try {
      const mouse = getMouseController();
      if (mouse) mouse.updateSettings(updates);
    } catch (e) {}
    try {
      const detection = getDetectionService();
      if (detection) detection.updateSettings(updates);
    } catch (e) {}
    
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.GET_SETTING, async (event, key) => {
    return storage.getSetting(key);
  });

  ipcMain.handle(IPC_CHANNELS.SET_SETTING, async (event, { key, value }) => {
    storage.setSetting(key, value);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SELECT_DIRECTORY, async (event, options = {}) => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: options.title || 'Select Directory',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: options.defaultPath
    });

    return filePaths && filePaths.length > 0 ? filePaths[0] : null;
  });

  ipcMain.handle(IPC_CHANNELS.GET_WORKFLOWS_DIR, async () => {
    return storage.getWorkflowsDir();
  });
}

function registerDetectionHandlers(detection) {
  ipcMain.handle(IPC_CHANNELS.CAPTURE_SCREEN, async (event, options = {}) => {
    return await detection.captureScreen(options.region);
  });

  ipcMain.handle(IPC_CHANNELS.CAPTURE_REGION, async (event, { region, name }) => {
    return await detection.captureTemplate(region, name);
  });

  ipcMain.handle(IPC_CHANNELS.FIND_IMAGE, async (event, { imageId, options }) => {
    return await detection.findImage(imageId, options);
  });

  ipcMain.handle(IPC_CHANNELS.FIND_PIXEL, async (event, { color, options }) => {
    return await detection.findPixel(color, options);
  });

  ipcMain.handle(IPC_CHANNELS.GET_PIXEL_COLOR, async (event, { x, y }) => {
    return await detection.getPixelColor(x, y);
  });

  ipcMain.handle(IPC_CHANNELS.GET_SCREEN_SIZE, async () => {
    return await detection.getScreenSize();
  });

  const storage = getStorageService();

  ipcMain.handle(IPC_CHANNELS.GET_IMAGES, async () => {
    return storage.getAllImages();
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_IMAGE, async (event, id) => {
    return storage.deleteImage(id);
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_IMAGE, async (event, { id, buffer }) => {
    return storage.saveImage(id, Buffer.from(buffer));
  });
}

function registerSafetyHandlers(safety) {
  ipcMain.handle(IPC_CHANNELS.SET_PANIC_HOTKEY, async (event, hotkey) => {
    safety.setPanicHotkey(hotkey);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SET_PAUSE_HOTKEY, async (event, hotkey) => {
    safety.setPauseHotkey(hotkey);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.GET_SAFETY_CONFIG, async () => {
    return safety.getConfig();
  });

  ipcMain.handle(IPC_CHANNELS.TRIGGER_PANIC, async () => {
    safety.triggerPanic('manual');
    return { success: true };
  });
}

function registerUtilityHandlers() {
  const mouse = getMouseController();

  ipcMain.handle(IPC_CHANNELS.GET_MOUSE_POSITION, async () => {
    return await mouse.getPosition();
  });

  // Permission checking
  ipcMain.handle('permissions:get-status', async () => {
    return getPermissionStatus();
  });

  ipcMain.handle('permissions:request-accessibility', async () => {
    return requestAccessibilityPermission();
  });

  ipcMain.handle(IPC_CHANNELS.MINIMIZE_WINDOW, async () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.CLOSE_WINDOW, async () => {
    if (mainWindow) {
      mainWindow.close();
    }
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.MAXIMIZE_WINDOW, async () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
    return { success: true };
  });
}

function registerTemplateHandlers(storage) {
  ipcMain.handle(IPC_CHANNELS.GET_TEMPLATES, async () => {
    try {
      console.log('[IPC] GET_TEMPLATES called');
      const templates = storage.getAllTemplates();
      console.log('[IPC] Returning', templates.length, 'templates');
      return templates;
    } catch (error) {
      console.error('[IPC] GET_TEMPLATES error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_TEMPLATE, async (event, id) => {
    return storage.getTemplate(id);
  });

  ipcMain.handle(IPC_CHANNELS.CREATE_TEMPLATE, async (event, data) => {
    return storage.createTemplate(data);
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_TEMPLATE, async (event, { id, updates }) => {
    return storage.updateTemplate(id, updates);
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_TEMPLATE, async (event, id) => {
    return storage.deleteTemplate(id);
  });

  ipcMain.handle(IPC_CHANNELS.DUPLICATE_TEMPLATE, async (event, id) => {
    return storage.duplicateTemplate(id);
  });
}

/**
 * Register Quick Record handlers
 */
function registerQuickRecordHandlers() {
  quickRecord.initIPC();

  ipcMain.handle('quick-record:start', async (event, options) => {
    return quickRecord.start(options, mainWindow);
  });

  ipcMain.handle('quick-record:stop', async () => {
    quickRecord.stop();
    return { success: true };
  });

  ipcMain.handle('quick-record:update-mode', async (event, mode) => {
    quickRecord.updateMode(mode);
    return { success: true };
  });
}

/**
 * Register Workflow Preview handlers
 */
function registerPreviewHandlers() {
  workflowPreview.initIPC();

  ipcMain.handle('workflow-preview:show', async (event, workflow) => {
    return workflowPreview.show(workflow, mainWindow);
  });

  ipcMain.handle('workflow-preview:close', async () => {
    workflowPreview.close();
    return { success: true };
  });

  ipcMain.handle('workflow-preview:is-open', async () => {
    return workflowPreview.isOpen();
  });
}

/**
 * Register Floating Bar handlers
 */
function registerFloatingBarHandlers() {
  ipcMain.handle('floating-bar:show', async () => {
    floatingBar.showFloatingBar(mainWindow);
    return { success: true };
  });

  ipcMain.handle('floating-bar:hide', async () => {
    floatingBar.hideFloatingBar();
    return { success: true };
  });

  ipcMain.handle('floating-bar:close', async () => {
    floatingBar.closeFloatingBar();
    return { success: true };
  });

  ipcMain.handle('floating-bar:update-pause', async (event, paused) => {
    floatingBar.sendToFloatingBar('floating-bar:update-pause', paused);
    return { success: true };
  });

  ipcMain.handle('floating-bar:update-stop-timer', async (event, data) => {
    floatingBar.sendToFloatingBar('floating-bar:stop-timer', data);
    return { success: true };
  });

  ipcMain.handle('floating-bar:sync-wait', async (event, data) => {
    floatingBar.sendToFloatingBar('floating-bar:wait-start', { duration: data.duration });
    floatingBar.sendToFloatingBar('floating-bar:wait-tick', data);
    return { success: true };
  });
}

/**
 * Register Hotkey handlers
 */
function registerHotkeyHandlers() {
  ipcMain.handle(IPC_CHANNELS.GET_HOTKEYS, async () => {
    return getHotkeys();
  });

  ipcMain.handle(IPC_CHANNELS.SET_HOTKEY, async (event, { accelerator, workflowId, workflowName }) => {
    return setHotkey(accelerator, workflowId, workflowName);
  });

  ipcMain.handle(IPC_CHANNELS.REMOVE_HOTKEY, async (event, workflowId) => {
    return removeHotkey(workflowId);
  });
}

export function cleanupIPC() {
  Object.values(IPC_CHANNELS).forEach(channel => {
    ipcMain.removeHandler(channel);
  });

  floatingBar.closeFloatingBar();
  getSafetyService().destroy();
}

export { sendToRenderer };
