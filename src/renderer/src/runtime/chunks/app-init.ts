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

let mainProcessBridgeInitialized = false;

/**
 * Initialize the application
 */
async function initApp() {
  // Tag the root element with the platform so CSS can adapt the titlebar
  // (macOS traffic-light spacing vs. Windows caption-overlay spacing).
  document.documentElement.classList.add(
    window.platform?.isMac ? 'platform-mac'
      : window.platform?.isWindows ? 'platform-win'
      : 'platform-linux'
  );

  // Cache DOM elements
  cacheElements();

  // Setup navigation
  setupNavigation();
  setupResponsiveNav();
  setupMainProcessBridge();

  // Initialize views first (sets up DOM references)
  initWorkflowsView();
  initAnalyticsView();
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
    analytics: document.getElementById('view-analytics'),
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
 * Collapse the header nav into a left flyout drawer when the titlebar is too
 * narrow to fit the logo, tabs and status pill side by side. Keeps the status
 * pill from being pushed off-screen on small windows / low-res displays.
 */
function setupResponsiveNav() {
  const titlebarContent = document.querySelector('.titlebar-content');
  const navToggle = document.getElementById('nav-toggle');
  const navBackdrop = document.getElementById('nav-backdrop');
  const navDrawer = document.getElementById('nav-drawer');
  const logo = document.querySelector('.titlebar .logo');
  const actions = document.querySelector('.titlebar-actions');
  if (!titlebarContent || !navToggle || !elements.navTabs) return;

  // Populate the flyout drawer with clones of the titlebar nav items, so the
  // shell markup stays the single source of truth. Clones keep their data-view,
  // so navigateTo()'s active-class sweep and the click handler keep both in sync.
  if (navDrawer && !navDrawer.childElementCount) {
    elements.navTabs.querySelectorAll('.nav-tab').forEach((tab) => {
      navDrawer.appendChild(tab.cloneNode(true));
    });
    navDrawer.addEventListener('click', (e) => {
      const tab = e.target.closest('.nav-tab');
      if (tab) navigateTo(tab.dataset.view);
    });
  }

  // Intrinsic widths of the header blocks, measured once while the nav is
  // expanded. nav-tabs has flex-shrink:0, so scrollWidth is its un-squished width.
  let metrics: any = null;
  const measure = () => {
    if (metrics) return;
    if (document.body.classList.contains('nav-collapsed')) return;
    metrics = {
      logo: logo ? logo.getBoundingClientRect().width : 0,
      nav: elements.navTabs.scrollWidth,
      actions: actions ? actions.getBoundingClientRect().width : 0
    };
  };

  const updateMode = () => {
    measure();
    if (!metrics) return;
    // logo + tabs + pill + (nav margin + content padding + breathing room)
    const needed = metrics.logo + metrics.nav + metrics.actions + 132;
    const collapse = titlebarContent.clientWidth < needed;
    document.body.classList.toggle('nav-collapsed', collapse);
    if (!collapse) closeNavDrawer();
  };

  navToggle.addEventListener('click', () => {
    if (document.body.classList.contains('nav-open')) closeNavDrawer();
    else openNavDrawer();
  });
  if (navBackdrop) navBackdrop.addEventListener('click', closeNavDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('nav-open')) {
      closeNavDrawer();
    }
  });

  // Classify synchronously (layout is available even while the window is still
  // hidden) so the correct mode is set on first paint — rAF wouldn't fire yet.
  // Suppress the drawer transition during this first pass so it never flashes,
  // then re-enable it after the first painted frame.
  document.body.classList.add('nav-no-anim');
  updateMode();
  if (window.ResizeObserver) {
    new ResizeObserver(updateMode).observe(titlebarContent);
  } else {
    window.addEventListener('resize', updateMode);
  }
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.body.classList.remove('nav-no-anim');
  }));
}

/** Open the collapsed-nav flyout drawer. */
function openNavDrawer() {
  document.body.classList.add('nav-open');
  const toggle = document.getElementById('nav-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', 'true');
}

/** Close the collapsed-nav flyout drawer. */
function closeNavDrawer() {
  document.body.classList.remove('nav-open');
  const toggle = document.getElementById('nav-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
}

/**
 * Bridge native menu actions/navigation from preload into renderer runtime handlers.
 */
function setupMainProcessBridge() {
  if (mainProcessBridgeInitialized) {
    return;
  }
  mainProcessBridgeInitialized = true;

  window.addEventListener('app:navigate', (event) => {
    const path = event?.detail?.path;
    if (typeof path !== 'string') return;
    const view = path.replace(/^\//, '').trim();
    if (!view) return;
    navigateTo(view);
  });

  window.addEventListener('app:action', (event) => {
    const action = event?.detail?.action;
    if (typeof action !== 'string') return;

    switch (action) {
      case 'new-workflow':
        void createNewWorkflow();
        break;
      case 'import-workflow':
        void importWorkflow();
        break;
      case 'export-workflow':
        if (state.currentWorkflow?.id) {
          void exportWorkflow(state.currentWorkflow.id);
        } else {
          void exportAllWorkflows();
        }
        break;
      case 'run-workflow':
        if (typeof runCurrentWorkflow === 'function') {
          void runCurrentWorkflow(false);
        }
        break;
      case 'dry-run-workflow':
        if (typeof runCurrentWorkflow === 'function') {
          void runCurrentWorkflow(true);
        }
        break;
      case 'pause-workflow':
        if ((state.executionState === 'running' || state.executionState === 'paused') && typeof togglePause === 'function') {
          void togglePause();
        }
        break;
      default:
        console.warn('[App] Unknown main-process action:', action);
    }
  });
}

/**
 * Navigate to a view
 */
function navigateTo(viewName) {
  // Always dismiss the collapsed-nav flyout on any navigation attempt.
  closeNavDrawer();

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
    case 'analytics':
      renderAnalyticsDashboard();
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
