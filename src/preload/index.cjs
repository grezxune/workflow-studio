/**
 * Preload Script
 *
 * Exposes a secure API to the renderer process
 * NOTE: This must be CommonJS (.cjs) for Electron context isolation
 */

const { contextBridge, ipcRenderer } = require('electron');

// IPC Channels (inlined since preload can't import ES modules)
// MUST MATCH src/shared/constants.js exactly!
const IPC_CHANNELS = {
  // Workflows
  GET_WORKFLOWS: 'workflow:get-all',
  GET_WORKFLOW: 'workflow:get',
  CREATE_WORKFLOW: 'workflow:create',
  UPDATE_WORKFLOW: 'workflow:update',
  DELETE_WORKFLOW: 'workflow:delete',
  DUPLICATE_WORKFLOW: 'workflow:duplicate',
  EXPORT_WORKFLOW: 'workflow:export',
  IMPORT_WORKFLOW: 'workflow:import',
  GET_RECENT_WORKFLOWS: 'workflow:get-recent',

  // AI
  AI_GENERATE_WORKFLOW: 'ai:generate-workflow',
  AI_GET_SUPPORTED_GAMES: 'ai:get-supported-games',

  // Execution
  EXECUTE_WORKFLOW: 'execution:start',
  STOP_EXECUTION: 'execution:stop',
  PAUSE_EXECUTION: 'execution:pause',
  RESUME_EXECUTION: 'execution:resume',
  EMERGENCY_STOP: 'execution:emergency-stop',
  GET_EXECUTION_STATUS: 'execution:get-status',

  // Execution events (main -> renderer)
  EXECUTION_STARTED: 'execution:started',
  EXECUTION_COMPLETED: 'execution:completed',
  EXECUTION_STOPPED: 'execution:stopped',
  EXECUTION_ERROR: 'execution:error',
  EXECUTION_PAUSED: 'execution:paused',
  EXECUTION_RESUMED: 'execution:resumed',
  EXECUTION_STATE_CHANGED: 'execution:state-changed',
  ACTION_STARTED: 'action:started',
  ACTION_COMPLETED: 'action:completed',
  ACTION_ERROR: 'action:error',
  LOOP_STARTED: 'loop:started',
  LOOP_COMPLETED: 'loop:completed',

  // Settings
  GET_SETTINGS: 'settings:get',
  UPDATE_SETTINGS: 'settings:update',
  GET_SETTING: 'settings:get-one',
  SET_SETTING: 'settings:set-one',
  SELECT_DIRECTORY: 'settings:select-dir',
  GET_WORKFLOWS_DIR: 'settings:get-workflows-dir',

  // Detection
  CAPTURE_SCREEN: 'detection:capture-screen',
  CAPTURE_REGION: 'detection:capture-region',
  FIND_IMAGE: 'detection:find-image',
  FIND_PIXEL: 'detection:find-pixel',
  GET_PIXEL_COLOR: 'detection:get-pixel-color',
  GET_SCREEN_SIZE: 'detection:get-screen-size',

  // Images
  GET_IMAGES: 'images:get-all',
  DELETE_IMAGE: 'images:delete',
  SAVE_IMAGE: 'images:save',

  // Safety
  SET_PANIC_HOTKEY: 'safety:set-panic-hotkey',
  SET_PAUSE_HOTKEY: 'safety:set-pause-hotkey',
  GET_SAFETY_CONFIG: 'safety:get-config',
  TRIGGER_PANIC: 'safety:trigger-panic',
  PANIC_TRIGGERED: 'safety:panic-triggered',

  // Utilities
  GET_MOUSE_POSITION: 'util:get-mouse-pos',
  MINIMIZE_WINDOW: 'window:minimize',
  MAXIMIZE_WINDOW: 'window:maximize',
  CLOSE_WINDOW: 'window:close',

  // Templates
  GET_TEMPLATES: 'template:get-all',
  GET_TEMPLATE: 'template:get',
  CREATE_TEMPLATE: 'template:create',
  UPDATE_TEMPLATE: 'template:update',
  DELETE_TEMPLATE: 'template:delete',
  DUPLICATE_TEMPLATE: 'template:duplicate'
};

// Allowed channels for receiving events
const validReceiveChannels = [
  IPC_CHANNELS.EXECUTION_STARTED,
  IPC_CHANNELS.EXECUTION_COMPLETED,
  IPC_CHANNELS.EXECUTION_STOPPED,
  IPC_CHANNELS.EXECUTION_ERROR,
  IPC_CHANNELS.EXECUTION_PAUSED,
  IPC_CHANNELS.EXECUTION_RESUMED,
  IPC_CHANNELS.EXECUTION_STATE_CHANGED,
  IPC_CHANNELS.ACTION_STARTED,
  IPC_CHANNELS.ACTION_COMPLETED,
  IPC_CHANNELS.ACTION_ERROR,
  IPC_CHANNELS.LOOP_STARTED,
  IPC_CHANNELS.LOOP_COMPLETED,
  IPC_CHANNELS.PANIC_TRIGGERED,
  'floating-bar:pause-clicked',
  'floating-bar:stop-clicked',
  'floating-bar:expand-clicked',
  'update:checking',
  'update:available',
  'update:not-available',
  'update:download-progress',
  'update:downloaded',
  'update:error'
];

/**
 * Expose secure API to renderer
 */
contextBridge.exposeInMainWorld('workflowAPI', {
  // ==================== WORKFLOWS ====================

  getWorkflows: async () => {
    console.log('[Preload] getWorkflows called');
    const result = await ipcRenderer.invoke(IPC_CHANNELS.GET_WORKFLOWS);
    console.log('[Preload] getWorkflows result:', result);
    return result;
  },

  getWorkflow: (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_WORKFLOW, id),

  createWorkflow: (data) =>
    ipcRenderer.invoke(IPC_CHANNELS.CREATE_WORKFLOW, data),

  updateWorkflow: (id, updates) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_WORKFLOW, { id, updates }),

  deleteWorkflow: (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_WORKFLOW, id),

  duplicateWorkflow: (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.DUPLICATE_WORKFLOW, id),

  exportWorkflow: (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_WORKFLOW, id),

  importWorkflow: () =>
    ipcRenderer.invoke(IPC_CHANNELS.IMPORT_WORKFLOW),

  getRecentWorkflows: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_RECENT_WORKFLOWS),

  generateWorkflowWithAI: (payload) =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_GENERATE_WORKFLOW, payload),

  getAISupportedGames: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_GET_SUPPORTED_GAMES),

  // ==================== EXECUTION ====================

  executeWorkflow: (workflow, options = {}) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXECUTE_WORKFLOW, { workflow, options }),

  pauseExecution: () =>
    ipcRenderer.invoke(IPC_CHANNELS.PAUSE_EXECUTION),

  resumeExecution: () =>
    ipcRenderer.invoke(IPC_CHANNELS.RESUME_EXECUTION),

  stopExecution: () =>
    ipcRenderer.invoke(IPC_CHANNELS.STOP_EXECUTION),

  emergencyStop: () =>
    ipcRenderer.invoke(IPC_CHANNELS.EMERGENCY_STOP),

  getExecutionStatus: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_EXECUTION_STATUS),

  // ==================== SETTINGS ====================

  getSettings: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),

  updateSettings: (updates) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_SETTINGS, updates),

  getSetting: (key) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SETTING, key),

  setSetting: (key, value) =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_SETTING, { key, value }),

  selectDirectory: (options) =>
    ipcRenderer.invoke(IPC_CHANNELS.SELECT_DIRECTORY, options),

  getWorkflowsDir: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_WORKFLOWS_DIR),

  // ==================== DETECTION ====================

  captureScreen: (options) =>
    ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_SCREEN, options),

  captureRegion: (region, name) =>
    ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_REGION, { region, name }),

  findImage: (imageId, options) =>
    ipcRenderer.invoke(IPC_CHANNELS.FIND_IMAGE, { imageId, options }),

  findPixel: (color, options) =>
    ipcRenderer.invoke(IPC_CHANNELS.FIND_PIXEL, { color, options }),

  getPixelColor: (x, y) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_PIXEL_COLOR, { x, y }),

  getScreenSize: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SCREEN_SIZE),

  // Region capture with selection UI
  captureRegionTemplate: (options) =>
    ipcRenderer.invoke('capture-region-template', options),

  selectScreenRegion: () =>
    ipcRenderer.invoke('select-screen-region'),

  pickScreenPosition: () =>
    ipcRenderer.invoke('pick-screen-position'),

  // ==================== IMAGES ====================

  getImages: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_IMAGES),

  deleteImage: (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_IMAGE, id),

  renameImage: (oldId, newId) =>
    ipcRenderer.invoke('images:rename', { oldId, newId }),

  saveImage: (id, buffer) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_IMAGE, { id, buffer }),

  clearTemplateCache: (imageId) =>
    ipcRenderer.invoke('detection:clear-template-cache', imageId),

  // Image folders (virtual/metadata)
  getImageFolders: () =>
    ipcRenderer.invoke('images:get-folders'),

  createImageFolder: (name) =>
    ipcRenderer.invoke('images:create-folder', name),

  renameImageFolder: (oldName, newName) =>
    ipcRenderer.invoke('images:rename-folder', { oldName, newName }),

  deleteImageFolder: (name) =>
    ipcRenderer.invoke('images:delete-folder', name),

  moveImageToFolder: (imageId, folder) =>
    ipcRenderer.invoke('images:move-to-folder', { imageId, folder }),

  // ==================== SAFETY ====================

  setPanicHotkey: (hotkey) =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_PANIC_HOTKEY, hotkey),

  setPauseHotkey: (hotkey) =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_PAUSE_HOTKEY, hotkey),

  getSafetyConfig: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SAFETY_CONFIG),

  triggerPanic: () =>
    ipcRenderer.invoke(IPC_CHANNELS.TRIGGER_PANIC),

  // ==================== TEMPLATES ====================

  getTemplates: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_TEMPLATES),

  getTemplate: (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_TEMPLATE, id),

  createTemplate: (data) =>
    ipcRenderer.invoke(IPC_CHANNELS.CREATE_TEMPLATE, data),

  updateTemplate: (id, updates) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_TEMPLATE, { id, updates }),

  deleteTemplate: (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_TEMPLATE, id),

  duplicateTemplate: (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.DUPLICATE_TEMPLATE, id),

  // ==================== QUICK RECORD ====================

  startQuickRecord: (options) =>
    ipcRenderer.invoke('quick-record:start', options),

  stopQuickRecord: () =>
    ipcRenderer.invoke('quick-record:stop'),

  updateQuickRecordMode: (mode) =>
    ipcRenderer.invoke('quick-record:update-mode', mode),

  onQuickRecordPosition: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('quick-record:position-captured', subscription);
    return () => ipcRenderer.removeListener('quick-record:position-captured', subscription);
  },

  // ==================== WORKFLOW PREVIEW ====================

  showWorkflowPreview: (workflow) =>
    ipcRenderer.invoke('workflow-preview:show', workflow),

  closeWorkflowPreview: () =>
    ipcRenderer.invoke('workflow-preview:close'),

  isWorkflowPreviewOpen: () =>
    ipcRenderer.invoke('workflow-preview:is-open'),

  onWorkflowPreviewClosed: (callback) => {
    const subscription = (event) => callback();
    ipcRenderer.on('workflow-preview:closed', subscription);
    return () => ipcRenderer.removeListener('workflow-preview:closed', subscription);
  },

  // ==================== UTILITIES ====================

  getMousePosition: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_MOUSE_POSITION),

  minimizeWindow: () =>
    ipcRenderer.invoke(IPC_CHANNELS.MINIMIZE_WINDOW),

  maximizeWindow: () =>
    ipcRenderer.invoke(IPC_CHANNELS.MAXIMIZE_WINDOW),

  closeWindow: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CLOSE_WINDOW),

  restoreWindow: () =>
    ipcRenderer.invoke('window:restore'),

  // ==================== PERMISSIONS ====================

  getPermissionStatus: () =>
    ipcRenderer.invoke('permissions:get-status'),

  requestAccessibilityPermission: () =>
    ipcRenderer.invoke('permissions:request-accessibility'),

  // ==================== EVENT LISTENERS ====================

  onExecutionStarted: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.EXECUTION_STARTED, subscription);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.EXECUTION_STARTED, subscription);
  },

  onExecutionCompleted: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.EXECUTION_COMPLETED, subscription);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.EXECUTION_COMPLETED, subscription);
  },

  onExecutionStopped: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.EXECUTION_STOPPED, subscription);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.EXECUTION_STOPPED, subscription);
  },

  onExecutionError: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.EXECUTION_ERROR, subscription);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.EXECUTION_ERROR, subscription);
  },

  onExecutionPaused: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.EXECUTION_PAUSED, subscription);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.EXECUTION_PAUSED, subscription);
  },

  onExecutionResumed: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.EXECUTION_RESUMED, subscription);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.EXECUTION_RESUMED, subscription);
  },

  onActionStarted: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.ACTION_STARTED, subscription);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.ACTION_STARTED, subscription);
  },

  onActionCompleted: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.ACTION_COMPLETED, subscription);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.ACTION_COMPLETED, subscription);
  },

  onActionError: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.ACTION_ERROR, subscription);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.ACTION_ERROR, subscription);
  },

  onWaitStart: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('wait:start', subscription);
    return () => ipcRenderer.removeListener('wait:start', subscription);
  },

  onWaitTick: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('wait:tick', subscription);
    return () => ipcRenderer.removeListener('wait:tick', subscription);
  },

  onLoopStarted: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.LOOP_STARTED, subscription);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.LOOP_STARTED, subscription);
  },

  onLoopCompleted: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.LOOP_COMPLETED, subscription);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.LOOP_COMPLETED, subscription);
  },

  onStateChanged: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.EXECUTION_STATE_CHANGED, subscription);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.EXECUTION_STATE_CHANGED, subscription);
  },

  onPanicTriggered: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.PANIC_TRIGGERED, subscription);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PANIC_TRIGGERED, subscription);
  },

  // Floating bar
  showFloatingBar: () => ipcRenderer.invoke('floating-bar:show'),
  hideFloatingBar: () => ipcRenderer.invoke('floating-bar:hide'),
  closeFloatingBar: () => ipcRenderer.invoke('floating-bar:close'),
  updateFloatingBarPause: (paused) => ipcRenderer.invoke('floating-bar:update-pause', paused),
  updateFloatingBarStopTimer: (data) => ipcRenderer.invoke('floating-bar:update-stop-timer', data),
  syncFloatingBarWait: (data) => ipcRenderer.invoke('floating-bar:sync-wait', data),

  onFloatingBarPauseClicked: (callback) => {
    const subscription = (event) => callback();
    ipcRenderer.on('floating-bar:pause-clicked', subscription);
    return () => ipcRenderer.removeListener('floating-bar:pause-clicked', subscription);
  },

  onFloatingBarStopClicked: (callback) => {
    const subscription = (event) => callback();
    ipcRenderer.on('floating-bar:stop-clicked', subscription);
    return () => ipcRenderer.removeListener('floating-bar:stop-clicked', subscription);
  },

  onFloatingBarExpandClicked: (callback) => {
    const subscription = (event) => callback();
    ipcRenderer.on('floating-bar:expand-clicked', subscription);
    return () => ipcRenderer.removeListener('floating-bar:expand-clicked', subscription);
  },

  // ==================== AUTO-UPDATE ====================

  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  restartToUpdate: () => ipcRenderer.invoke('update:restart'),

  onUpdateAvailable: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('update:available', subscription);
    return () => ipcRenderer.removeListener('update:available', subscription);
  },

  onUpdateDownloadProgress: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('update:download-progress', subscription);
    return () => ipcRenderer.removeListener('update:download-progress', subscription);
  },

  onUpdateDownloaded: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('update:downloaded', subscription);
    return () => ipcRenderer.removeListener('update:downloaded', subscription);
  },

  onUpdateError: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('update:error', subscription);
    return () => ipcRenderer.removeListener('update:error', subscription);
  },

  // ==================== HOTKEYS ====================

  getHotkeys: () => ipcRenderer.invoke('hotkeys:get-all'),

  setHotkey: (accelerator, workflowId, workflowName) =>
    ipcRenderer.invoke('hotkeys:set', { accelerator, workflowId, workflowName }),

  removeHotkey: (workflowId) =>
    ipcRenderer.invoke('hotkeys:remove', workflowId),

  onHotkeyTriggered: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('hotkeys:triggered', subscription);
    return () => ipcRenderer.removeListener('hotkeys:triggered', subscription);
  },

  // Remove all listeners
  removeAllListeners: () => {
    validReceiveChannels.forEach(channel => {
      ipcRenderer.removeAllListeners(channel);
    });
  }
});

// Expose platform info
contextBridge.exposeInMainWorld('platform', {
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  isLinux: process.platform === 'linux',
  platform: process.platform,
  appVersion: require('../../package.json').version
});

// Listen for navigation commands from main process
ipcRenderer.on('navigate', (event, path) => {
  window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path } }));
});

// Listen for action commands from main process
ipcRenderer.on('action', (event, action) => {
  window.dispatchEvent(new CustomEvent('app:action', { detail: { action } }));
});
