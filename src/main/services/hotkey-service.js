/**
 * Hotkey Service
 *
 * Manages global keyboard shortcuts that trigger workflow execution.
 * Uses Electron's globalShortcut API so hotkeys work from any application.
 */

import { globalShortcut } from 'electron';
import { getStorageService } from './storage.js';
import { getWorkflowExecutor } from './workflow-executor.js';
import { getDetectionService } from './detection.js';

let mainWindow = null;
let registeredHotkeys = new Map(); // accelerator -> { workflowId, workflowName }

/**
 * Initialize the hotkey service
 */
export function initHotkeyService(window) {
  mainWindow = window;

  // Load and register all saved hotkeys
  const bindings = getHotkeys();
  for (const binding of bindings) {
    registerGlobalHotkey(binding.accelerator, binding.workflowId, binding.workflowName);
  }

  console.log(`[HotkeyService] Initialized with ${bindings.length} hotkey(s)`);
}

/**
 * Get all hotkey bindings from storage
 */
export function getHotkeys() {
  const storage = getStorageService();
  return storage.store.get('hotkeys', []);
}

/**
 * Save all hotkey bindings to storage
 */
function saveHotkeys(bindings) {
  const storage = getStorageService();
  storage.store.set('hotkeys', bindings);
}

/**
 * Set (add or update) a hotkey binding
 */
export function setHotkey(accelerator, workflowId, workflowName) {
  // Unregister any existing binding for this accelerator
  unregisterGlobalHotkey(accelerator);

  // Also remove any existing binding for this workflow (one hotkey per workflow)
  const bindings = getHotkeys().filter(b => b.workflowId !== workflowId && b.accelerator !== accelerator);

  bindings.push({ accelerator, workflowId, workflowName, createdAt: new Date().toISOString() });
  saveHotkeys(bindings);

  // Register the global shortcut
  registerGlobalHotkey(accelerator, workflowId, workflowName);

  return { success: true };
}

/**
 * Remove a hotkey binding
 */
export function removeHotkey(workflowId) {
  const bindings = getHotkeys();
  const binding = bindings.find(b => b.workflowId === workflowId);

  if (binding) {
    unregisterGlobalHotkey(binding.accelerator);
  }

  const updated = bindings.filter(b => b.workflowId !== workflowId);
  saveHotkeys(updated);

  return { success: true };
}

/**
 * Register a global shortcut with Electron
 */
function registerGlobalHotkey(accelerator, workflowId, workflowName) {
  try {
    // Unregister first if already registered
    if (registeredHotkeys.has(accelerator)) {
      globalShortcut.unregister(accelerator);
    }

    const registered = globalShortcut.register(accelerator, async () => {
      console.log(`[HotkeyService] Hotkey ${accelerator} triggered for workflow "${workflowName}"`);
      await triggerWorkflow(workflowId, workflowName, accelerator);
    });

    if (registered) {
      registeredHotkeys.set(accelerator, { workflowId, workflowName });
      console.log(`[HotkeyService] Registered hotkey: ${accelerator} -> ${workflowName}`);
    } else {
      console.warn(`[HotkeyService] Failed to register hotkey: ${accelerator} (may be in use by another app)`);
    }

    return registered;
  } catch (error) {
    console.error(`[HotkeyService] Error registering hotkey ${accelerator}:`, error.message);
    return false;
  }
}

/**
 * Unregister a global shortcut
 */
function unregisterGlobalHotkey(accelerator) {
  try {
    if (registeredHotkeys.has(accelerator)) {
      globalShortcut.unregister(accelerator);
      registeredHotkeys.delete(accelerator);
      console.log(`[HotkeyService] Unregistered hotkey: ${accelerator}`);
    }
  } catch (error) {
    console.error(`[HotkeyService] Error unregistering hotkey ${accelerator}:`, error.message);
  }
}

/**
 * Trigger a workflow execution via hotkey
 */
async function triggerWorkflow(workflowId, workflowName, accelerator) {
  const storage = getStorageService();
  const executor = getWorkflowExecutor({ detectionService: getDetectionService() });

  // Check if already running
  const status = executor.getStatus();
  if (status.state === 'running' || status.state === 'paused') {
    console.log(`[HotkeyService] Ignoring hotkey - workflow already running`);
    sendToRenderer('hotkeys:triggered', { accelerator, workflowId, workflowName, ignored: true, reason: 'already_running' });
    return;
  }

  // Load the workflow
  const workflow = storage.getWorkflow(workflowId);
  if (!workflow) {
    console.error(`[HotkeyService] Workflow ${workflowId} not found`);
    sendToRenderer('hotkeys:triggered', { accelerator, workflowId, workflowName, ignored: true, reason: 'not_found' });
    return;
  }

  // Notify renderer
  sendToRenderer('hotkeys:triggered', { accelerator, workflowId, workflowName, ignored: false });

  // Execute
  try {
    await executor.execute(workflow, {});
  } catch (error) {
    console.error(`[HotkeyService] Execution error:`, error.message);
  }
}

/**
 * Send event to renderer
 */
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

/**
 * Re-register all hotkeys (e.g. after app regains focus)
 */
export function refreshHotkeys() {
  // Unregister all current
  for (const [accelerator] of registeredHotkeys) {
    try { globalShortcut.unregister(accelerator); } catch (e) {}
  }
  registeredHotkeys.clear();

  // Re-register from storage
  const bindings = getHotkeys();
  for (const binding of bindings) {
    registerGlobalHotkey(binding.accelerator, binding.workflowId, binding.workflowName);
  }
}

/**
 * Cleanup all registered hotkeys
 */
export function destroyHotkeyService() {
  for (const [accelerator] of registeredHotkeys) {
    try { globalShortcut.unregister(accelerator); } catch (e) {}
  }
  registeredHotkeys.clear();
}
