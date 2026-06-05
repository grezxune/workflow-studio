/**
 * IPC Handlers
 *
 * Bridge between main process and renderer
 */

import fs from 'fs';
import { ipcMain, dialog, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import { getStorageService } from '../services/storage';
import { getWorkflowExecutor } from '../services/workflow-executor';
import { getSafetyService } from '../services/safety';
import { getDetectionService } from '../services/detection';
import { getMouseController } from '../services/mouse-controller';
import { getPermissionStatus, requestAccessibilityPermission } from '../lib/permissions';
import quickRecord from '../services/quick-record';
import workflowPreview from '../services/workflow-preview';
import floatingBar from '../services/floating-bar';
import { initHotkeyService, getHotkeys, setHotkey, removeHotkey } from '../services/hotkey-service';
import { generateWorkflowDraftWithAI } from '../services/ai/ai-workflow-generator';
import { listSupportedGames } from '../services/ai/game-context-packs';
import { getSoundService } from '../services/sound-service';
import { assertAuthorizedSender } from '../lib/ipc-guard';

let mainWindow: BrowserWindow | null = null;
const registeredHandleChannels = new Set<string>();

function assertMainWindowSender(event: IpcMainInvokeEvent, channel: string): void {
  assertAuthorizedSender(event, mainWindow, channel);
}

function secureHandle(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<unknown> | unknown
): void {
  registeredHandleChannels.add(channel);
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, async (event, ...args) => {
    assertMainWindowSender(event, channel);
    return handler(event, ...args);
  });
}

function assertObject(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid ${name}: expected object`);
  }
  return value as Record<string, unknown>;
}

function assertOptionalObject(value: unknown, name: string): Record<string, unknown> {
  if (value == null) {
    return {};
  }
  return assertObject(value, name);
}

function assertString(value: unknown, name: string, maxLength = 200): string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${name}: expected string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    throw new Error(`Invalid ${name}: must be between 1 and ${maxLength} characters`);
  }
  return trimmed;
}

function assertNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid ${name}: expected finite number`);
  }
  return value;
}

function assertBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Invalid ${name}: expected boolean`);
  }
  return value;
}

function assertWorkflowLike(value: unknown): Record<string, unknown> {
  const workflow = assertObject(value, 'workflow');
  if (!Array.isArray(workflow.actions)) {
    throw new Error('Invalid workflow: missing actions array');
  }
  return workflow;
}

export function initializeIPC(window: BrowserWindow) {
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
    sendToRenderer(IPC_CHANNELS.EXECUTION_STOPPED, { source, status: 'completed' });
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

  setupExecutorEvents(executor, storage);
  registerWorkflowHandlers(storage);
  registerExecutionHandlers(executor);
  registerAnalyticsHandlers(storage);
  registerSettingsHandlers(storage);
  registerDetectionHandlers(detection);
  registerAudioHandlers();
  registerSafetyHandlers(safety);
  registerUtilityHandlers();
  registerTemplateHandlers(storage);
  registerAIHandlers(storage);
  registerQuickRecordHandlers();
  registerPreviewHandlers();
  registerFloatingBarHandlers();
  floatingBar.initFloatingBarIPC();
  registerHotkeyHandlers();
  initHotkeyService(mainWindow);
}

function sendToRenderer(channel: string, data?: any) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function setupExecutorEvents(executor, storage) {
  let currentExecutionRecord: any = null;

  function recordExecutorRun(status, data: any = {}) {
    if (!currentExecutionRecord) return;

    const endedAt = Date.now();
    storage.recordWorkflowExecution({
      ...currentExecutionRecord,
      status,
      endedAt: new Date(endedAt).toISOString(),
      durationMs: endedAt - currentExecutionRecord.startedAtMs,
      completedLoops: Number.isFinite(executor.currentLoop) ? executor.currentLoop : null,
      error: data.error?.message || data.error || null
    });
    currentExecutionRecord = null;
  }

  executor.on('workflow:start', (data) => {
    const startedAt = Date.now();
    currentExecutionRecord = {
      workflowId: data.workflow?.id,
      workflowName: data.workflow?.name || 'Untitled Workflow',
      startedAt: new Date(startedAt).toISOString(),
      startedAtMs: startedAt,
      loopsConfigured: data.totalLoops || data.workflow?.loopCount || 1,
      actions: data.workflow?.actions?.length || 0,
      dryRun: !!data.dryRun
    };
    sendToRenderer(IPC_CHANNELS.EXECUTION_STARTED, data);
  });

  executor.on('workflow:complete', (data) => {
    recordExecutorRun('completed', data);
    sendToRenderer(IPC_CHANNELS.EXECUTION_COMPLETED, { ...data, status: 'completed' });
    floatingBar.closeFloatingBar();
  });

  executor.on('workflow:stopped', (data) => {
    recordExecutorRun('completed', data);
    sendToRenderer(IPC_CHANNELS.EXECUTION_STOPPED, { ...data, status: 'completed' });
    floatingBar.closeFloatingBar();
  });

  executor.on('workflow:error', (data) => {
    recordExecutorRun('error', data);
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
    const actionNames = { mouse_move: 'Mouse Move', mouse_click: 'Click', keyboard: 'Keyboard', wait: 'Wait', loop: 'Loop', conditional: 'Conditional', image_detect: 'Image Detect', pixel_detect: 'Pixel Detect' };
    const typeName = actionNames[actionType] || actionType;
    const displayName = data.action?.name || typeName;
    floatingBar.sendToFloatingBar('floating-bar:update-action', {
      text: `${displayName} (${data.index + 1}/${data.total})`
    });
    if (actionType !== 'wait') {
      floatingBar.sendToFloatingBar('floating-bar:wait-hide', {});
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

  executor.on('variables:sync', (data) => {
    sendToRenderer(IPC_CHANNELS.EXECUTION_VARIABLES_SYNC, data);
    floatingBar.sendToFloatingBar('floating-bar:variables-sync', data);
  });

  executor.on('variable:changed', (data) => {
    sendToRenderer(IPC_CHANNELS.EXECUTION_VARIABLE_CHANGED, data);
    floatingBar.sendToFloatingBar('floating-bar:variable-changed', data);
  });

  executor.on('sound:play', (data) => {
    sendToRenderer('audio:play', data);
  });
}

function registerWorkflowHandlers(storage) {
  secureHandle(IPC_CHANNELS.GET_WORKFLOWS, async () => {
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

  secureHandle(IPC_CHANNELS.GET_WORKFLOW, async (event, id) => {
    return storage.getWorkflow(assertString(id, 'workflow id'));
  });

  secureHandle(IPC_CHANNELS.CREATE_WORKFLOW, async (event, data) => {
    return storage.createWorkflow(assertOptionalObject(data, 'workflow data'));
  });

  secureHandle(IPC_CHANNELS.UPDATE_WORKFLOW, async (event, payload) => {
    const data = assertObject(payload, 'workflow update payload');
    const id = assertString(data.id, 'workflow id');
    const updates = assertObject(data.updates, 'workflow updates');
    return storage.updateWorkflow(id, updates);
  });

  secureHandle(IPC_CHANNELS.DELETE_WORKFLOW, async (event, id) => {
    return storage.deleteWorkflow(assertString(id, 'workflow id'));
  });

  secureHandle(IPC_CHANNELS.DUPLICATE_WORKFLOW, async (event, id) => {
    return storage.duplicateWorkflow(assertString(id, 'workflow id'));
  });

  secureHandle(IPC_CHANNELS.EXPORT_WORKFLOW, async (event, id) => {
    const workflowId = assertString(id, 'workflow id');
    const json = storage.exportWorkflow(workflowId);
    if (!json) return null;

    const { filePath } = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export Workflow',
      defaultPath: `workflow-${workflowId}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (filePath) {
      fs.writeFileSync(filePath, json, 'utf-8');
      return filePath;
    }
    return null;
  });

  secureHandle(IPC_CHANNELS.IMPORT_WORKFLOW, async () => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow!, {
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

  secureHandle(IPC_CHANNELS.GET_RECENT_WORKFLOWS, async () => {
    return storage.getRecentWorkflows();
  });

  secureHandle(IPC_CHANNELS.GET_RECENT_RUN_WORKFLOWS, async () => {
    return storage.getRecentRunWorkflows();
  });
}

function registerExecutionHandlers(executor) {
  secureHandle(IPC_CHANNELS.EXECUTE_WORKFLOW, async (event, payload) => {
    const data = assertObject(payload, 'execution payload');
    const workflow = assertWorkflowLike(data.workflow);
    const options = assertOptionalObject(data.options, 'execution options');
    console.log('[IPC] EXECUTE_WORKFLOW received');
    console.log('[IPC] Options:', JSON.stringify(options));
    try {
      await executor.execute(workflow, options);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[IPC] Execute error:', message);
      return { success: false, error: message };
    }
  });

  secureHandle(IPC_CHANNELS.PAUSE_EXECUTION, async () => {
    executor.pause();
    return { success: true };
  });

  secureHandle(IPC_CHANNELS.RESUME_EXECUTION, async () => {
    executor.resume();
    return { success: true };
  });

  secureHandle(IPC_CHANNELS.STOP_EXECUTION, async () => {
    executor.stop();
    return { success: true };
  });

  secureHandle(IPC_CHANNELS.EMERGENCY_STOP, async () => {
    await executor.emergencyStop();
    return { success: true };
  });

  secureHandle(IPC_CHANNELS.GET_EXECUTION_STATUS, async () => {
    return executor.getStatus();
  });

  secureHandle('execution:reset-variable', async (event, variableId) => {
    executor.resetVariable(variableId);
    return { success: true };
  });
}

function registerAnalyticsHandlers(storage) {
  secureHandle(IPC_CHANNELS.GET_EXECUTION_HISTORY, async (event, options = {}) => {
    return storage.getExecutionHistory(options || {});
  });

  secureHandle(IPC_CHANNELS.IMPORT_EXECUTION_HISTORY, async (event, records = []) => {
    return storage.importExecutionHistory(records);
  });

  secureHandle(IPC_CHANNELS.CLEAR_EXECUTION_HISTORY, async () => {
    return storage.clearExecutionHistory();
  });

  secureHandle(IPC_CHANNELS.GET_WORKFLOW_ANALYTICS, async (event, workflowId) => {
    return storage.getWorkflowAnalytics(workflowId);
  });

  secureHandle(IPC_CHANNELS.GET_OVERALL_ANALYTICS, async () => {
    return storage.getOverallAnalytics();
  });
}

function registerSettingsHandlers(storage) {
  secureHandle(IPC_CHANNELS.GET_SETTINGS, async () => {
    return storage.getSettings();
  });

  secureHandle(IPC_CHANNELS.UPDATE_SETTINGS, async (event, updates) => {
    const safeUpdates = assertObject(updates, 'settings updates');
    const result = storage.updateSettings(safeUpdates);
    
    // Propagate to live service instances
    try {
      const mouse = getMouseController();
      if (mouse) mouse.updateSettings(safeUpdates);
    } catch (e) {}
    try {
      const detection = getDetectionService();
      if (detection) detection.updateSettings(safeUpdates);
    } catch (e) {}
    
    return result;
  });

  secureHandle(IPC_CHANNELS.GET_SETTING, async (event, key) => {
    return storage.getSetting(assertString(key, 'setting key', 100));
  });

  secureHandle(IPC_CHANNELS.SET_SETTING, async (event, payload) => {
    const data = assertObject(payload, 'setting payload');
    const key = assertString(data.key, 'setting key', 100);
    const value = data.value;
    storage.setSetting(key, value);
    return { success: true };
  });

  secureHandle(IPC_CHANNELS.SELECT_DIRECTORY, async (event, options = {}) => {
    const safeOptions = assertOptionalObject(options, 'directory selection options');
    const title = typeof safeOptions.title === 'string' ? safeOptions.title : 'Select Directory';
    const defaultPath = typeof safeOptions.defaultPath === 'string' ? safeOptions.defaultPath : undefined;
    const { filePaths } = await dialog.showOpenDialog(mainWindow!, {
      title,
      properties: ['openDirectory', 'createDirectory'],
      defaultPath
    });

    return filePaths && filePaths.length > 0 ? filePaths[0] : null;
  });

  secureHandle(IPC_CHANNELS.GET_WORKFLOWS_DIR, async () => {
    return storage.getWorkflowsDir();
  });
}

function registerDetectionHandlers(detection) {
  secureHandle(IPC_CHANNELS.CAPTURE_SCREEN, async (event, options = {}) => {
    const safeOptions = assertOptionalObject(options, 'capture options');
    return await detection.captureScreen(safeOptions.region);
  });

  secureHandle(IPC_CHANNELS.CAPTURE_REGION, async (event, payload) => {
    const data = assertObject(payload, 'capture region payload');
    const region = assertObject(data.region, 'capture region');
    const name = assertString(data.name, 'template name', 120);
    return await detection.captureTemplate(region, name);
  });

  secureHandle(IPC_CHANNELS.FIND_IMAGE, async (event, payload) => {
    const data = assertObject(payload, 'find image payload');
    const imageId = assertString(data.imageId, 'image id', 200);
    const options = assertOptionalObject(data.options, 'find image options');
    return await detection.findImage(imageId, options);
  });

  secureHandle(IPC_CHANNELS.FIND_PIXEL, async (event, payload) => {
    const data = assertObject(payload, 'find pixel payload');
    const color = assertObject(data.color, 'pixel color');
    const options = assertOptionalObject(data.options, 'find pixel options');
    return await detection.findPixel(color, options);
  });

  secureHandle(IPC_CHANNELS.GET_PIXEL_COLOR, async (event, payload) => {
    const data = assertObject(payload, 'pixel position');
    const x = assertNumber(data.x, 'pixel x');
    const y = assertNumber(data.y, 'pixel y');
    return await detection.getPixelColor(x, y);
  });

  secureHandle(IPC_CHANNELS.GET_SCREEN_SIZE, async () => {
    return await detection.getScreenSize();
  });

  const storage = getStorageService();

  secureHandle(IPC_CHANNELS.GET_IMAGES, async () => {
    return storage.getAllImages();
  });

  secureHandle(IPC_CHANNELS.DELETE_IMAGE, async (event, id) => {
    return storage.deleteImage(assertString(id, 'image id', 200));
  });

  secureHandle('images:rename', async (event, payload) => {
    const data = assertObject(payload, 'image rename payload');
    const oldId = assertString(data.oldId, 'old image id', 200);
    const newId = assertString(data.newId, 'new image id', 200);
    return storage.renameImage(oldId, newId);
  });

  secureHandle(IPC_CHANNELS.SAVE_IMAGE, async (event, payload) => {
    const data = assertObject(payload, 'save image payload');
    const id = assertString(data.id, 'image id', 200);
    if (!(data.buffer instanceof ArrayBuffer) && !ArrayBuffer.isView(data.buffer)) {
      throw new Error('Invalid image buffer');
    }
    const inputBuffer = data.buffer as ArrayBuffer | ArrayBufferView;
    const nodeBuffer = inputBuffer instanceof ArrayBuffer
      ? Buffer.from(new Uint8Array(inputBuffer))
      : Buffer.from(inputBuffer.buffer, inputBuffer.byteOffset, inputBuffer.byteLength);
    return storage.saveImage(id, nodeBuffer);
  });

  // Image folder operations (virtual/metadata-only)
  secureHandle('images:get-folders', async () => {
    return storage.getImageFolders();
  });

  secureHandle('images:create-folder', async (event, name) => {
    return storage.createImageFolder(assertString(name, 'folder name', 80));
  });

  secureHandle('images:rename-folder', async (event, payload) => {
    const data = assertObject(payload, 'folder rename payload');
    const oldName = assertString(data.oldName, 'old folder name', 80);
    const newName = assertString(data.newName, 'new folder name', 80);
    return storage.renameImageFolder(oldName, newName);
  });

  secureHandle('images:delete-folder', async (event, name) => {
    return storage.deleteImageFolder(assertString(name, 'folder name', 80));
  });

  secureHandle('images:move-to-folder', async (event, payload) => {
    const data = assertObject(payload, 'move image payload');
    const imageId = assertString(data.imageId, 'image id', 200);
    const folder = data.folder == null ? null : assertString(data.folder, 'folder name', 80);
    storage.moveImageToFolder(imageId, folder);
    return { success: true };
  });

  secureHandle('detection:clear-template-cache', async (event, imageId) => {
    try {
      const detection = getDetectionService();
      if (imageId == null) {
        detection.clearTemplateCache();
      } else {
        detection.clearTemplateCache(assertString(imageId, 'image id', 200));
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
}

function registerAudioHandlers() {
  const soundService = getSoundService();
  const storage = getStorageService();

  secureHandle(IPC_CHANNELS.GET_SYSTEM_SOUNDS, async () => {
    return [...soundService.getAvailableSounds(), ...storage.getCustomSounds()];
  });

  secureHandle(IPC_CHANNELS.PLAY_SYSTEM_SOUND, async (event, soundId) => {
    return soundService.playSound(soundId);
  });

  secureHandle(IPC_CHANNELS.SPEAK_TEXT, async (event, payload = {}) => {
    const { text, volume } = (payload || {}) as any;
    return soundService.speakText(text, volume);
  });

  secureHandle(IPC_CHANNELS.IMPORT_CUSTOM_SOUND, async () => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow!, {
      title: 'Import Custom Sound',
      properties: ['openFile'],
      filters: [
        { name: 'Audio Files', extensions: ['wav', 'mp3', 'ogg', 'm4a', 'aac', 'flac'] }
      ]
    });

    if (!filePaths?.length) return null;
    return storage.importCustomSound(filePaths[0]);
  });

  secureHandle(IPC_CHANNELS.DELETE_CUSTOM_SOUND, async (event, soundId) => {
    return storage.deleteCustomSound(soundId);
  });
}

function registerSafetyHandlers(safety) {
  secureHandle(IPC_CHANNELS.SET_PANIC_HOTKEY, async (event, hotkey) => {
    safety.setPanicHotkey(assertString(hotkey, 'panic hotkey', 40));
    return { success: true };
  });

  secureHandle(IPC_CHANNELS.SET_PAUSE_HOTKEY, async (event, hotkey) => {
    safety.setPauseHotkey(assertString(hotkey, 'pause hotkey', 40));
    return { success: true };
  });

  secureHandle(IPC_CHANNELS.GET_SAFETY_CONFIG, async () => {
    return safety.getConfig();
  });

  secureHandle(IPC_CHANNELS.TRIGGER_PANIC, async () => {
    safety.triggerPanic('manual');
    return { success: true };
  });
}

function registerUtilityHandlers() {
  const mouse = getMouseController();

  secureHandle(IPC_CHANNELS.GET_MOUSE_POSITION, async () => {
    return await mouse.getPosition();
  });

  // Permission checking
  secureHandle('permissions:get-status', async () => {
    return getPermissionStatus();
  });

  secureHandle('permissions:request-accessibility', async () => {
    return requestAccessibilityPermission();
  });

  secureHandle(IPC_CHANNELS.MINIMIZE_WINDOW, async () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
    return { success: true };
  });

  secureHandle(IPC_CHANNELS.CLOSE_WINDOW, async () => {
    if (mainWindow) {
      mainWindow.close();
    }
    return { success: true };
  });

  secureHandle(IPC_CHANNELS.MAXIMIZE_WINDOW, async () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
    return { success: true };
  });

  secureHandle('window:restore', async () => {
    if (mainWindow) {
      mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    return { success: true };
  });
}

function registerTemplateHandlers(storage) {
  secureHandle(IPC_CHANNELS.GET_TEMPLATES, async () => {
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

  secureHandle(IPC_CHANNELS.GET_TEMPLATE, async (event, id) => {
    return storage.getTemplate(assertString(id, 'template id'));
  });

  secureHandle(IPC_CHANNELS.CREATE_TEMPLATE, async (event, data) => {
    return storage.createTemplate(assertOptionalObject(data, 'template data'));
  });

  secureHandle(IPC_CHANNELS.UPDATE_TEMPLATE, async (event, payload) => {
    const data = assertObject(payload, 'template update payload');
    const id = assertString(data.id, 'template id');
    const updates = assertObject(data.updates, 'template updates');
    return storage.updateTemplate(id, updates);
  });

  secureHandle(IPC_CHANNELS.DELETE_TEMPLATE, async (event, id) => {
    return storage.deleteTemplate(assertString(id, 'template id'));
  });

  secureHandle(IPC_CHANNELS.DUPLICATE_TEMPLATE, async (event, id) => {
    return storage.duplicateTemplate(assertString(id, 'template id'));
  });
}

function registerAIHandlers(storage) {
  secureHandle(IPC_CHANNELS.AI_GET_SUPPORTED_GAMES, async () => {
    return listSupportedGames();
  });

  secureHandle(IPC_CHANNELS.AI_GENERATE_WORKFLOW, async (event, payload = {}) => {
    try {
      const request = assertOptionalObject(payload, 'AI workflow payload');
      const settings = storage.getSettings();
      const availableImages = storage.getAllImages();
      return await generateWorkflowDraftWithAI(request, { settings, availableImages });
    } catch (error) {
      console.error('[IPC] AI generation failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to generate workflow.' };
    }
  });
}

/**
 * Register Quick Record handlers
 */
function registerQuickRecordHandlers() {
  quickRecord.initIPC();

  secureHandle('quick-record:start', async (event, options) => {
    return quickRecord.start(assertOptionalObject(options, 'quick record options'), mainWindow);
  });

  secureHandle('quick-record:stop', async () => {
    quickRecord.stop();
    return { success: true };
  });

  secureHandle('quick-record:update-mode', async (event, mode) => {
    quickRecord.updateMode(assertString(mode, 'quick record mode', 40));
    return { success: true };
  });
}

/**
 * Register Workflow Preview handlers
 */
function registerPreviewHandlers() {
  workflowPreview.initIPC();

  secureHandle('workflow-preview:show', async (event, workflow) => {
    return workflowPreview.show(assertWorkflowLike(workflow), mainWindow);
  });

  secureHandle('workflow-preview:close', async () => {
    workflowPreview.close();
    return { success: true };
  });

  secureHandle('workflow-preview:is-open', async () => {
    return workflowPreview.isOpen();
  });
}

/**
 * Register Floating Bar handlers
 */
function registerFloatingBarHandlers() {
  secureHandle('floating-bar:show', async () => {
    floatingBar.showFloatingBar(mainWindow);
    return { success: true };
  });

  secureHandle('floating-bar:hide', async () => {
    floatingBar.hideFloatingBar();
    return { success: true };
  });

  secureHandle('floating-bar:close', async () => {
    floatingBar.closeFloatingBar();
    return { success: true };
  });

  secureHandle('floating-bar:update-pause', async (event, paused) => {
    floatingBar.sendToFloatingBar('floating-bar:update-pause', assertBoolean(paused, 'paused flag'));
    return { success: true };
  });

  secureHandle('floating-bar:update-stop-timer', async (event, data) => {
    floatingBar.sendToFloatingBar('floating-bar:stop-timer', assertObject(data, 'stop timer data'));
    return { success: true };
  });

  secureHandle('floating-bar:sync-wait', async (event, data) => {
    const payload = assertObject(data, 'wait sync data');
    const duration = assertNumber(payload.duration, 'wait duration');
    floatingBar.sendToFloatingBar('floating-bar:wait-start', { duration });
    floatingBar.sendToFloatingBar('floating-bar:wait-tick', payload);
    return { success: true };
  });

  secureHandle('floating-bar:variables-sync', async (event, data) => {
    floatingBar.sendToFloatingBar('floating-bar:variables-sync', data);
    return { success: true };
  });
}

/**
 * Register Hotkey handlers
 */
function registerHotkeyHandlers() {
  secureHandle(IPC_CHANNELS.GET_HOTKEYS, async () => {
    return getHotkeys();
  });

  secureHandle(IPC_CHANNELS.SET_HOTKEY, async (event, payload) => {
    const data = assertObject(payload, 'hotkey payload');
    const accelerator = assertString(data.accelerator, 'hotkey accelerator', 60);
    const workflowId = assertString(data.workflowId, 'workflow id');
    const workflowName = assertString(data.workflowName, 'workflow name', 120);
    return setHotkey(accelerator, workflowId, workflowName);
  });

  secureHandle(IPC_CHANNELS.REMOVE_HOTKEY, async (event, workflowId) => {
    return removeHotkey(assertString(workflowId, 'workflow id'));
  });
}

export function cleanupIPC() {
  registeredHandleChannels.forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
  registeredHandleChannels.clear();

  floatingBar.closeFloatingBar();
  getSafetyService().destroy();
}

export { sendToRenderer };
