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
  initHotkeysView();
  initImagesView();
  initSettingsView();
  
  // Initialize quick record mode
  if (window.quickRecord) {
    window.quickRecord.init();
  }

  // Setup event listeners from main process
  setupIPCListeners();

  // Load initial data (after views are ready)
  await loadSettings();
  await loadWorkflows();

  // Refresh hotkeys now that workflows are loaded
  loadHotkeys();

  // Check permissions on macOS
  await checkPermissions();

  console.log('Workflow Studio initialized');
}

window.initApp = initApp;

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
    hotkeys: document.getElementById('view-hotkeys'),
    images: document.getElementById('view-images'),
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

  // If navigating to editor with no workflow loaded, auto-create one
  if (viewName === 'editor' && !state.currentWorkflow) {
    createNewWorkflow();
    return;
  }

  // Update tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === viewName);
  });

  // Update views
  Object.entries(elements.views).forEach(([name, view]) => {
    view.classList.toggle('active', name === viewName);
  });

  state.currentView = viewName;

  // Refresh the target view so it always reflects current state
  refreshView(viewName);
}

/**
 * Refresh a view's rendered content from current in-memory state.
 * Called automatically on every tab switch so all views stay in sync.
 */
function refreshView(viewName) {
  switch (viewName) {
    case 'workflows':
      renderWorkflowList();
      renderRecentWorkflows();
      break;
    case 'editor':
      // Editor is always kept in sync via direct state.currentWorkflow binding
      break;
    case 'hotkeys':
      loadHotkeys();
      break;
    case 'images':
      loadImagesAndFolders();
      break;
    case 'settings':
      // Settings view reads from state.settings which is kept in sync
      break;
  }
}

/**
 * Load application settings
 */
async function loadSettings() {
  try {
    state.settings = await window.workflowAPI.getSettings();
    window.dispatchEvent(new CustomEvent('settings:updated', { detail: { settings: state.settings } }));
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
