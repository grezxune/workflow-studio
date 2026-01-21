/**
 * Workflow Studio - Main Application
 *
 * Handles navigation, global state, and app initialization
 */

// Global state
const state = {
  currentView: 'workflows',
  currentWorkflow: null,
  workflows: [],
  settings: {},
  executionState: 'idle'
};

// DOM References
const elements = {
  navTabs: null,
  views: {},
  statusIndicator: null,
  statusDot: null,
  statusText: null,
  toastContainer: null,
  modalOverlay: null,
  modal: null
};

/**
 * Initialize the application
 */
async function initApp() {
  // Cache DOM elements
  cacheElements();

  // Setup navigation
  setupNavigation();

  // Initialize views first (sets up DOM references)
  initWorkflowsView();
  initEditorView();
  initSettingsView();

  // Setup event listeners from main process
  setupIPCListeners();

  // Load initial data (after views are ready)
  await loadSettings();
  await loadWorkflows();

  // Check permissions on macOS
  await checkPermissions();

  console.log('Workflow Studio initialized');
}

/**
 * Check system permissions on startup
 */
async function checkPermissions() {
  try {
    const status = await window.workflowAPI.getPermissionStatus();
    console.log('[App] Permission status:', status);

    if (!status.accessibility) {
      showToast('warning', 'Permission Required',
        'Accessibility permission is needed to control mouse/keyboard. Click Settings > Request Permissions.',
        10000);
    }
  } catch (error) {
    console.error('[App] Failed to check permissions:', error);
  }
}

/**
 * Cache commonly used DOM elements
 */
function cacheElements() {
  elements.navTabs = document.getElementById('nav-tabs');
  elements.views = {
    workflows: document.getElementById('view-workflows'),
    editor: document.getElementById('view-editor'),
    settings: document.getElementById('view-settings')
  };
  elements.statusIndicator = document.getElementById('status-indicator');
  elements.statusDot = elements.statusIndicator.querySelector('.status-dot');
  elements.statusText = elements.statusIndicator.querySelector('.status-text');
  elements.toastContainer = document.getElementById('toast-container');
  elements.modalOverlay = document.getElementById('modal-overlay');
  elements.modal = document.getElementById('modal');
}

/**
 * Setup navigation between views
 */
function setupNavigation() {
  elements.navTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.nav-tab');
    if (!tab) return;

    const view = tab.dataset.view;
    navigateTo(view);
  });
}

/**
 * Navigate to a view
 */
function navigateTo(viewName) {
  if (!elements.views[viewName]) return;

  // Update tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === viewName);
  });

  // Update views
  Object.entries(elements.views).forEach(([name, view]) => {
    view.classList.toggle('active', name === viewName);
  });

  state.currentView = viewName;
}

/**
 * Load application settings
 */
async function loadSettings() {
  try {
    state.settings = await window.workflowAPI.getSettings();
  } catch (error) {
    console.error('Failed to load settings:', error);
    showToast('error', 'Error', 'Failed to load settings');
  }
}

/**
 * Load all workflows
 */
async function loadWorkflows() {
  try {
    console.log('[App] Loading workflows...');
    state.workflows = await window.workflowAPI.getWorkflows();
    console.log('[App] Loaded workflows:', state.workflows);
    console.log('[App] Workflow count:', state.workflows?.length || 0);
    renderWorkflowList();
    renderRecentWorkflows();
  } catch (error) {
    console.error('[App] Failed to load workflows:', error);
    showToast('error', 'Error', `Failed to load workflows: ${error.message}`);
  }
}

/**
 * Setup IPC event listeners from main process
 */
function setupIPCListeners() {
  // Track current execution for history
  let currentExecution = null;

  // Execution events
  window.workflowAPI.onExecutionStarted((data) => {
    updateExecutionState('running');
    showExecutionOverlay(data.workflow);
    currentExecution = {
      workflowName: data.workflow?.name || 'Unknown',
      workflowId: data.workflow?.id,
      loops: data.totalLoops || 1,
      actions: data.workflow?.actions?.length || 0,
      startTime: Date.now()
    };
  });

  window.workflowAPI.onExecutionCompleted((data) => {
    updateExecutionState('idle');
    hideExecutionOverlay();
    showToast('success', 'Complete', 'Workflow execution completed');
    if (currentExecution) {
      addToExecutionHistory({
        ...currentExecution,
        status: 'completed',
        duration: Date.now() - currentExecution.startTime
      });
      currentExecution = null;
    }
  });

  window.workflowAPI.onExecutionStopped((data) => {
    updateExecutionState('idle');
    hideExecutionOverlay();
    showToast('warning', 'Stopped', 'Workflow execution stopped');
    if (currentExecution) {
      addToExecutionHistory({
        ...currentExecution,
        status: 'stopped',
        duration: Date.now() - currentExecution.startTime
      });
      currentExecution = null;
    }
  });

  window.workflowAPI.onExecutionError((data) => {
    updateExecutionState('error');
    hideExecutionOverlay();
    showToast('error', 'Error', data.error || 'Execution failed');
    if (currentExecution) {
      addToExecutionHistory({
        ...currentExecution,
        status: 'error',
        error: data.error,
        duration: Date.now() - currentExecution.startTime
      });
      currentExecution = null;
    }
  });

  window.workflowAPI.onExecutionPaused(() => {
    updateExecutionState('paused');
  });

  window.workflowAPI.onExecutionResumed(() => {
    updateExecutionState('running');
  });

  window.workflowAPI.onActionStarted((data) => {
    updateExecutionProgress(data);
  });

  window.workflowAPI.onLoopStarted((data) => {
    updateLoopProgress(data);
  });

  // Listen for panic trigger
  window.workflowAPI.onPanicTriggered?.((data) => {
    updateExecutionState('idle');
    hideExecutionOverlay();
    showToast('warning', 'Emergency Stop', `Panic triggered: ${data.source}`);
    if (currentExecution) {
      addToExecutionHistory({
        ...currentExecution,
        status: 'stopped',
        duration: Date.now() - currentExecution.startTime
      });
      currentExecution = null;
    }
  });

  // Setup keyboard shortcuts for workflow hotkeys
  setupWorkflowHotkeyListeners();
}

/**
 * Setup global hotkey listeners for running workflows
 */
function setupWorkflowHotkeyListeners() {
  document.addEventListener('keydown', async (e) => {
    // Only listen for F-keys (except F7 which is panic)
    if (!e.key.startsWith('F') || e.key === 'F7') return;

    const hotkeyMap = JSON.parse(localStorage.getItem('workflow-hotkeys') || '{}');

    // Find workflow mapped to this hotkey
    const workflowId = Object.keys(hotkeyMap).find(id => hotkeyMap[id] === e.key);

    if (workflowId && state.executionState === 'idle') {
      e.preventDefault();
      runWorkflow(workflowId);
    }
  });
}

/**
 * Update execution state in UI
 */
function updateExecutionState(newState) {
  state.executionState = newState;

  elements.statusDot.className = 'status-dot ' + newState;

  const labels = {
    idle: 'Idle',
    running: 'Running',
    paused: 'Paused',
    error: 'Error'
  };
  elements.statusText.textContent = labels[newState] || newState;
}

/**
 * Show a toast notification
 */
function showToast(type, title, message, duration = 4000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    error: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
  };

  toast.innerHTML = `
    <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${icons[type] || icons.info}
    </svg>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
  `;

  elements.toastContainer.appendChild(toast);

  // Auto remove
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.2s ease reverse';
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

/**
 * Show modal dialog
 */
function showModal(title, content, buttons = []) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = content;

  const footer = document.getElementById('modal-footer');
  footer.innerHTML = '';

  buttons.forEach(btn => {
    const button = document.createElement('button');
    // Support both 'class' and 'primary' button formats
    if (btn.primary) {
      button.className = 'btn btn-primary';
    } else {
      button.className = `btn ${btn.class || 'btn-secondary'}`;
    }
    button.textContent = btn.label;
    button.onclick = () => {
      if (btn.onClick) btn.onClick();
      if (typeof btn.action === 'function') btn.action();
      if (btn.action === 'close' || btn.closeOnClick !== false) closeModal();
    };
    footer.appendChild(button);
  });

  elements.modalOverlay.classList.remove('hidden');

  // Close on backdrop click
  elements.modalOverlay.onclick = (e) => {
    if (e.target === elements.modalOverlay) closeModal();
  };

  // Close button
  document.getElementById('modal-close').onclick = closeModal;
}

/**
 * Hide modal dialog (alias for closeModal)
 */
function hideModal() {
  elements.modalOverlay.classList.add('hidden');
}

/**
 * Close modal dialog
 */
function closeModal() {
  elements.modalOverlay.classList.add('hidden');
}

/**
 * Show confirmation dialog
 */
function showConfirm(title, message, onConfirm) {
  showModal(title, `<p>${message}</p>`, [
    { label: 'Cancel', class: 'btn-secondary' },
    { label: 'Confirm', class: 'btn-danger', onClick: onConfirm }
  ]);
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  // Less than a minute
  if (diff < 60000) return 'Just now';

  // Less than an hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins} min${mins > 1 ? 's' : ''} ago`;
  }

  // Less than a day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }

  // Less than a week
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  // Full date
  return date.toLocaleDateString();
}

/**
 * Generate unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initApp);
