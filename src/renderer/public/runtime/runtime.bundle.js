/*
 * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY.
 * Source: src/renderer/src/runtime/chunks/*.ts
 * Regenerate with: bun run gen:runtime
 */

// ===== ui-buttons.ts =====
const SHARED_BUTTON_SELECTOR = 'button.btn, button.nav-tab, button.status-indicator';
function enhanceButton(button) {
    if (button.dataset.sharedButtonReady === 'true') {
        return;
    }
    button.dataset.sharedButtonReady = 'true';
    button.classList.add('ui-btn');
    const directChildren = Array.from(button.children);
    for (const child of directChildren) {
        if (child.tagName.toLowerCase() !== 'svg') {
            continue;
        }
        const svg = child;
        const wrapper = document.createElement('span');
        wrapper.className = 'btn-icon-slot';
        button.insertBefore(wrapper, svg);
        wrapper.appendChild(svg);
    }
}
function enhanceButtonsIn(root) {
    const buttons = root.querySelectorAll(SHARED_BUTTON_SELECTOR);
    buttons.forEach(enhanceButton);
}
function initSharedButtonSystem() {
    enhanceButtonsIn(document);
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach((node) => {
                if (!(node instanceof Element)) {
                    return;
                }
                if (node.matches?.(SHARED_BUTTON_SELECTOR)) {
                    enhanceButton(node);
                }
                enhanceButtonsIn(node);
            });
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}
initSharedButtonSystem();

// ===== duration-input.ts =====
/**
 * Workflow Studio - Shared Duration Input
 *
 * A consistent control for entering a time duration with a unit selector
 * (ms / sec / min / hr). Durations are ALWAYS stored canonically in
 * milliseconds; the selected unit only affects how the number is displayed and
 * entered. Min–max ranges share a single unit selector.
 *
 * Usage:
 *   - Markup: durationFieldHTML({ id, valueMs }) or
 *     durationRangeFieldHTML({ minId, maxId, minMs, maxMs }).
 *     Static markup (e.g. settings, editor footer) can hand-write the same
 *     `.duration-input` structure and just set values at load time.
 *   - Read back canonical ms: readDurationMs(idOrEl) (null when empty).
 *   - Set programmatically: setDurationMs() / setDurationRangeMs().
 *
 * Switching units is purely cosmetic — it converts the displayed number in
 * place while keeping the underlying millisecond value constant, so nothing
 * needs to be re-saved until the user edits an actual number.
 */
const DURATION_UNITS = [
    { value: 'ms', label: 'ms', ms: 1 },
    { value: 's', label: 'sec', ms: 1000 },
    { value: 'min', label: 'min', ms: 60 * 1000 },
    { value: 'h', label: 'hr', ms: 60 * 60 * 1000 }
];
const DURATION_UNIT_RANK = DURATION_UNITS.reduce((acc, u, i) => {
    acc[u.value] = i;
    return acc;
}, {});
function durationUnitMs(unit) {
    const found = DURATION_UNITS.find((u) => u.value === unit);
    return found ? found.ms : 1;
}
/**
 * Largest unit that represents `ms` as a whole number, capped at `maxUnit`.
 * Non-finite / non-positive values fall back to 'ms'.
 */
function bestDurationUnit(ms, maxUnit = 'h') {
    const value = Number(ms);
    if (!Number.isFinite(value) || value <= 0)
        return 'ms';
    const cap = DURATION_UNIT_RANK[maxUnit] ?? DURATION_UNIT_RANK.h;
    for (let i = DURATION_UNITS.length - 1; i >= 0; i--) {
        const u = DURATION_UNITS[i];
        if (DURATION_UNIT_RANK[u.value] > cap)
            continue;
        if (value % u.ms === 0)
            return u.value;
    }
    return 'ms';
}
/** For a range, the smaller of the two best units so both ends stay whole. */
function bestDurationUnitForRange(minMs, maxMs, maxUnit = 'h') {
    const a = bestDurationUnit(minMs, maxUnit);
    const b = bestDurationUnit(maxMs, maxUnit);
    return DURATION_UNIT_RANK[a] <= DURATION_UNIT_RANK[b] ? a : b;
}
/** Format a ms value as a trimmed number string in `unit` ('' for empty). */
function msToUnitValue(ms, unit) {
    if (ms === '' || ms == null || !Number.isFinite(Number(ms)))
        return '';
    const n = Number(ms) / durationUnitMs(unit);
    // Keep enough precision that toggling units never loses sub-second values.
    return String(Math.round(n * 1e6) / 1e6);
}
function durEscapeHtml(text) {
    return String(text == null ? '' : text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function durationUnitOptions(selected, maxUnit = 'h') {
    const cap = DURATION_UNIT_RANK[maxUnit] ?? DURATION_UNIT_RANK.h;
    return DURATION_UNITS
        .filter((u) => DURATION_UNIT_RANK[u.value] <= cap)
        .map((u) => `<option value="${u.value}"${u.value === selected ? ' selected' : ''}>${u.label}</option>`)
        .join('');
}
/**
 * Markup for a single duration field.
 * @param {{id:string, valueMs?:number|string, unit?:string, maxUnit?:string, placeholder?:string, inputClass?:string}} opts
 */
function durationFieldHTML({ id, valueMs = '', unit, maxUnit = 'h', placeholder = '', inputClass = '' } = {}) {
    const hasValue = valueMs !== '' && valueMs != null && Number.isFinite(Number(valueMs));
    const u = unit || (hasValue ? bestDurationUnit(Number(valueMs), maxUnit) : 'ms');
    const shown = hasValue ? msToUnitValue(valueMs, u) : '';
    const cls = ('duration-input-value ' + (inputClass || '')).trim();
    return `<div class="duration-input" data-duration>`
        + `<input type="number" id="${id}" class="${cls}" min="0" step="any" value="${shown}"`
        + `${placeholder ? ` placeholder="${durEscapeHtml(placeholder)}"` : ''}>`
        + `<select class="duration-input-unit" data-prev-unit="${u}" aria-label="Time unit">`
        + `${durationUnitOptions(u, maxUnit)}</select>`
        + `</div>`;
}
/**
 * Markup for a min–max duration range that shares one unit selector.
 * @param {{minId:string, maxId:string, minMs?:number, maxMs?:number, separator?:string, unit?:string, maxUnit?:string}} opts
 */
function durationRangeFieldHTML({ minId, maxId, minMs = 0, maxMs = 0, separator = 'to', unit, maxUnit = 'h' } = {}) {
    const u = unit || bestDurationUnitForRange(minMs, maxMs, maxUnit);
    return `<div class="duration-input duration-input--range" data-duration>`
        + `<input type="number" id="${minId}" class="duration-input-value" min="0" step="any" value="${msToUnitValue(minMs, u)}">`
        + `<span class="duration-input-dash">${durEscapeHtml(separator)}</span>`
        + `<input type="number" id="${maxId}" class="duration-input-value" min="0" step="any" value="${msToUnitValue(maxMs, u)}">`
        + `<select class="duration-input-unit" data-prev-unit="${u}" aria-label="Time unit">`
        + `${durationUnitOptions(u, maxUnit)}</select>`
        + `</div>`;
}
/** Read a duration field back in canonical milliseconds (null when empty/invalid). */
function readDurationMs(idOrEl) {
    const input = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
    if (!input)
        return null;
    const raw = String(input.value).trim();
    if (raw === '')
        return null;
    const n = parseFloat(raw);
    if (!Number.isFinite(n))
        return null;
    const wrap = input.closest('[data-duration]');
    const unit = wrap?.querySelector('.duration-input-unit')?.value || 'ms';
    return Math.round(n * durationUnitMs(unit));
}
/** Set a single duration field from a ms value, picking the cleanest unit. */
function setDurationMs(idOrEl, ms, { unit, maxUnit = 'h' } = {}) {
    const input = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
    if (!input)
        return;
    const empty = ms === '' || ms == null || !Number.isFinite(Number(ms));
    const u = unit || (empty ? 'ms' : bestDurationUnit(Number(ms), maxUnit));
    const wrap = input.closest('[data-duration]');
    const sel = wrap?.querySelector('.duration-input-unit');
    if (sel) {
        sel.value = u;
        sel.dataset.prevUnit = u;
    }
    input.value = empty ? '' : msToUnitValue(ms, u);
}
/** Set a min–max duration range from ms values, sharing one unit. */
function setDurationRangeMs(minId, maxId, minMs, maxMs, { unit, maxUnit = 'h' } = {}) {
    const minEl = document.getElementById(minId);
    const maxEl = document.getElementById(maxId);
    if (!minEl || !maxEl)
        return;
    const u = unit || bestDurationUnitForRange(minMs, maxMs, maxUnit);
    const sel = minEl.closest('[data-duration]')?.querySelector('.duration-input-unit');
    if (sel) {
        sel.value = u;
        sel.dataset.prevUnit = u;
    }
    minEl.value = msToUnitValue(minMs, u);
    maxEl.value = msToUnitValue(maxMs, u);
}
// When the unit changes, convert the displayed number(s) in place so the
// underlying millisecond value is preserved. Purely cosmetic — no re-save.
document.addEventListener('change', (e) => {
    const sel = e.target.closest?.('.duration-input-unit');
    if (!sel)
        return;
    const wrap = sel.closest('[data-duration]');
    if (!wrap)
        return;
    const prevUnit = sel.dataset.prevUnit || 'ms';
    const nextUnit = sel.value;
    sel.dataset.prevUnit = nextUnit;
    if (prevUnit === nextUnit)
        return;
    const factor = durationUnitMs(prevUnit) / durationUnitMs(nextUnit);
    wrap.querySelectorAll('.duration-input-value').forEach((inp) => {
        const n = parseFloat(inp.value);
        if (Number.isFinite(n)) {
            inp.value = String(Math.round(n * factor * 1e6) / 1e6);
        }
    });
});

// ===== app-init.ts =====
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
    document.documentElement.classList.add(window.platform?.isMac ? 'platform-mac'
        : window.platform?.isWindows ? 'platform-win'
            : 'platform-linux');
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
            showToast('warning', 'Permission Required', 'Accessibility permission is needed to control mouse/keyboard. Click Settings > Request Permissions.', 10000);
        }
    }
    catch (error) {
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
        if (!tab)
            return;
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
    if (!titlebarContent || !navToggle || !elements.navTabs)
        return;
    // Populate the flyout drawer with clones of the titlebar nav items, so the
    // shell markup stays the single source of truth. Clones keep their data-view,
    // so navigateTo()'s active-class sweep and the click handler keep both in sync.
    if (navDrawer && !navDrawer.childElementCount) {
        elements.navTabs.querySelectorAll('.nav-tab').forEach((tab) => {
            navDrawer.appendChild(tab.cloneNode(true));
        });
        navDrawer.addEventListener('click', (e) => {
            const tab = e.target.closest('.nav-tab');
            if (tab)
                navigateTo(tab.dataset.view);
        });
    }
    // Intrinsic widths of the header blocks, measured once while the nav is
    // expanded. nav-tabs has flex-shrink:0, so scrollWidth is its un-squished width.
    let metrics = null;
    const measure = () => {
        if (metrics)
            return;
        if (document.body.classList.contains('nav-collapsed'))
            return;
        metrics = {
            logo: logo ? logo.getBoundingClientRect().width : 0,
            nav: elements.navTabs.scrollWidth,
            actions: actions ? actions.getBoundingClientRect().width : 0
        };
    };
    const updateMode = () => {
        measure();
        if (!metrics)
            return;
        // logo + tabs + pill + (nav margin + content padding + breathing room)
        const needed = metrics.logo + metrics.nav + metrics.actions + 132;
        const collapse = titlebarContent.clientWidth < needed;
        document.body.classList.toggle('nav-collapsed', collapse);
        if (!collapse)
            closeNavDrawer();
    };
    navToggle.addEventListener('click', () => {
        if (document.body.classList.contains('nav-open'))
            closeNavDrawer();
        else
            openNavDrawer();
    });
    if (navBackdrop)
        navBackdrop.addEventListener('click', closeNavDrawer);
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
    }
    else {
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
    if (toggle)
        toggle.setAttribute('aria-expanded', 'true');
}
/** Close the collapsed-nav flyout drawer. */
function closeNavDrawer() {
    document.body.classList.remove('nav-open');
    const toggle = document.getElementById('nav-toggle');
    if (toggle)
        toggle.setAttribute('aria-expanded', 'false');
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
        if (typeof path !== 'string')
            return;
        const view = path.replace(/^\//, '').trim();
        if (!view)
            return;
        navigateTo(view);
    });
    window.addEventListener('app:action', (event) => {
        const action = event?.detail?.action;
        if (typeof action !== 'string')
            return;
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
                }
                else {
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
    if (!elements.views[viewName])
        return;
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
    }
    catch (error) {
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
    }
    catch (error) {
        console.error('[App] Failed to load workflows:', error);
        showToast('error', 'Error', `Failed to load workflows: ${error.message}`);
    }
}
/**
 * Setup IPC event listeners from main process
 */

// ===== app-ipc.ts =====
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
    // Auto-update events
    setupUpdateListeners();
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

// ===== app-ui.ts =====
function showToast(type, title, message, duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = {
        success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
        error: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
        warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
        info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
    };
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'toast-icon');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '2');
    icon.innerHTML = icons[type] || icons.info;
    const content = document.createElement('div');
    content.className = 'toast-content';
    const titleEl = document.createElement('div');
    titleEl.className = 'toast-title';
    titleEl.textContent = String(title ?? '');
    content.appendChild(titleEl);
    if (message) {
        const messageEl = document.createElement('div');
        messageEl.className = 'toast-message';
        messageEl.textContent = String(message);
        content.appendChild(messageEl);
    }
    toast.append(icon, content);
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
        }
        else {
            button.className = `btn ${btn.class || 'btn-secondary'}`;
        }
        button.textContent = btn.label;
        button.onclick = () => {
            if (btn.onClick)
                btn.onClick();
            if (typeof btn.action === 'function')
                btn.action();
            if (btn.action === 'close' || btn.closeOnClick !== false)
                closeModal();
        };
        footer.appendChild(button);
    });
    elements.modalOverlay.classList.remove('hidden');
    // Close on backdrop click
    elements.modalOverlay.onclick = (e) => {
        if (e.target === elements.modalOverlay)
            closeModal();
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
    const escaped = escapeHtml(String(message ?? ''));
    showModal(title, `<p>${escaped}</p>`, [
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
    if (diff < 60000)
        return 'Just now';
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
/**
 * Setup auto-update event listeners and banner controls
 */
function setupUpdateListeners() {
    const banner = document.getElementById('update-banner');
    const title = document.getElementById('update-banner-title');
    const subtitle = document.getElementById('update-banner-subtitle');
    const restartBtn = document.getElementById('update-banner-restart');
    const dismissBtn = document.getElementById('update-banner-dismiss');
    if (!banner)
        return;
    window.workflowAPI.onUpdateAvailable((data) => {
        title.textContent = `Update v${data.version} available`;
        subtitle.textContent = 'Downloading in the background...';
        restartBtn.classList.add('hidden');
        banner.classList.remove('hidden');
    });
    window.workflowAPI.onUpdateDownloadProgress((data) => {
        subtitle.textContent = `Downloading update... ${data.percent}%`;
    });
    window.workflowAPI.onUpdateDownloaded((data) => {
        title.textContent = `v${data.version} ready to install`;
        subtitle.textContent = 'Restart the app to apply the update';
        restartBtn.classList.remove('hidden');
        banner.classList.remove('hidden');
    });
    window.workflowAPI.onUpdateError((data) => {
        console.warn('[Update] Error:', data.message);
        banner.classList.add('hidden');
    });
    restartBtn.addEventListener('click', () => {
        window.workflowAPI.restartToUpdate();
    });
    dismissBtn.addEventListener('click', () => {
        banner.classList.add('hidden');
    });
}
// App bootstrap is executed by runtime/bootstrap.ts after all chunks load.

// ===== analytics.ts =====
/**
 * Workflow Studio - Analytics View
 *
 * Renders overall and per-workflow execution metrics from persisted run history.
 * Public API (used by app.js / workflows.js) is unchanged:
 *   - initAnalyticsView()
 *   - showWorkflowAnalytics(workflowId)
 *   - renderAnalyticsDashboard()
 */
const analyticsState = {
    selectedWorkflowId: null,
    isLoading: false
};
const analyticsElements = {
    summaryGrid: null,
    workflowTable: null,
    workflowSelect: null,
    workflowDetail: null,
    recentRuns: null,
    refreshButton: null
};
function initAnalyticsView() {
    analyticsElements.summaryGrid = document.getElementById('analytics-summary-grid');
    analyticsElements.workflowTable = document.getElementById('analytics-workflow-table');
    analyticsElements.workflowSelect = document.getElementById('analytics-workflow-select');
    analyticsElements.workflowDetail = document.getElementById('workflow-analytics-detail');
    analyticsElements.recentRuns = document.getElementById('analytics-recent-runs');
    analyticsElements.refreshButton = document.getElementById('btn-refresh-analytics');
    analyticsElements.refreshButton?.addEventListener('click', renderAnalyticsDashboard);
    analyticsElements.workflowSelect?.addEventListener('change', () => {
        analyticsState.selectedWorkflowId = analyticsElements.workflowSelect.value || null;
        renderAnalyticsDashboard();
    });
}
function showWorkflowAnalytics(workflowId) {
    analyticsState.selectedWorkflowId = workflowId;
    if (state.currentView === 'analytics') {
        renderAnalyticsDashboard();
    }
    else {
        navigateTo('analytics');
    }
}
async function renderAnalyticsDashboard() {
    if (!analyticsElements.summaryGrid)
        return;
    if (!window.workflowAPI?.getOverallAnalytics)
        return;
    analyticsState.isLoading = true;
    setAnalyticsLoadingState(true);
    try {
        const overall = await window.workflowAPI.getOverallAnalytics();
        ensureSelectedWorkflow(overall);
        renderWorkflowSelect(overall);
        const workflowAnalytics = analyticsState.selectedWorkflowId
            ? await window.workflowAPI.getWorkflowAnalytics(analyticsState.selectedWorkflowId)
            : null;
        renderOverallSummary(overall);
        renderWorkflowPerformanceTable(overall);
        renderWorkflowDetail(workflowAnalytics);
        renderRecentRuns(overall.recentRuns || []);
    }
    catch (error) {
        console.error('[Analytics] Failed to render:', error);
        analyticsElements.summaryGrid.innerHTML = '<div class="analytics-empty">Unable to load analytics</div>';
        analyticsElements.workflowTable.innerHTML = '';
        analyticsElements.workflowDetail.innerHTML = '';
        analyticsElements.recentRuns.innerHTML = '';
    }
    finally {
        analyticsState.isLoading = false;
        setAnalyticsLoadingState(false);
    }
}
function setAnalyticsLoadingState(loading) {
    if (analyticsElements.refreshButton) {
        analyticsElements.refreshButton.disabled = loading;
        analyticsElements.refreshButton.classList.toggle('checking', loading);
    }
}
function ensureSelectedWorkflow(overall) {
    const existingWorkflowIds = new Set((state.workflows || []).map(workflow => workflow.id));
    const selectedExists = analyticsState.selectedWorkflowId
        && (existingWorkflowIds.has(analyticsState.selectedWorkflowId)
            || overall.perWorkflow?.some(item => item.workflowId === analyticsState.selectedWorkflowId));
    if (selectedExists)
        return;
    analyticsState.selectedWorkflowId = overall.perWorkflow?.[0]?.workflowId
        || state.workflows?.[0]?.id
        || null;
}
function renderWorkflowSelect(overall) {
    const select = analyticsElements.workflowSelect;
    if (!select)
        return;
    const options = [...(state.workflows || [])]
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .map(workflow => ({
        id: workflow.id,
        name: workflow.name || 'Untitled Workflow'
    }));
    const selectedInOptions = options.some(option => option.id === analyticsState.selectedWorkflowId);
    if (analyticsState.selectedWorkflowId && !selectedInOptions) {
        const historical = overall.perWorkflow?.find(item => item.workflowId === analyticsState.selectedWorkflowId);
        options.unshift({
            id: analyticsState.selectedWorkflowId,
            name: historical?.workflowName || 'Deleted Workflow'
        });
    }
    select.innerHTML = options.length
        ? options.map(option => `
      <option value="${analyticsEscapeHtml(option.id)}" ${option.id === analyticsState.selectedWorkflowId ? 'selected' : ''}>
        ${analyticsEscapeHtml(option.name)}
      </option>
    `).join('')
        : '<option value="">No workflows</option>';
}
function renderOverallSummary(overall) {
    const summary = overall.summary || {};
    const totalRuns = Number(summary.totalRuns) || 0;
    const recentRuns = overall.recentRuns || [];
    const hero = `
    <div class="analytics-hero">
      <div class="analytics-hero-ring">
        ${renderOutcomeDonut(summary)}
        <div class="analytics-hero-ring-caption">Run outcomes</div>
        ${renderOutcomeLegend(summary)}
      </div>
      <div class="analytics-hero-headline">
        <div class="analytics-hero-eyebrow">Total executions</div>
        <div class="analytics-hero-value">${formatAnalyticsNumber(totalRuns)}</div>
        <div class="analytics-hero-substats">
          <span><strong>${formatAnalyticsNumber(overall.workflowsRun || 0)}</strong> workflows</span>
          <span class="analytics-dot-sep"></span>
          <span><strong>${formatAnalyticsNumber(summary.totalActions)}</strong> actions</span>
          <span class="analytics-dot-sep"></span>
          <span>last run <strong>${analyticsEscapeHtml(formatAnalyticsDate(summary.lastRunAt, true))}</strong></span>
        </div>
      </div>
      <div class="analytics-hero-activity">
        <div class="analytics-hero-activity-label">Recent activity</div>
        ${renderActivityBars(recentRuns)}
      </div>
    </div>
  `;
    const cards = [
        { icon: 'clock', accent: '#22d3ee', label: 'Time Automated', value: formatAnalyticsDuration(summary.totalDurationMs), meta: `${formatAnalyticsDuration(summary.averageDurationMs)} avg run` },
        { icon: 'gauge', accent: '#60a5fa', label: 'Avg Duration', value: formatAnalyticsDuration(summary.averageDurationMs), meta: `across ${formatAnalyticsNumber(totalRuns)} runs` },
        { icon: 'gauge', accent: '#a78bfa', label: 'Longest Run', value: formatAnalyticsDuration(summary.longestDurationMs), meta: `${formatAnalyticsDuration(summary.shortestDurationMs)} shortest` },
        { icon: 'layers', accent: '#818cf8', label: 'Actions', value: formatAnalyticsNumber(summary.totalActions), meta: `${formatAnalyticsNumber(summary.averageActions, 1)} avg/run` },
        { icon: 'calendar', accent: '#fbbf24', label: 'Last Run', value: formatAnalyticsDate(summary.lastRunAt, true), meta: summary.lastStatus ? formatAnalyticsStatus(summary.lastStatus) : 'No runs' }
    ];
    const tiles = cards.map(card => `
    <div class="analytics-metric" style="--metric-accent: ${card.accent}">
      <div class="analytics-metric-top">
        <span class="analytics-metric-icon">${analyticsIcon(card.icon)}</span>
        <span class="analytics-metric-label">${analyticsEscapeHtml(card.label)}</span>
      </div>
      <div class="analytics-metric-value">${analyticsEscapeHtml(card.value)}</div>
      <div class="analytics-metric-meta">${analyticsEscapeHtml(card.meta)}</div>
    </div>
  `).join('');
    analyticsElements.summaryGrid.innerHTML = hero + tiles;
}
function renderWorkflowPerformanceTable(overall) {
    const rows = overall.perWorkflow || [];
    if (!rows.length) {
        analyticsElements.workflowTable.innerHTML = '<div class="analytics-empty">No workflow runs yet</div>';
        return;
    }
    analyticsElements.workflowTable.innerHTML = `
    <div class="analytics-table-row analytics-table-head workflow-performance-row">
      <div>Workflow</div>
      <div>Runs</div>
      <div>Total</div>
      <div>Average</div>
      <div>Completed</div>
      <div>Last</div>
    </div>
    ${rows.map(item => {
        const summary = item.summary || {};
        const active = item.workflowId === analyticsState.selectedWorkflowId;
        const rate = Number(summary.successRate) || 0;
        return `
        <button class="analytics-table-row workflow-performance-row ${active ? 'active' : ''}" data-workflow-id="${analyticsEscapeHtml(item.workflowId)}">
          <div class="analytics-table-primary">
            <span class="analytics-status-dot ${analyticsEscapeHtml(summary.lastStatus || 'idle')}"></span>
            <span class="analytics-table-primary-text">${analyticsEscapeHtml(item.workflowName || 'Untitled Workflow')}</span>
          </div>
          <div class="analytics-num">${formatAnalyticsNumber(summary.totalRuns)}</div>
          <div class="analytics-num">${analyticsEscapeHtml(formatAnalyticsDuration(summary.totalDurationMs))}</div>
          <div class="analytics-num">${analyticsEscapeHtml(formatAnalyticsDuration(summary.averageDurationMs))}</div>
          <div class="analytics-success-cell">
            <span class="analytics-meter"><span style="width:${Math.round(rate * 100)}%"></span></span>
            <span class="analytics-num">${analyticsEscapeHtml(formatAnalyticsPercent(summary.successRate))}</span>
          </div>
          <div class="analytics-num analytics-muted">${analyticsEscapeHtml(formatAnalyticsDate(summary.lastRunAt, true))}</div>
        </button>
      `;
    }).join('')}
  `;
    analyticsElements.workflowTable.querySelectorAll('[data-workflow-id]').forEach(row => {
        row.addEventListener('click', () => {
            analyticsState.selectedWorkflowId = row.dataset.workflowId;
            renderAnalyticsDashboard();
        });
    });
}
function renderWorkflowDetail(analytics) {
    if (!analytics || !analytics.summary) {
        analyticsElements.workflowDetail.innerHTML = '<div class="analytics-empty">Select a workflow above to see its run history.</div>';
        return;
    }
    const summary = analytics.summary;
    const runs = analytics.runs || [];
    const workflowName = analytics.workflow?.name || runs[0]?.workflowName || 'Deleted Workflow';
    const maxDuration = Math.max(...runs.map(run => Number(run.durationMs) || 0), 1);
    analyticsElements.workflowDetail.innerHTML = `
    <div class="workflow-analytics-title">
      <h2>${analyticsEscapeHtml(workflowName)}</h2>
      <span class="analytics-status ${analyticsEscapeHtml(summary.lastStatus || 'idle')}">
        <span class="analytics-status-dot ${analyticsEscapeHtml(summary.lastStatus || 'idle')}"></span>
        ${analyticsEscapeHtml(summary.lastStatus ? formatAnalyticsStatus(summary.lastStatus) : 'No runs')}
      </span>
    </div>

    <div class="analytics-detail-grid">
      <div class="analytics-metric" style="--metric-accent:#22d3ee">
        <div class="analytics-metric-top">
          <span class="analytics-metric-icon">${analyticsIcon('runs')}</span>
          <span class="analytics-metric-label">Runs</span>
        </div>
        <div class="analytics-metric-value">${formatAnalyticsNumber(summary.totalRuns)}</div>
        <div class="analytics-metric-meta">${formatAnalyticsNumber(summary.dryRuns)} dry runs</div>
      </div>
      <div class="analytics-metric" style="--metric-accent:#60a5fa">
        <div class="analytics-metric-top">
          <span class="analytics-metric-icon">${analyticsIcon('clock')}</span>
          <span class="analytics-metric-label">Total Time</span>
        </div>
        <div class="analytics-metric-value">${analyticsEscapeHtml(formatAnalyticsDuration(summary.totalDurationMs))}</div>
        <div class="analytics-metric-meta">${analyticsEscapeHtml(formatAnalyticsDuration(summary.averageDurationMs))} avg</div>
      </div>
      <div class="analytics-metric" style="--metric-accent:#a78bfa">
        <div class="analytics-metric-top">
          <span class="analytics-metric-icon">${analyticsIcon('gauge')}</span>
          <span class="analytics-metric-label">Fastest</span>
        </div>
        <div class="analytics-metric-value">${analyticsEscapeHtml(formatAnalyticsDuration(summary.shortestDurationMs))}</div>
        <div class="analytics-metric-meta">${analyticsEscapeHtml(formatAnalyticsDuration(summary.longestDurationMs))} slowest</div>
      </div>
      <div class="analytics-metric" style="--metric-accent:#34d399">
        <div class="analytics-metric-top">
          <span class="analytics-metric-icon">${analyticsIcon('bolt')}</span>
          <span class="analytics-metric-label">Completed</span>
        </div>
        <div class="analytics-metric-value">${formatAnalyticsNumber(summary.completedRuns)}</div>
        <div class="analytics-metric-meta">${formatAnalyticsNumber(summary.stoppedRuns)} stopped, ${formatAnalyticsNumber(summary.errorRuns)} errors</div>
      </div>
    </div>

    <div class="analytics-duration-list">
      <div class="analytics-duration-caption">Run durations</div>
      ${runs.length ? runs.slice(0, 12).map(run => `
        <div class="analytics-duration-row">
          <div class="analytics-duration-info">
            <span>${analyticsEscapeHtml(formatAnalyticsDate(run.startedAt))}</span>
            <span class="analytics-status ${analyticsEscapeHtml(run.status)}">
              <span class="analytics-status-dot ${analyticsEscapeHtml(run.status)}"></span>
              ${analyticsEscapeHtml(formatAnalyticsStatus(run.status))}
            </span>
          </div>
          <div class="analytics-duration-bar">
            <span class="status-${analyticsEscapeHtml(run.status || 'idle')}" style="width: ${Math.max(4, ((Number(run.durationMs) || 0) / maxDuration) * 100)}%"></span>
          </div>
          <div class="analytics-duration-value">${analyticsEscapeHtml(formatAnalyticsDuration(run.durationMs))}</div>
        </div>
      `).join('') : '<div class="analytics-empty">No runs recorded</div>'}
    </div>

    ${renderRunLog(runs)}
  `;
}
function renderRunLog(runs) {
    if (!runs.length)
        return '';
    return `
    <div class="analytics-run-log">
      <div class="analytics-table-row analytics-table-head run-log-row">
        <div>Started</div>
        <div>Status</div>
        <div>Duration</div>
        <div>Loops</div>
        <div>Actions</div>
      </div>
      ${runs.map(run => `
        <div class="analytics-table-row run-log-row">
          <div class="analytics-muted">${analyticsEscapeHtml(formatAnalyticsDate(run.startedAt))}</div>
          <div><span class="analytics-status ${analyticsEscapeHtml(run.status)}"><span class="analytics-status-dot ${analyticsEscapeHtml(run.status)}"></span>${analyticsEscapeHtml(formatAnalyticsStatus(run.status))}</span></div>
          <div class="analytics-num">${analyticsEscapeHtml(formatAnalyticsDuration(run.durationMs))}</div>
          <div class="analytics-num">${analyticsEscapeHtml(formatAnalyticsLoops(run))}</div>
          <div class="analytics-num">${formatAnalyticsNumber(run.actions || 0)}</div>
        </div>
      `).join('')}
    </div>
  `;
}
function renderRecentRuns(runs) {
    if (!runs.length) {
        analyticsElements.recentRuns.innerHTML = '<div class="analytics-empty">No workflow runs yet</div>';
        return;
    }
    analyticsElements.recentRuns.innerHTML = `
    <div class="analytics-table-row analytics-table-head recent-run-row">
      <div>Workflow</div>
      <div>Status</div>
      <div>Duration</div>
      <div>Started</div>
    </div>
    ${runs.map(run => `
      <button class="analytics-table-row recent-run-row" data-workflow-id="${analyticsEscapeHtml(run.workflowId)}">
        <div class="analytics-table-primary">
          <span class="analytics-status-dot ${analyticsEscapeHtml(run.status || 'idle')}"></span>
          <span class="analytics-table-primary-text">${analyticsEscapeHtml(run.workflowName || 'Untitled Workflow')}</span>
        </div>
        <div><span class="analytics-status ${analyticsEscapeHtml(run.status)}"><span class="analytics-status-dot ${analyticsEscapeHtml(run.status)}"></span>${analyticsEscapeHtml(formatAnalyticsStatus(run.status))}</span></div>
        <div class="analytics-num">${analyticsEscapeHtml(formatAnalyticsDuration(run.durationMs))}</div>
        <div class="analytics-num analytics-muted">${analyticsEscapeHtml(formatAnalyticsDate(run.startedAt, true))}</div>
      </button>
    `).join('')}
  `;
    analyticsElements.recentRuns.querySelectorAll('[data-workflow-id]').forEach(row => {
        row.addEventListener('click', () => {
            analyticsState.selectedWorkflowId = row.dataset.workflowId;
            renderAnalyticsDashboard();
        });
    });
}
/* ---------- Visualization helpers ---------- */
// A multi-segment donut showing how runs ended: completed / stopped / error.
// Replaces the old single "success rate" ring, which was ambiguous.
function renderOutcomeDonut(summary) {
    const total = Number(summary.totalRuns) || 0;
    const completed = Number(summary.completedRuns) || 0;
    const stopped = Number(summary.stoppedRuns) || 0;
    const errored = Number(summary.errorRuns) || 0;
    const other = Math.max(0, total - completed - stopped - errored);
    const completionPct = total ? Math.round((completed / total) * 100) : 0;
    // r chosen so circumference ≈ 100, letting stroke-dasharray act as a percentage.
    const segments = [
        { count: completed, color: '#34d399' },
        { count: stopped, color: '#fbbf24' },
        { count: errored, color: '#f87171' },
        { count: other, color: '#5b6478' }
    ].filter(seg => seg.count > 0);
    let circles = '<circle class="analytics-donut-track" cx="20" cy="20" r="15.915" />';
    if (total > 0) {
        let cumulative = 0;
        circles += segments.map(seg => {
            const len = (seg.count / total) * 100;
            const dashoffset = (25 - cumulative + 100) % 100;
            cumulative += len;
            return `<circle class="analytics-donut-seg" cx="20" cy="20" r="15.915" stroke="${seg.color}" stroke-dasharray="${len} ${100 - len}" stroke-dashoffset="${dashoffset}" />`;
        }).join('');
    }
    return `
    <svg class="analytics-donut" viewBox="0 0 40 40" role="img" aria-label="${completionPct}% of runs completed">
      ${circles}
      <text class="analytics-donut-value" x="20" y="20" dominant-baseline="central" text-anchor="middle">${total ? completionPct + '%' : '—'}</text>
    </svg>
  `;
}
function renderOutcomeLegend(summary) {
    const items = [
        { label: 'Completed', cls: 'completed', count: Number(summary.completedRuns) || 0 },
        { label: 'Stopped', cls: 'stopped', count: Number(summary.stoppedRuns) || 0 },
        { label: 'Error', cls: 'error', count: Number(summary.errorRuns) || 0 }
    ];
    return `
    <div class="analytics-outcome-legend">
      ${items.map(item => `
        <span class="analytics-outcome-item">
          <span class="analytics-status-dot ${item.cls}"></span>
          <span class="analytics-outcome-label">${item.label}</span>
          <span class="analytics-outcome-count">${formatAnalyticsNumber(item.count)}</span>
        </span>
      `).join('')}
    </div>
  `;
}
function renderActivityBars(runs) {
    if (!runs || !runs.length) {
        return '<div class="analytics-activity-empty">No recent runs</div>';
    }
    // Oldest -> newest, up to 24 bars.
    const ordered = [...runs].slice(0, 24).reverse();
    const max = Math.max(...ordered.map(r => Number(r.durationMs) || 0), 1);
    const bars = ordered.map(run => {
        const h = Math.max(8, Math.round(((Number(run.durationMs) || 0) / max) * 100));
        const status = run.status || 'idle';
        const title = `${formatAnalyticsStatus(status)} · ${formatAnalyticsDuration(run.durationMs)}`;
        return `<span class="analytics-bar status-${analyticsEscapeHtml(status)}" style="height:${h}%" title="${analyticsEscapeHtml(title)}"></span>`;
    }).join('');
    return `<div class="analytics-activity-bars">${bars}</div>`;
}
function analyticsIcon(name) {
    const icons = {
        runs: '<path d="M5 3l14 9-14 9V3z"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        bolt: '<path d="M13 2L4.5 13H11l-1 9 8.5-11H12l1-9z"/>',
        gauge: '<path d="M12 14l4-4"/><path d="M3.5 18a9 9 0 1 1 17 0"/>',
        layers: '<path d="M12 2l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/>',
        calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'
    };
    const body = icons[name] || icons.runs;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
/* ---------- Formatting ---------- */
function formatAnalyticsNumber(value, decimals = 0) {
    const number = Number(value);
    if (!Number.isFinite(number))
        return '0';
    return number.toLocaleString(undefined, {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals
    });
}
function formatAnalyticsPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number))
        return '0%';
    return `${Math.round(number * 100)}%`;
}
function formatAnalyticsDuration(ms) {
    const duration = Number(ms);
    if (!Number.isFinite(duration) || duration <= 0)
        return '0ms';
    if (duration < 1000)
        return `${Math.round(duration)}ms`;
    const totalSeconds = Math.round(duration / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0)
        return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0)
        return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}
function formatAnalyticsDate(isoString, compact = false) {
    if (!isoString)
        return 'Never';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime()))
        return 'Unknown';
    if (compact) {
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}
function formatAnalyticsStatus(status) {
    const labels = {
        completed: 'Completed',
        stopped: 'Stopped',
        error: 'Error',
        idle: 'No runs'
    };
    return labels[status] || status || 'Unknown';
}
function formatAnalyticsLoops(run) {
    const completed = run.completedLoops;
    const configured = run.loopsConfigured || 1;
    if (completed === null || completed === undefined)
        return String(configured);
    return `${completed}/${configured}`;
}
function analyticsEscapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value === null || value === undefined ? '' : String(value);
    return div.innerHTML;
}

// ===== workflows-state.ts =====
/**
 * Workflow Studio - Workflows View
 *
 * Handles workflow list display and management
 */
let workflowGrid = null;
let emptyWorkflows = null;
let recentRunContainer = null;
let recentAddedContainer = null;
/**
 * Initialize workflows view
 */
function initWorkflowsView() {
    workflowGrid = document.getElementById('workflow-grid');
    emptyWorkflows = document.getElementById('empty-workflows');
    recentRunContainer = document.getElementById('recent-ran-workflows-list');
    recentAddedContainer = document.getElementById('recent-added-workflows-list');
    // New workflow buttons
    document.getElementById('btn-new-workflow').addEventListener('click', createNewWorkflow);
    document.getElementById('btn-new-workflow-empty')?.addEventListener('click', createNewWorkflow);
    // Import/Export buttons
    document.getElementById('btn-import-workflow')?.addEventListener('click', importWorkflow);
    document.getElementById('btn-export-all')?.addEventListener('click', exportAllWorkflows);
    // Migrate any execution history kept by older versions in localStorage
    migrateLegacyExecutionHistory();
}
/**
 * Render the workflow list
 */
function renderWorkflowList() {
    // Clear existing cards (except empty state)
    const cards = workflowGrid.querySelectorAll('.workflow-card');
    cards.forEach(card => card.remove());
    // Update workflow count badge
    const countEl = document.getElementById('workflow-count');
    const sectionHeader = document.querySelector('.workflows-section-header');
    if (countEl)
        countEl.textContent = state.workflows.length > 0 ? state.workflows.length : '';
    if (sectionHeader)
        sectionHeader.classList.toggle('hidden', state.workflows.length === 0);
    if (state.workflows.length === 0) {
        emptyWorkflows.classList.remove('hidden');
        return;
    }
    emptyWorkflows.classList.add('hidden');
    state.workflows.forEach(workflow => {
        const card = createWorkflowCard(workflow);
        workflowGrid.insertBefore(card, emptyWorkflows);
    });
}

// ===== workflows-cards.ts =====
/**
 * Create a workflow card element
 */
function createWorkflowCard(workflow) {
    const card = document.createElement('div');
    card.className = 'card card-clickable workflow-card';
    card.dataset.id = workflow.id;
    const actionCount = workflow.actions?.length || 0;
    const loopCount = workflow.loopCount || 1;
    const hotkey = getWorkflowHotkey(workflow.id);
    card.innerHTML = `
    <div class="workflow-card-header">
      <h3 class="workflow-card-title">
        ${escapeHtml(workflow.name)}
        ${hotkey ? `<span class="hotkey-badge">${hotkey}</span>` : ''}
      </h3>
      <div class="workflow-card-actions">
        <button class="btn btn-icon" data-action="play" title="Run">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </button>
        <button class="btn btn-icon" data-action="hotkey" title="Assign Hotkey">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="M6 8h.01M10 8h.01M14 8h.01"/>
          </svg>
        </button>
        <button class="btn btn-icon" data-action="export" title="Export">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        <button class="btn btn-icon" data-action="duplicate" title="Duplicate">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
        <button class="btn btn-icon btn-danger" data-action="delete" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
    ${workflow.description ? `<p class="workflow-card-description">${escapeHtml(workflow.description)}</p>` : ''}
    <div class="workflow-card-meta">
      <span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        ${actionCount} action${actionCount !== 1 ? 's' : ''}
      </span>
      <span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"/>
          <polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
        ${loopCount} loop${loopCount !== 1 ? 's' : ''}
      </span>
      <span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        ${formatDate(workflow.updatedAt)}
      </span>
    </div>
  `;
    // Card click - open in editor
    card.addEventListener('click', (e) => {
        // Ignore if clicking action buttons
        if (e.target.closest('[data-action]'))
            return;
        openWorkflowInEditor(workflow.id);
    });
    // Action buttons
    card.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            switch (action) {
                case 'play':
                    runWorkflow(workflow.id);
                    break;
                case 'duplicate':
                    duplicateWorkflow(workflow.id);
                    break;
                case 'delete':
                    confirmDeleteWorkflow(workflow);
                    break;
                case 'export':
                    exportWorkflow(workflow.id);
                    break;
                case 'hotkey':
                    showHotkeyModal(workflow);
                    break;
            }
        });
    });
    return card;
}

// ===== workflows-actions.ts =====
/**
 * Create a new workflow
 */
async function createNewWorkflow() {
    try {
        const workflow = await window.workflowAPI.createWorkflow({
            name: 'Untitled Workflow',
            description: '',
            actions: []
        });
        state.workflows.unshift(workflow);
        renderWorkflowList();
        // Open in editor
        openWorkflowInEditor(workflow.id);
        showToast('success', 'Created', 'New workflow created');
    }
    catch (error) {
        console.error('Failed to create workflow:', error);
        showToast('error', 'Error', 'Failed to create workflow');
    }
}
/**
 * Open a workflow in the editor
 */
async function openWorkflowInEditor(workflowId) {
    try {
        const workflow = await window.workflowAPI.getWorkflow(workflowId);
        if (!workflow) {
            showToast('error', 'Error', 'Workflow not found');
            return;
        }
        state.currentWorkflow = workflow;
        loadWorkflowIntoEditor(workflow);
        navigateTo('editor');
    }
    catch (error) {
        console.error('Failed to open workflow:', error);
        showToast('error', 'Error', 'Failed to open workflow');
    }
}
/**
 * Run a workflow
 */
async function runWorkflow(workflowId) {
    try {
        const workflow = await window.workflowAPI.getWorkflow(workflowId);
        if (!workflow) {
            showToast('error', 'Error', 'Workflow not found');
            return;
        }
        if (!workflow.actions || workflow.actions.length === 0) {
            showToast('warning', 'Empty', 'This workflow has no actions');
            return;
        }
        // Check permissions first (macOS) to keep permission flow explicit
        if (window.platform.isMac) {
            try {
                const status = await window.workflowAPI.getPermissionStatus();
                if (!status.accessibility) {
                    showAccessibilityPermissionModal();
                    return;
                }
            }
            catch (err) {
                console.warn('Could not check permissions:', err);
            }
        }
        const result = await window.workflowAPI.executeWorkflow(workflow);
        if (!result.success) {
            if (result.error && result.error.includes('Accessibility permission')) {
                showAccessibilityPermissionModal();
            }
            else {
                showToast('error', 'Error', result.error || 'Failed to start workflow');
            }
        }
    }
    catch (error) {
        console.error('Failed to run workflow:', error);
        showToast('error', 'Error', 'Failed to run workflow');
    }
}
function showAccessibilityPermissionModal() {
    showModal('Accessibility Permission Required', `
    <p>Workflow Studio needs Accessibility permission to control mouse and keyboard.</p>
    <p>Please grant access in:</p>
    <ol style="margin: 12px 0; padding-left: 20px;">
      <li>Open System Settings</li>
      <li>Go to Privacy & Security > Accessibility</li>
      <li>Add and enable Workflow Studio</li>
    </ol>
    <p>After granting permission, run the workflow again.</p>
  `, [
        {
            label: 'Open Accessibility Settings',
            class: 'btn-primary',
            onClick: async () => {
                await window.workflowAPI.requestAccessibilityPermission();
            }
        },
        { label: 'Cancel', class: 'btn-secondary' }
    ]);
}
/**
 * Duplicate a workflow
 */
async function duplicateWorkflow(workflowId) {
    try {
        const duplicated = await window.workflowAPI.duplicateWorkflow(workflowId);
        state.workflows.unshift(duplicated);
        renderWorkflowList();
        showToast('success', 'Duplicated', 'Workflow duplicated');
    }
    catch (error) {
        console.error('Failed to duplicate workflow:', error);
        showToast('error', 'Error', 'Failed to duplicate workflow');
    }
}
/**
 * Confirm and delete a workflow
 */
function confirmDeleteWorkflow(workflow) {
    showConfirm('Delete Workflow', `Are you sure you want to delete "${escapeHtml(workflow.name)}"? This cannot be undone.`, () => deleteWorkflow(workflow.id));
}
/**
 * Delete a workflow
 */
async function deleteWorkflow(workflowId) {
    try {
        await window.workflowAPI.deleteWorkflow(workflowId);
        state.workflows = state.workflows.filter(w => w.id !== workflowId);
        renderWorkflowList();
        showToast('success', 'Deleted', 'Workflow deleted');
    }
    catch (error) {
        console.error('Failed to delete workflow:', error);
        showToast('error', 'Error', 'Failed to delete workflow');
    }
}

// ===== workflows-io.ts =====
/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
    if (!str)
        return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
/**
 * Import a workflow from file
 */
async function importWorkflow() {
    try {
        const workflow = await window.workflowAPI.importWorkflow();
        if (workflow) {
            state.workflows.unshift(workflow);
            renderWorkflowList();
            showToast('success', 'Imported', `Workflow "${workflow.name}" imported`);
        }
    }
    catch (error) {
        console.error('Failed to import workflow:', error);
        showToast('error', 'Error', 'Failed to import workflow');
    }
}
/**
 * Export a single workflow
 */
async function exportWorkflow(workflowId) {
    try {
        const result = await window.workflowAPI.exportWorkflow(workflowId);
        if (result) {
            showToast('success', 'Exported', 'Workflow exported successfully');
        }
    }
    catch (error) {
        console.error('Failed to export workflow:', error);
        showToast('error', 'Error', 'Failed to export workflow');
    }
}
/**
 * Export all workflows (for backup)
 */
async function exportAllWorkflows() {
    try {
        for (const workflow of state.workflows) {
            await window.workflowAPI.exportWorkflow(workflow.id);
        }
        showToast('success', 'Exported', `${state.workflows.length} workflows exported`);
    }
    catch (error) {
        console.error('Failed to export workflows:', error);
        showToast('error', 'Error', 'Failed to export workflows');
    }
}
/**
 * Render recent workflows
 */
async function renderRecentWorkflows() {
    if (!recentRunContainer && !recentAddedContainer)
        return;
    try {
        const [recentRan, recentAdded] = await Promise.all([
            window.workflowAPI.getRecentRunWorkflows?.() || [],
            window.workflowAPI.getRecentWorkflows()
        ]);
        renderRecentWorkflowList(recentRunContainer, recentRan, 'No workflow runs yet', workflow => {
            const duration = formatDurationShort(workflow.lastDurationMs);
            const ranAt = workflow.lastRunAt ? formatTimeAgo(workflow.lastRunAt) : '';
            return [duration, ranAt].filter(Boolean).join(' - ');
        });
        renderRecentWorkflowList(recentAddedContainer, recentAdded, 'No workflows added yet', workflow => {
            return workflow.createdAt ? formatTimeAgo(workflow.createdAt) : '';
        });
    }
    catch (error) {
        console.error('Failed to load recent workflows:', error);
    }
}
function renderRecentWorkflowList(container, workflows, emptyMessage, metaFormatter) {
    if (!container)
        return;
    if (!workflows || workflows.length === 0) {
        container.innerHTML = `<p class="recent-empty">${emptyMessage}</p>`;
        return;
    }
    container.innerHTML = workflows.slice(0, 5).map(workflow => {
        const meta = metaFormatter ? metaFormatter(workflow) : '';
        return `
      <div class="recent-item" data-id="${workflow.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span class="recent-item-content">
          <span class="recent-item-name">${escapeHtml(workflow.name)}</span>
          ${meta ? `<span class="recent-item-meta">${escapeHtml(meta)}</span>` : ''}
        </span>
      </div>
    `;
    }).join('');
    container.querySelectorAll('.recent-item').forEach(item => {
        item.addEventListener('click', () => {
            openWorkflowInEditor(item.dataset.id);
        });
    });
}
/**
 * One-time migration: older versions stored execution history in localStorage.
 * Move it into the main-process store (which powers analytics and the
 * "Recently ran" list), then drop the legacy copy.
 */
async function migrateLegacyExecutionHistory() {
    if (!window.workflowAPI?.importExecutionHistory)
        return;
    try {
        const stored = localStorage.getItem('workflow-execution-history');
        if (!stored)
            return;
        const existing = await window.workflowAPI.getExecutionHistory({ limit: 1 });
        if (Array.isArray(existing) && existing.length > 0)
            return; // store already populated
        const legacyHistory = JSON.parse(stored);
        if (!Array.isArray(legacyHistory) || legacyHistory.length === 0)
            return;
        const result = await window.workflowAPI.importExecutionHistory(legacyHistory);
        if (result?.success) {
            localStorage.removeItem('workflow-execution-history');
        }
    }
    catch (error) {
        console.warn('Failed to migrate legacy execution history:', error);
    }
}
/**
 * Refresh the views that summarise past runs after an execution finishes.
 * The run itself is recorded by the main process; this just re-pulls the
 * derived "Recently ran" list and analytics dashboard.
 */
function addToExecutionHistory() {
    renderRecentWorkflows();
    if (typeof renderAnalyticsDashboard === 'function' && state.currentView === 'analytics') {
        renderAnalyticsDashboard();
    }
}

// ===== workflows-history.ts =====
/**
 * Open analytics focused on a specific workflow
 */
function openWorkflowAnalytics(workflowId) {
    if (typeof showWorkflowAnalytics === 'function') {
        showWorkflowAnalytics(workflowId);
        return;
    }
    navigateTo('analytics');
}
/**
 * Format time ago
 */
function formatTimeAgo(dateString) {
    if (!dateString)
        return 'Unknown';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime()))
        return 'Unknown';
    const now = new Date();
    const diffMs = +now - +date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1)
        return 'Just now';
    if (diffMins < 60)
        return `${diffMins}m ago`;
    if (diffHours < 24)
        return `${diffHours}h ago`;
    if (diffDays < 7)
        return `${diffDays}d ago`;
    return date.toLocaleDateString();
}
function formatDurationShort(ms) {
    const duration = Number(ms);
    if (!Number.isFinite(duration) || duration <= 0)
        return '0ms';
    if (duration < 1000) {
        return `${Math.round(duration)}ms`;
    }
    const totalSeconds = Math.round(duration / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
}
/**
 * Setup hotkey trigger for workflow
 */
async function setupWorkflowHotkey(workflowId, hotkey) {
    // Store hotkey mapping
    const hotkeyMap = JSON.parse(localStorage.getItem('workflow-hotkeys') || '{}');
    // Remove existing mapping for this hotkey
    Object.keys(hotkeyMap).forEach(key => {
        if (hotkeyMap[key] === hotkey) {
            delete hotkeyMap[key];
        }
    });
    if (hotkey) {
        hotkeyMap[workflowId] = hotkey;
    }
    else {
        delete hotkeyMap[workflowId];
    }
    localStorage.setItem('workflow-hotkeys', JSON.stringify(hotkeyMap));
    showToast('success', 'Hotkey Set', hotkey ? `Workflow bound to ${hotkey}` : 'Hotkey removed');
}
/**
 * Get workflow hotkey
 */
function getWorkflowHotkey(workflowId) {
    const hotkeyMap = JSON.parse(localStorage.getItem('workflow-hotkeys') || '{}');
    return hotkeyMap[workflowId] || null;
}
/**
 * Show hotkey assignment modal for a workflow
 */
function showHotkeyModal(workflow) {
    const currentHotkey = getWorkflowHotkey(workflow.id);
    const hotkeys = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F8', 'F9', 'F10', 'F11', 'F12'];
    showModal('Assign Hotkey', `
      <p style="margin-bottom: var(--space-4)">Assign a hotkey to run <strong>${escapeHtml(workflow.name)}</strong></p>
      <div class="config-field">
        <label>Hotkey</label>
        <select id="hotkey-select">
          <option value="">None</option>
          ${hotkeys.map(hk => `<option value="${hk}" ${currentHotkey === hk ? 'selected' : ''}>${hk}</option>`).join('')}
        </select>
        <p class="config-field-hint">Note: F7 is reserved for panic stop</p>
      </div>
    `, [
        { label: 'Cancel', action: 'close' },
        { label: 'Save', primary: true, action: () => {
                const hotkey = document.getElementById('hotkey-select').value;
                setupWorkflowHotkey(workflow.id, hotkey);
                closeModal();
            } }
    ]);
}

// ===== editor-state-metadata.ts =====
/**
 * Workflow Studio - Editor View
 *
 * Handles workflow editing, action palette, and drag-drop
 */
// Action types with their metadata
const ACTION_TYPES = {
    mouse_move: {
        name: 'Mouse Move',
        icon: '<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/>',
        description: 'Move cursor to position'
    },
    mouse_click: {
        name: 'Mouse Click',
        icon: '<path d="M9 9a3 3 0 1 0 6 0 3 3 0 0 0-6 0z"/><path d="M12 3v3m0 12v3m9-9h-3M6 12H3"/>',
        description: 'Click at position'
    },
    keyboard: {
        name: 'Keyboard',
        icon: '<rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><line x1="6" y1="8" x2="6.01" y2="8"/><line x1="10" y1="8" x2="10.01" y2="8"/><line x1="14" y1="8" x2="14.01" y2="8"/><line x1="18" y1="8" x2="18.01" y2="8"/><line x1="8" y1="12" x2="8.01" y2="12"/><line x1="12" y1="12" x2="12.01" y2="12"/><line x1="16" y1="12" x2="16.01" y2="12"/><line x1="7" y1="16" x2="17" y2="16"/>',
        description: 'Type text or press keys'
    },
    wait: {
        name: 'Wait',
        icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        description: 'Wait for duration'
    },
    conditional: {
        name: 'Conditional',
        icon: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
        description: 'If/then logic'
    },
    loop: {
        name: 'Loop',
        icon: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
        description: 'Repeat actions'
    },
    image_detect: {
        name: 'Find Image',
        icon: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
        description: 'Detect image on screen'
    },
    pixel_detect: {
        name: 'Find Pixel',
        icon: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
        description: 'Find pixel by color'
    }
};
// Editor state
let editorState = {
    selectedActionIndex: -1,
    draggedAction: null,
    isDirty: false,
    isAIGenerating: false,
    templates: [],
    selectedActionIndices: [], // For multi-select when saving templates
    compactView: false
};
// DOM references
let actionList = null;
let actionSequence = null;
let workflowNameInput = null;
let loopCountInput = null;
let loopInfiniteInput = null;
let loopDelayMinInput = null;
let loopDelayMaxInput = null;
let configPanel = null;
let templateList = null;
let toggleViewBtn = null;
let toggleAIBtn = null;
let aiComposer = null;
let aiGameSelect = null;
let aiModelSelect = null;
let aiApplyModeSelect = null;
let aiPromptInput = null;
let aiGenerateBtn = null;
let aiComposerMeta = null;
let aiContextPill = null;
/**
 * Initialize editor view
 */
function initEditorView() {
    actionList = document.getElementById('action-list');
    actionSequence = document.getElementById('action-sequence');
    workflowNameInput = document.getElementById('workflow-name');
    loopCountInput = document.getElementById('loop-count');
    loopInfiniteInput = document.getElementById('loop-infinite');
    loopDelayMinInput = document.getElementById('loop-delay-min');
    loopDelayMaxInput = document.getElementById('loop-delay-max');
    configPanel = document.getElementById('config-panel');
    templateList = document.getElementById('template-list');
    toggleViewBtn = document.getElementById('btn-toggle-view');
    toggleAIBtn = document.getElementById('btn-toggle-ai');
    aiComposer = document.getElementById('ai-composer');
    aiGameSelect = document.getElementById('ai-game-select');
    aiModelSelect = document.getElementById('ai-model-select');
    aiApplyModeSelect = document.getElementById('ai-apply-mode');
    aiPromptInput = document.getElementById('ai-prompt-input');
    aiGenerateBtn = document.getElementById('btn-ai-generate');
    aiComposerMeta = document.getElementById('ai-composer-meta');
    aiContextPill = document.getElementById('ai-context-pill');
    // Populate action palette
    populateActionPalette();
    // Setup event listeners
    setupEditorEvents();
    // Setup view toggle
    setupViewToggle();
    // Setup preview overlay
    setupPreviewOverlay();
    // Setup AI composer
    initAIComposer();
    // Load templates
    loadTemplates();
}

// ===== editor-view-controls.ts =====
/**
 * Setup view toggle button
 */
function setupViewToggle() {
    if (!toggleViewBtn)
        return;
    toggleViewBtn.addEventListener('click', toggleCompactView);
    // Keyboard shortcut V for view toggle
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'v' && !isInputFocused()) {
            e.preventDefault();
            toggleCompactView();
        }
    });
}
/**
 * Check if an input element is focused
 */
function isInputFocused() {
    const active = document.activeElement;
    return active && (active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.tagName === 'SELECT' ||
        active.isContentEditable);
}
/**
 * Toggle between compact and normal view
 */
function toggleCompactView() {
    editorState.compactView = !editorState.compactView;
    if (editorState.compactView) {
        actionSequence.classList.add('compact-view');
    }
    else {
        actionSequence.classList.remove('compact-view');
    }
    // Update button icons
    const listIcon = document.getElementById('icon-list-view');
    const gridIcon = document.getElementById('icon-grid-view');
    if (listIcon && gridIcon) {
        listIcon.style.display = editorState.compactView ? 'none' : 'block';
        gridIcon.style.display = editorState.compactView ? 'block' : 'none';
    }
}
/**
 * Setup preview overlay toggle
 */
function setupPreviewOverlay() {
    const previewBtn = document.getElementById('btn-preview-overlay');
    if (!previewBtn)
        return;
    let previewActive = false;
    async function togglePreview() {
        if (!state.currentWorkflow) {
            showToast('warning', 'No Workflow', 'Open a workflow first');
            return;
        }
        if (previewActive) {
            await window.workflowAPI.closeWorkflowPreview();
            previewActive = false;
            previewBtn.classList.remove('active');
            return;
        }
        const result = await window.workflowAPI.showWorkflowPreview(state.currentWorkflow);
        if (result && result.success) {
            previewActive = true;
            previewBtn.classList.add('active');
            showToast('info', 'Preview Overlay', `Showing ${result.targetCount} targets. Press ESC on overlay to close.`);
        }
        else if (result && result.error) {
            showToast('warning', 'No Targets', result.error);
        }
    }
    previewBtn.addEventListener('click', togglePreview);
    // Listen for overlay closed externally (ESC on overlay)
    window.workflowAPI.onWorkflowPreviewClosed(() => {
        previewActive = false;
        previewBtn.classList.remove('active');
    });
    // Keyboard shortcut P
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'p' && !isInputFocused()) {
            e.preventDefault();
            togglePreview();
        }
    });
}
/**
 * Initialize AI composer controls in editor.
 */

// ===== editor-ai-compose.ts =====
async function initAIComposer() {
    if (!aiGenerateBtn || !aiGameSelect || !aiModelSelect)
        return;
    initAIComposerVisibility();
    syncAIComposerFromSettings();
    await loadAISupportedGames();
    aiGameSelect.addEventListener('change', updateAIContextPill);
    aiGenerateBtn.addEventListener('click', handleAIGenerateWorkflow);
    toggleAIBtn?.addEventListener('click', () => toggleAIComposerVisibility());
    aiPromptInput?.addEventListener('keydown', async (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            await handleAIGenerateWorkflow();
        }
    });
    window.addEventListener('settings:updated', () => {
        syncAIComposerFromSettings();
    });
}
function initAIComposerVisibility() {
    const storedValue = safeGetLocalStorage('editor.aiComposerCollapsed');
    const shouldCollapse = storedValue === null ? true : storedValue === 'true';
    toggleAIComposerVisibility(!shouldCollapse, false);
}
function toggleAIComposerVisibility(forceExpanded, persist = true) {
    if (!aiComposer)
        return;
    const expanded = typeof forceExpanded === 'boolean'
        ? forceExpanded
        : aiComposer.classList.contains('collapsed');
    aiComposer.classList.toggle('collapsed', !expanded);
    if (toggleAIBtn) {
        toggleAIBtn.classList.toggle('active', expanded);
        toggleAIBtn.setAttribute('aria-expanded', String(expanded));
        toggleAIBtn.title = expanded ? 'Hide AI Draft Panel' : 'Show AI Draft Panel';
    }
    if (persist) {
        safeSetLocalStorage('editor.aiComposerCollapsed', String(!expanded));
    }
}
async function loadAISupportedGames() {
    try {
        const supported = await window.workflowAPI.getAISupportedGames();
        if (!Array.isArray(supported) || supported.length === 0) {
            updateAIContextPill();
            return;
        }
        const existing = new Set(Array.from(aiGameSelect.options).map((option) => option.value));
        supported.forEach((game) => {
            if (!game?.id || !game?.name || existing.has(game.id))
                return;
            const option = document.createElement('option');
            option.value = game.id;
            option.textContent = game.name;
            aiGameSelect.appendChild(option);
        });
    }
    catch (error) {
        console.warn('Failed to load AI supported games:', error);
    }
    finally {
        updateAIContextPill();
    }
}
function syncAIComposerFromSettings() {
    const preferredModel = state.settings?.ai?.preferredModel || 'codex-5.3';
    if (aiModelSelect) {
        aiModelSelect.value = preferredModel;
    }
}
function updateAIContextPill() {
    if (!aiContextPill || !aiGameSelect)
        return;
    const selectedText = aiGameSelect.options[aiGameSelect.selectedIndex]?.textContent || 'Generic context';
    aiContextPill.textContent = selectedText;
}
function safeGetLocalStorage(key) {
    try {
        return window.localStorage.getItem(key);
    }
    catch {
        return null;
    }
}
function safeSetLocalStorage(key, value) {
    try {
        window.localStorage.setItem(key, value);
    }
    catch {
        // Ignore storage persistence errors (private mode, disabled storage, etc.)
    }
}
function setAIGeneratingState(isGenerating, message) {
    editorState.isAIGenerating = isGenerating;
    if (aiGenerateBtn) {
        if (!aiGenerateBtn.dataset.defaultHtml) {
            aiGenerateBtn.dataset.defaultHtml = aiGenerateBtn.innerHTML;
        }
        aiGenerateBtn.disabled = isGenerating;
        aiGenerateBtn.innerHTML = isGenerating
            ? 'Generating...'
            : aiGenerateBtn.dataset.defaultHtml;
    }
    if (aiComposerMeta) {
        aiComposerMeta.textContent = message || '';
    }
}
async function handleAIGenerateWorkflow() {
    if (editorState.isAIGenerating)
        return;
    if (!state.currentWorkflow) {
        showToast('warning', 'No Workflow', 'Create or open a workflow first.');
        return;
    }
    const prompt = aiPromptInput?.value?.trim() || '';
    if (!prompt) {
        showToast('warning', 'Prompt Required', 'Describe the workflow you want to generate.');
        return;
    }
    setAIGeneratingState(true, 'Generating...');
    let result;
    try {
        result = await window.workflowAPI.generateWorkflowWithAI({
            prompt,
            gameId: aiGameSelect?.value || 'generic',
            preferredModel: aiModelSelect?.value || state.settings?.ai?.preferredModel || 'codex-5.3',
            applyMode: aiApplyModeSelect?.value || 'replace',
            currentWorkflow: state.currentWorkflow
        });
    }
    catch (error) {
        console.error('[AI] Generation IPC failed:', error);
        showToast('error', 'AI Error', error.message || 'Failed to contact AI service.');
        setAIGeneratingState(false);
        return;
    }
    setAIGeneratingState(false);
    if (!result || !result.success) {
        showToast('error', 'AI Error', result?.error || 'No response from AI service.');
        return;
    }
    if (result.data?.action === 'clarify') {
        const clarifyingText = result.data.clarification || 'Please provide more detail.';
        showModal('AI Needs Clarification', `<p>${escapeHtml(clarifyingText)}</p>`, [
            { label: 'Close', class: 'btn-secondary' }
        ]);
        return;
    }
    applyAIGeneratedWorkflow(result.data, result.meta);
}
function applyAIGeneratedWorkflow(payload, meta = {}) {
    const workflowPatch = payload?.workflow || {};
    const actions = Array.isArray(workflowPatch.actions) ? workflowPatch.actions : [];
    if (!actions.length) {
        showToast('warning', 'No Actions', 'AI response did not include any actions.');
        return;
    }
    const actionMode = aiApplyModeSelect?.value || 'replace';
    if (actionMode === 'append') {
        state.currentWorkflow.actions = [...(state.currentWorkflow.actions || []), ...actions];
    }
    else {
        state.currentWorkflow.actions = actions;
    }
    if (workflowPatch.name) {
        state.currentWorkflow.name = workflowPatch.name;
        workflowNameInput.value = workflowPatch.name;
    }
    if (workflowPatch.description) {
        state.currentWorkflow.description = workflowPatch.description;
    }
    if (typeof workflowPatch.infiniteLoop === 'boolean') {
        state.currentWorkflow.infiniteLoop = workflowPatch.infiniteLoop;
        loopInfiniteInput.checked = workflowPatch.infiniteLoop;
        loopCountInput.disabled = workflowPatch.infiniteLoop;
    }
    if (workflowPatch.loopCount) {
        state.currentWorkflow.loopCount = workflowPatch.loopCount;
        loopCountInput.value = workflowPatch.loopCount;
    }
    if (workflowPatch.loopDelay) {
        state.currentWorkflow.loopDelay = workflowPatch.loopDelay;
        loopDelayMinInput.value = workflowPatch.loopDelay.min;
        loopDelayMaxInput.value = workflowPatch.loopDelay.max;
    }
    markDirty();
    renderActionSequence();
    saveCurrentWorkflow();
    const modelLabel = meta?.model ? `Model: ${meta.model}` : 'AI draft generated';
    const summary = payload?.explanation || `${actions.length} action${actions.length !== 1 ? 's' : ''} generated`;
    showToast('success', 'AI Draft Applied', `${summary} · ${modelLabel}`);
}

// ===== editor-palette-events.ts =====
/**
 * Populate the action palette with draggable action items
 */
function populateActionPalette() {
    actionList.innerHTML = '';
    Object.entries(ACTION_TYPES).forEach(([type, meta]) => {
        const item = document.createElement('div');
        item.className = 'action-item';
        item.dataset.type = type;
        item.draggable = true;
        item.innerHTML = `
      <div class="action-item-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${meta.icon}
        </svg>
      </div>
      <div class="action-item-info">
        <div class="action-item-name">${meta.name}</div>
        <div class="action-item-desc">${meta.description}</div>
      </div>
    `;
        // Double click to add
        item.addEventListener('dblclick', () => {
            addActionToSequence(type);
        });
        // Drag start
        item.addEventListener('dragstart', (e) => {
            editorState.draggedAction = { type, isNew: true };
            e.dataTransfer.effectAllowed = 'copy';
            item.classList.add('dragging');
        });
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            editorState.draggedAction = null;
        });
        actionList.appendChild(item);
    });
}
/**
 * Setup editor event listeners
 */
function setupEditorEvents() {
    // Workflow name change
    workflowNameInput.addEventListener('input', () => {
        if (state.currentWorkflow) {
            state.currentWorkflow.name = workflowNameInput.value;
            markDirty();
        }
    });
    workflowNameInput.addEventListener('blur', saveCurrentWorkflow);
    // Infinite loop toggle for main workflow thread
    loopInfiniteInput.addEventListener('change', () => {
        if (state.currentWorkflow) {
            state.currentWorkflow.infiniteLoop = loopInfiniteInput.checked;
            loopCountInput.disabled = loopInfiniteInput.checked;
            markDirty();
            saveCurrentWorkflow();
        }
    });
    // Loop settings
    [loopCountInput, loopDelayMinInput, loopDelayMaxInput].forEach(input => {
        input.addEventListener('change', () => {
            if (state.currentWorkflow) {
                state.currentWorkflow.loopCount = parseInt(loopCountInput.value) || 1;
                state.currentWorkflow.loopDelay = {
                    min: parseInt(loopDelayMinInput.value) || 500,
                    max: parseInt(loopDelayMaxInput.value) || 1000
                };
                markDirty();
                saveCurrentWorkflow();
            }
        });
    });
    // Action sequence drag/drop
    actionSequence.addEventListener('dragover', handleDragOver);
    actionSequence.addEventListener('drop', handleDrop);
    actionSequence.addEventListener('dragleave', handleDragLeave);
    // Toolbar buttons
    document.getElementById('btn-run').addEventListener('click', runCurrentWorkflow);
    document.getElementById('btn-dry-run').addEventListener('click', () => runCurrentWorkflow(true));
    document.getElementById('btn-stop').addEventListener('click', stopExecution);
    document.getElementById('btn-save-workflow').addEventListener('click', manualSaveWorkflow);
    // Ctrl+S to save
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            manualSaveWorkflow();
        }
    });
    // Config panel close
    document.getElementById('btn-close-config').addEventListener('click', closeConfigPanel);
    // Save as template button
    document.getElementById('btn-save-as-template').addEventListener('click', openSaveAsTemplateModal);
}

// ===== editor-sequence-base.ts =====
/**
 * Load a workflow into the editor
 */
function loadWorkflowIntoEditor(workflow) {
    state.currentWorkflow = workflow;
    editorState.selectedActionIndex = -1;
    editorState.isDirty = false;
    // Set form values
    workflowNameInput.value = workflow.name || 'Untitled Workflow';
    loopInfiniteInput.checked = !!workflow.infiniteLoop;
    loopCountInput.value = workflow.loopCount || 1;
    loopCountInput.disabled = !!workflow.infiniteLoop;
    loopDelayMinInput.value = workflow.loopDelay?.min || 500;
    loopDelayMaxInput.value = workflow.loopDelay?.max || 1000;
    // Render action sequence
    renderActionSequence();
    // Close config panel
    closeConfigPanel();
}
/**
 * Render the action sequence
 */
function renderActionSequence() {
    const actions = state.currentWorkflow?.actions || [];
    if (actions.length === 0) {
        actionSequence.innerHTML = `
      <div class="empty-sequence">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        <p>Drag actions here to build your workflow</p>
      </div>
    `;
        return;
    }
    actionSequence.innerHTML = '';
    actions.forEach((action, index) => {
        const item = createSequenceItem(action, index);
        actionSequence.appendChild(item);
    });
}
/**
 * Create a sequence item element
 */
function createSequenceItem(action, index) {
    const meta = ACTION_TYPES[action.type] || { name: 'Unknown', icon: '' };
    const item = document.createElement('div');
    item.className = 'sequence-item';
    item.dataset.index = index;
    item.draggable = true;
    if (index === editorState.selectedActionIndex) {
        item.classList.add('selected');
    }
    const summary = getActionSummary(action);
    const actionName = action.name ? `<div class="sequence-item-name">${escapeHtml(action.name)}</div>` : '';
    const compactLabel = getCompactLabel(action);
    item.innerHTML = `
    <span class="sequence-item-number">${index + 1}</span>
    <div class="sequence-item-icon" data-type="${action.type}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${meta.icon}
      </svg>
    </div>
    <span class="sequence-item-compact-label" title="${escapeHtml(summary)}">${escapeHtml(compactLabel)}</span>
    <div class="sequence-item-content">
      ${actionName}
      <div class="sequence-item-title">${meta.name}</div>
      <div class="sequence-item-summary">${summary}</div>
    </div>
    <div class="sequence-item-actions">
      <button class="btn btn-icon" data-action="edit" title="Edit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="btn btn-icon btn-danger" data-action="delete" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
  `;
    // Apply color to icon
    const iconEl = item.querySelector('.sequence-item-icon');
    const type = action.type;
    iconEl.style.background = getActionColor(type, 0.2);
    iconEl.style.color = getActionColor(type, 1);
    // Click to select
    item.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]') || e.target.closest('.inline-children') || e.target.closest('.inline-toggle'))
            return;
        selectAction(index);
    });
    // Action buttons
    item.querySelector('[data-action="edit"]').addEventListener('click', () => {
        openConfigPanel(index);
    });
    item.querySelector('[data-action="delete"]').addEventListener('click', () => {
        deleteAction(index);
    });
    // Drag for reordering
    item.addEventListener('dragstart', (e) => {
        if (e.target.closest('.inline-children')) {
            e.preventDefault();
            return;
        }
        editorState.draggedAction = { index, isNew: false };
        e.dataTransfer.setData('text/plain', JSON.stringify({
            type: 'main-action',
            index: index
        }));
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => item.classList.add('dragging'), 0);
    });
    item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        editorState.draggedAction = null;
    });
    // Inline nested children for actions with sub-action branches
    const inlineBranches = getInlineBranches(action);
    if (inlineBranches.length > 0) {
        item.appendChild(renderInlineChildren(action, index, inlineBranches));
    }
    return item;
}
/**
 * Get the inline branches for an action type.
 * Returns an array of { key, label, actions } objects.
 * Any action type that has nested sub-actions should be registered here.
 */
function getInlineBranches(action) {
    switch (action.type) {
        case 'loop':
            return [{ key: 'actions', label: 'Loop Actions', actions: action.actions || [] }];
        case 'conditional':
            return [
                { key: 'thenActions', label: 'Then', actions: action.thenActions || [] },
                { key: 'elseActions', label: 'Else', actions: action.elseActions || [] }
            ];
        case 'keyboard':
            if (action.mode === 'hold_and_act') {
                return [{ key: 'actions', label: `Hold ${action.key || 'key'}`, actions: action.actions || [] }];
            }
            return [];
        default:
            return [];
    }
}

// ===== editor-sequence-inline.ts =====
/**
 * Render inline children container for an action's branches.
 * Shared by loop, conditional, keyboard hold_and_act, and any future nested action types.
 *
 * **Nested Container Pattern**: Any action type that can contain sub-actions (loops,
 * conditionals, keyboard hold_and_act, and any future container action types) renders
 * its children inline in the workflow view. This is recursive — a loop inside a loop
 * inside a conditional will render all levels inline with proper indentation and full
 * drag/drop support at every depth. This is the standard, expected way to visualise
 * and interact with nested actions throughout Workflow Studio.
 *
 * Supports: drag/drop reorder within branch, drag from main sequence, drag new actions
 * from the palette, move-out to parent, edit, delete — all at arbitrary nesting depth.
 *
 * @param {Object}  action   - The parent action that owns the branches.
 * @param {number}  index    - Index of the parent action in the top-level actions array.
 * @param {Array}   branches - Array of { key, label, actions } branch descriptors.
 * @param {number}  [depth=0] - Current nesting depth (drives indentation).
 */
function renderInlineChildren(action, index, branches, depth) {
    if (typeof depth !== 'number')
        depth = 0;
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'inline-children';
    childrenContainer.dataset.depth = depth;
    branches.forEach(branch => {
        const branchEl = document.createElement('div');
        branchEl.className = 'inline-branch';
        const header = document.createElement('div');
        header.className = 'inline-branch-header';
        header.innerHTML = `
      <span class="inline-branch-label">${branch.label}</span>
      <span class="inline-branch-count">${branch.actions.length} action${branch.actions.length !== 1 ? 's' : ''}</span>
    `;
        branchEl.appendChild(header);
        const listEl = document.createElement('div');
        listEl.className = 'inline-branch-list';
        listEl.dataset.parentIndex = index;
        listEl.dataset.actionsKey = branch.key;
        if (branch.actions.length === 0) {
            listEl.innerHTML = '<div class="inline-empty">Drop actions here</div>';
        }
        else {
            let inlineDragIndex = null;
            let inlineDragAllowed = false;
            branch.actions.forEach((childAction, ci) => {
                const childEl = document.createElement('div');
                childEl.className = 'inline-child-item';
                childEl.draggable = true;
                childEl.dataset.childIndex = ci;
                childEl.innerHTML = `
          <span class="inline-child-handle" title="Drag to reorder">⋮⋮</span>
          <span class="inline-child-num">${ci + 1}</span>
          <span class="inline-child-name">${childAction.name ? escapeHtml(childAction.name) : (ACTION_TYPES[childAction.type]?.name || childAction.type)}</span>
          <span class="inline-child-summary">${getActionSummary(childAction)}</span>
          <div class="inline-child-buttons">
            <button class="btn btn-icon btn-sm inline-child-edit" title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn btn-icon btn-sm inline-child-moveout" title="Move out to parent">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
            <button class="btn btn-icon btn-sm btn-danger inline-child-delete" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        `;
                // Drag handle
                const handle = childEl.querySelector('.inline-child-handle');
                handle.addEventListener('mousedown', () => { inlineDragAllowed = true; });
                childEl.addEventListener('dragstart', (e) => {
                    if (!inlineDragAllowed) {
                        e.preventDefault();
                        return;
                    }
                    e.stopPropagation();
                    inlineDragAllowed = false;
                    inlineDragIndex = ci;
                    childEl.classList.add('dragging');
                    e.dataTransfer.setData('text/plain', JSON.stringify({
                        type: 'inline-child',
                        childIndex: ci,
                        branchKey: branch.key,
                        parentIndex: index
                    }));
                    e.dataTransfer.effectAllowed = 'move';
                });
                childEl.addEventListener('dragend', (e) => {
                    e.stopPropagation();
                    childEl.classList.remove('dragging');
                    inlineDragIndex = null;
                    inlineDragAllowed = false;
                    listEl.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
                });
                childEl.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (inlineDragIndex !== null && ci !== inlineDragIndex) {
                        childEl.classList.add('drag-over');
                    }
                });
                childEl.addEventListener('dragleave', () => {
                    childEl.classList.remove('drag-over');
                });
                childEl.addEventListener('drop', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    childEl.classList.remove('drag-over');
                    try {
                        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                        // Reorder within same branch
                        if (data.type === 'inline-child' && data.branchKey === branch.key && data.parentIndex === index) {
                            const arr = action[branch.key];
                            const [moved] = arr.splice(data.childIndex, 1);
                            arr.splice(ci, 0, moved);
                            updateAction(index, action);
                            markDirty();
                            renderActionSequence();
                            saveCurrentWorkflow();
                            return;
                        }
                        // Move from main sequence into this branch at position ci
                        if (data.type === 'main-action' && data.index !== index) {
                            const mainActions = state.currentWorkflow.actions;
                            const [movedAction] = mainActions.splice(data.index, 1);
                            action[branch.key] = action[branch.key] || [];
                            action[branch.key].splice(ci, 0, movedAction);
                            const newIndex = data.index < index ? index - 1 : index;
                            updateAction(newIndex, action);
                            markDirty();
                            renderActionSequence();
                            saveCurrentWorkflow();
                            return;
                        }
                    }
                    catch (err) { }
                    // New action from palette
                    if (editorState.draggedAction?.isNew) {
                        const newAction = createDefaultAction(editorState.draggedAction.type);
                        action[branch.key] = action[branch.key] || [];
                        action[branch.key].splice(ci, 0, newAction);
                        updateAction(index, action);
                        markDirty();
                        renderActionSequence();
                        saveCurrentWorkflow();
                    }
                });
                // Edit button
                childEl.querySelector('.inline-child-edit').addEventListener('click', (e) => {
                    e.stopPropagation();
                    openNestedActionConfig(childAction, ci, action, branch.key, branch.label, index);
                });
                // Move-out button
                childEl.querySelector('.inline-child-moveout').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const branchArr = action[branch.key];
                    if (!branchArr)
                        return;
                    const [movedAction] = branchArr.splice(ci, 1);
                    state.currentWorkflow.actions.splice(index + 1, 0, movedAction);
                    updateAction(index, action);
                    markDirty();
                    renderActionSequence();
                    saveCurrentWorkflow();
                });
                // Delete button
                childEl.querySelector('.inline-child-delete').addEventListener('click', (e) => {
                    e.stopPropagation();
                    action[branch.key].splice(ci, 1);
                    updateAction(index, action);
                    markDirty();
                    renderActionSequence();
                    saveCurrentWorkflow();
                });
                listEl.appendChild(childEl);
                // Recursive: if this child action itself has branches, render them nested
                const childBranches = getInlineBranches(childAction);
                if (childBranches.length > 0) {
                    const nestedContainer = renderInlineChildren(childAction, index, childBranches, depth + 1);
                    listEl.appendChild(nestedContainer);
                }
            });
            // Reset drag flag on mouseup
            document.addEventListener('mouseup', () => { inlineDragAllowed = false; });
        }
        branchEl.appendChild(listEl);
        childrenContainer.appendChild(branchEl);
        // Drag/drop onto inline branch list (from main sequence or palette)
        listEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            listEl.classList.add('drag-over');
        });
        listEl.addEventListener('dragleave', (e) => {
            if (!listEl.contains(e.relatedTarget)) {
                listEl.classList.remove('drag-over');
            }
        });
        listEl.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            listEl.classList.remove('drag-over');
            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                if (data.type === 'main-action' && data.index !== index) {
                    const mainActions = state.currentWorkflow.actions;
                    const [movedAction] = mainActions.splice(data.index, 1);
                    action[branch.key] = action[branch.key] || [];
                    action[branch.key].push(movedAction);
                    const newIndex = data.index < index ? index - 1 : index;
                    updateAction(newIndex, action);
                    markDirty();
                    renderActionSequence();
                    saveCurrentWorkflow();
                    return;
                }
            }
            catch (err) { }
            // New action from palette dropped onto the branch list
            if (editorState.draggedAction?.isNew) {
                const newAction = createDefaultAction(editorState.draggedAction.type);
                action[branch.key] = action[branch.key] || [];
                action[branch.key].push(newAction);
                updateAction(index, action);
                markDirty();
                renderActionSequence();
                saveCurrentWorkflow();
            }
        });
    });
    return childrenContainer;
}

// ===== editor-sequence-dnd.ts =====
/**
 * Get action color
 */
function getActionColor(type, alpha = 1) {
    const colors = {
        mouse_move: `rgba(34, 211, 238, ${alpha})`,
        mouse_click: `rgba(96, 165, 250, ${alpha})`,
        keyboard: `rgba(167, 139, 250, ${alpha})`,
        wait: `rgba(251, 191, 36, ${alpha})`,
        conditional: `rgba(52, 211, 153, ${alpha})`,
        loop: `rgba(251, 113, 133, ${alpha})`,
        image_detect: `rgba(129, 140, 248, ${alpha})`,
        pixel_detect: `rgba(244, 114, 182, ${alpha})`
    };
    return colors[type] || `rgba(161, 161, 170, ${alpha})`;
}
/**
 * Get a compact label for an action (used in compact view)
 */
function getCompactLabel(action) {
    switch (action.type) {
        case 'mouse_move':
            if (action.moveMode === 'image' && action.imageId) {
                return `🖼${action.imageId.substring(0, 6)}`;
            }
            if (action.moveMode === 'bounds' && action.bounds) {
                return `□${action.bounds.x},${action.bounds.y}`;
            }
            return action.x !== undefined ? `${action.x},${action.y}` : 'pos';
        case 'mouse_click':
            const btn = (action.button || 'left')[0].toUpperCase();
            return action.clickType === 'double' ? `${btn}x2` : btn;
        case 'keyboard':
            if (action.mode === 'type') {
                const text = action.text || '';
                return text.substring(0, 8) + (text.length > 8 ? '…' : '');
            }
            return action.key || 'key';
        case 'wait':
            if (action.duration) {
                const ms = action.duration.min || action.duration;
                return `${ms}ms`;
            }
            return 'wait';
        case 'conditional':
            return 'if';
        case 'loop':
            return action.infinite ? '×∞' : `×${action.count || 1}`;
        case 'image_detect':
            return 'img';
        case 'pixel_detect':
            return 'px';
        default:
            return action.type;
    }
}
/**
 * Get a summary string for an action
 */
function getActionSummary(action) {
    switch (action.type) {
        case 'mouse_move':
            if (action.moveMode === 'image' && action.imageId) {
                return `Move to image "${action.imageId}"`;
            }
            if (action.moveMode === 'bounds' && action.bounds) {
                const b = action.bounds;
                return `Random in (${b.x}, ${b.y}) ${b.width}×${b.height}`;
            }
            return action.x !== undefined ? `Move to (${action.x}, ${action.y})` : 'Move to position';
        case 'mouse_click':
            const btn = action.button || 'left';
            const click = action.clickType === 'double' ? 'Double click' : 'Click';
            return `${click} ${btn} button`;
        case 'keyboard':
            if (action.mode === 'type') {
                const text = action.text || '';
                return `Type "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"`;
            }
            if (action.mode === 'hold_and_act') {
                const subCount = action.actions?.length || 0;
                return `Hold ${action.key || 'key'} + ${subCount} action${subCount !== 1 ? 's' : ''}`;
            }
            return `Press ${action.key || 'key'}`;
        case 'wait':
            if (action.duration) {
                const min = action.duration.min || action.duration;
                const max = action.duration.max || action.duration;
                return min === max ? `Wait ${min}ms` : `Wait ${min}-${max}ms`;
            }
            return 'Wait for condition';
        case 'conditional':
            return action.condition?.type || 'If condition';
        case 'loop':
            return action.infinite ? 'Repeat forever' : `Repeat ${action.count || 1} times`;
        case 'image_detect':
            return action.imageId ? 'Find saved image' : 'Find image';
        case 'pixel_detect':
            return action.color ? `Find color #${action.color.r.toString(16)}${action.color.g.toString(16)}${action.color.b.toString(16)}` : 'Find pixel color';
        default:
            return '';
    }
}
/**
 * Handle dragover for drop zone
 */
function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = editorState.draggedAction?.isNew ? 'copy' : 'move';
    actionSequence.classList.add('drag-over');
    // Find drop position
    const afterElement = getDragAfterElement(actionSequence, e.clientY);
    const dragging = document.querySelector('.sequence-item.dragging');
    if (afterElement == null) {
        if (dragging)
            actionSequence.appendChild(dragging);
    }
    else {
        if (dragging)
            actionSequence.insertBefore(dragging, afterElement);
    }
}
/**
 * Handle drop
 */
function handleDrop(e) {
    e.preventDefault();
    actionSequence.classList.remove('drag-over');
    if (!editorState.draggedAction)
        return;
    if (editorState.draggedAction.isTemplate) {
        // Insert template actions
        const dropIndex = getDropIndex(e.clientY);
        insertTemplateIntoWorkflow(editorState.draggedAction.templateId, dropIndex);
    }
    else if (editorState.draggedAction.isNew) {
        // Add new action
        const dropIndex = getDropIndex(e.clientY);
        addActionToSequence(editorState.draggedAction.type, dropIndex);
    }
    else {
        // Reorder existing action
        const fromIndex = editorState.draggedAction.index;
        const toIndex = getDropIndex(e.clientY);
        if (fromIndex !== toIndex) {
            reorderAction(fromIndex, toIndex);
        }
    }
    editorState.draggedAction = null;
}
/**
 * Handle drag leave
 */
function handleDragLeave(e) {
    if (!actionSequence.contains(e.relatedTarget)) {
        actionSequence.classList.remove('drag-over');
    }
}
/**
 * Get drop index from mouse position
 */
function getDropIndex(y) {
    const items = [...actionSequence.querySelectorAll('.sequence-item:not(.dragging)')];
    if (items.length === 0)
        return 0;
    for (let i = 0; i < items.length; i++) {
        const box = items[i].getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0)
            return i;
    }
    return items.length;
}
/**
 * Get element to insert after based on Y position
 */
function getDragAfterElement(container, y) {
    const items = [...container.querySelectorAll('.sequence-item:not(.dragging)')];
    return items.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        }
        else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// ===== editor-core-actions.ts =====
/**
 * Add an action to the sequence
 */
function addActionToSequence(type, index = -1) {
    if (!state.currentWorkflow)
        return;
    const action = createDefaultAction(type);
    if (index === -1 || index >= state.currentWorkflow.actions.length) {
        state.currentWorkflow.actions.push(action);
        index = state.currentWorkflow.actions.length - 1;
    }
    else {
        state.currentWorkflow.actions.splice(index, 0, action);
    }
    markDirty();
    renderActionSequence();
    saveCurrentWorkflow();
    // Open config panel for new action
    openConfigPanel(index);
}
/**
 * Create a default action of a given type
 */
function createDefaultAction(type) {
    const defaults = {
        mouse_move: { type, x: 0, y: 0 },
        mouse_click: { type, button: 'left', clickType: 'single' },
        keyboard: { type, mode: 'type', text: '', actions: [] },
        wait: { type, duration: { min: 500, max: 1000 } },
        conditional: { type, condition: { type: 'image_present' }, thenActions: [], elseActions: [] },
        loop: { type, count: 3, actions: [], delay: { min: 500, max: 1000 } },
        image_detect: { type, imageId: null, confidence: 0.9 },
        pixel_detect: { type, color: { r: 255, g: 0, b: 0 }, tolerance: 10 }
    };
    return { id: generateId(), ...defaults[type] } || { id: generateId(), type };
}
/**
 * Delete an action
 */
function deleteAction(index) {
    if (!state.currentWorkflow)
        return;
    state.currentWorkflow.actions.splice(index, 1);
    if (editorState.selectedActionIndex === index) {
        editorState.selectedActionIndex = -1;
        closeConfigPanel();
    }
    else if (editorState.selectedActionIndex > index) {
        editorState.selectedActionIndex--;
    }
    markDirty();
    renderActionSequence();
    saveCurrentWorkflow();
}
/**
 * Reorder an action
 */
function reorderAction(fromIndex, toIndex) {
    if (!state.currentWorkflow)
        return;
    const [action] = state.currentWorkflow.actions.splice(fromIndex, 1);
    state.currentWorkflow.actions.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, action);
    markDirty();
    renderActionSequence();
    saveCurrentWorkflow();
}
/**
 * Select an action
 */
function selectAction(index) {
    editorState.selectedActionIndex = index;
    renderActionSequence();
    openConfigPanel(index);
}
/**
 * Mark workflow as dirty (unsaved changes) and trigger debounced auto-save
 */
let _autoSaveTimer = null;
function markDirty() {
    editorState.isDirty = true;
    // Debounced auto-save: persist within 500ms of last change
    if (_autoSaveTimer)
        clearTimeout(_autoSaveTimer);
    _autoSaveTimer = setTimeout(() => {
        saveCurrentWorkflow();
    }, 500);
}
/**
 * Manual save triggered by button or Ctrl+S — always saves and shows feedback
 */
async function manualSaveWorkflow() {
    if (!state.currentWorkflow)
        return;
    try {
        await window.workflowAPI.updateWorkflow(state.currentWorkflow.id, state.currentWorkflow);
        editorState.isDirty = false;
        const index = state.workflows.findIndex(w => w.id === state.currentWorkflow.id);
        if (index !== -1)
            state.workflows[index] = { ...state.currentWorkflow };
        showToast('success', 'Saved', `"${state.currentWorkflow.name || 'Workflow'}" saved`);
    }
    catch (error) {
        console.error('Failed to save workflow:', error);
        showToast('error', 'Error', 'Failed to save workflow');
    }
}
/**
 * Save current workflow
 */
async function saveCurrentWorkflow() {
    if (!state.currentWorkflow || !editorState.isDirty)
        return;
    try {
        await window.workflowAPI.updateWorkflow(state.currentWorkflow.id, state.currentWorkflow);
        editorState.isDirty = false;
        // Update in state.workflows list
        const index = state.workflows.findIndex(w => w.id === state.currentWorkflow.id);
        if (index !== -1) {
            state.workflows[index] = { ...state.currentWorkflow };
        }
    }
    catch (error) {
        console.error('Failed to save workflow:', error);
        showToast('error', 'Error', 'Failed to save workflow');
    }
}
/**
 * Run current workflow
 */
async function runCurrentWorkflow(dryRun = false) {
    if (!state.currentWorkflow)
        return;
    await saveCurrentWorkflow();
    if (!state.currentWorkflow.actions || state.currentWorkflow.actions.length === 0) {
        showToast('warning', 'Empty', 'Add some actions first');
        return;
    }
    // Check permissions first (macOS)
    if (window.platform.isMac && !dryRun) {
        try {
            const status = await window.workflowAPI.getPermissionStatus();
            if (!status.accessibility) {
                showModal('Accessibility Permission Required', `
          <p>Workflow Studio needs Accessibility permission to control your mouse and keyboard.</p>
          <p>Please grant access in:</p>
          <ol style="margin: 12px 0; padding-left: 20px;">
            <li>Open System Settings</li>
            <li>Go to Privacy & Security</li>
            <li>Select Accessibility</li>
            <li>Add and enable Workflow Studio</li>
          </ol>
          <p>After granting permission, try running the workflow again.</p>
        `, [
                    { label: 'Request Permission', primary: true, onClick: async () => {
                            await window.workflowAPI.requestAccessibilityPermission();
                        } },
                    { label: 'Cancel', class: 'btn-secondary' }
                ]);
                return;
            }
        }
        catch (err) {
            console.warn('Could not check permissions:', err);
        }
    }
    const result = await window.workflowAPI.executeWorkflow(state.currentWorkflow, { dryRun });
    if (!result.success) {
        // Check if it's a permission error
        if (result.error && result.error.includes('Accessibility permission')) {
            showToast('error', 'Permission Required', 'Grant Accessibility permission in System Settings');
        }
        else {
            showToast('error', 'Error', result.error || 'Failed to start');
        }
    }
}
/**
 * Stop workflow execution
 */
async function stopExecution() {
    await window.workflowAPI.emergencyStop();
}
/**
 * Open config panel for action
 */
function openConfigPanel(index) {
    if (!state.currentWorkflow)
        return;
    const action = state.currentWorkflow.actions[index];
    if (!action)
        return;
    editorState.selectedActionIndex = index;
    renderActionSequence();
    const meta = ACTION_TYPES[action.type] || { name: 'Action' };
    document.getElementById('config-title').textContent = `Configure ${meta.name}`;
    renderConfigFields(action, index);
    configPanel.classList.remove('hidden');
}
/**
 * Close config panel
 */
function closeConfigPanel() {
    configPanel.classList.add('hidden');
    editorState.selectedActionIndex = -1;
    renderActionSequence();
}

// ===== editor-config-render.ts =====
/**
 * Render config fields for an action
 */
async function renderConfigFields(action, index, targetConfigBody, saveCallback) {
    const configBody = targetConfigBody || document.getElementById('config-body');
    const save = saveCallback || (() => updateAction(index, action));
    const rerender = () => renderConfigFields(action, index, configBody, save);
    configBody.innerHTML = '';
    // Add name field at the top for all actions
    const nameFieldHtml = `
    <div class="config-field">
      <label>Action Name (optional)</label>
      <input type="text" id="config-action-name" value="${escapeHtml(action.name || '')}" placeholder="Give this action a name...">
      <p class="config-field-hint">A custom name to identify this action</p>
    </div>
    <hr style="border: none; border-top: 1px solid var(--border-color); margin: var(--space-4) 0;">
  `;
    // Name field listener (shared across all types)
    function setupName() {
        const nameInput = document.getElementById('config-action-name');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                action.name = e.target.value.trim() || undefined;
                save();
            });
        }
    }
    switch (action.type) {
        case 'mouse_move':
            action.moveMode = action.moveMode || 'point';
            const modeHints = {
                point: 'Move to an exact position',
                bounds: 'Move to a random point within a rectangular area',
                image: 'Find an image on screen and move to a random point within it'
            };
            configBody.innerHTML = nameFieldHtml + `
        <div class="config-field">
          <label>Move Mode</label>
          <div class="toggle-group">
            <button class="toggle-btn ${action.moveMode === 'point' ? 'active' : ''}" data-mode="point">Point</button>
            <button class="toggle-btn ${action.moveMode === 'bounds' ? 'active' : ''}" data-mode="bounds">Bounding Box</button>
            <button class="toggle-btn ${action.moveMode === 'image' ? 'active' : ''}" data-mode="image">Image</button>
          </div>
          <p class="config-field-hint">${modeHints[action.moveMode]}</p>
        </div>
        <div id="point-fields" ${action.moveMode !== 'point' ? 'style="display:none"' : ''}>
          <div class="config-field">
            <label>X Position</label>
            <input type="number" id="config-x" value="${action.x || 0}">
          </div>
          <div class="config-field">
            <label>Y Position</label>
            <input type="number" id="config-y" value="${action.y || 0}">
          </div>
          <div class="config-field">
            <button class="btn btn-secondary" id="btn-pick-position">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                <circle cx="12" cy="12" r="10"/>
                <line x1="22" y1="12" x2="18" y2="12"/>
                <line x1="6" y1="12" x2="2" y2="12"/>
                <line x1="12" y1="6" x2="12" y2="2"/>
                <line x1="12" y1="22" x2="12" y2="18"/>
              </svg>
              Pick from Screen
            </button>
            <p class="config-field-hint">Click to select position with your mouse</p>
          </div>
        </div>
        <div id="bounds-fields" ${action.moveMode !== 'bounds' ? 'style="display:none"' : ''}>
          <div class="config-field">
            <label>Top-Left X</label>
            <input type="number" id="config-bounds-x" value="${action.bounds?.x || 0}">
          </div>
          <div class="config-field">
            <label>Top-Left Y</label>
            <input type="number" id="config-bounds-y" value="${action.bounds?.y || 0}">
          </div>
          <div class="config-field">
            <label>Width</label>
            <input type="number" id="config-bounds-w" min="1" value="${action.bounds?.width || 100}">
          </div>
          <div class="config-field">
            <label>Height</label>
            <input type="number" id="config-bounds-h" min="1" value="${action.bounds?.height || 100}">
          </div>
          <div class="config-field">
            <button class="btn btn-secondary" id="btn-pick-bounds">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="9" y1="21" x2="9" y2="9"/>
              </svg>
              Pick Region from Screen
            </button>
            <p class="config-field-hint">Click and drag to select a rectangular region</p>
          </div>
        </div>
        <div id="image-fields" ${action.moveMode !== 'image' ? 'style="display:none"' : ''}>
          <div class="config-field">
            <label>Image Template</label>
            <div id="config-move-image-id"></div>
          </div>
          <div class="config-field">
            <button class="btn btn-secondary" id="btn-capture-move-image">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Capture New Image
            </button>
          </div>
          <div class="config-field">
            <label>Match Confidence: <span id="move-conf-value">${Math.round((action.imageConfidence || 0.9) * 100)}%</span></label>
            <input type="range" id="config-move-confidence" min="50" max="100" value="${Math.round((action.imageConfidence || 0.9) * 100)}">
            <p class="config-field-hint">Higher values require closer match</p>
          </div>
          <div class="config-field">
            <label class="checkbox-label">
              <input type="checkbox" id="config-move-search-region-enabled" ${action.searchRegion ? 'checked' : ''}>
              Limit search region
            </label>
            <p class="config-field-hint">Only search a portion of the screen (much faster)</p>
          </div>
          <div id="move-search-region-fields" ${!action.searchRegion ? 'style="display:none"' : ''}>
            <div class="config-field">
              <button class="btn btn-secondary" id="btn-pick-move-search-region">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
                  <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
                </svg>
                Pick Search Region
              </button>
            </div>
            <div class="config-field config-row" id="move-search-region-display" ${!action.searchRegion ? 'style="display:none"' : ''}>
              <div class="config-col">
                <label>X</label>
                <input type="number" id="config-msr-x" value="${action.searchRegion?.x ?? 0}" min="0">
              </div>
              <div class="config-col">
                <label>Y</label>
                <input type="number" id="config-msr-y" value="${action.searchRegion?.y ?? 0}" min="0">
              </div>
              <div class="config-col">
                <label>W</label>
                <input type="number" id="config-msr-w" value="${action.searchRegion?.width ?? 200}" min="1">
              </div>
              <div class="config-col">
                <label>H</label>
                <input type="number" id="config-msr-h" value="${action.searchRegion?.height ?? 200}" min="1">
              </div>
            </div>
          </div>
          <div class="config-field">
            <label class="checkbox-label">
              <input type="checkbox" id="config-move-scale-down" ${action.scaleDown ? 'checked' : ''}>
              Scale down for speed
            </label>
            <p class="config-field-hint">Reduces resolution before matching (faster but slightly less precise)</p>
          </div>
          <div class="config-field">
            <label class="checkbox-label">
              <input type="checkbox" id="config-move-fail-not-found" ${action.failOnNotFound ? 'checked' : ''}>
              Fail if image not found
            </label>
          </div>
        </div>
        <div class="config-field">
          <label>Movement Duration (ms)</label>
          <input type="number" id="config-duration" min="0" max="5000" value="${action.duration ?? ''}" placeholder="Use default">
          <p class="config-field-hint">Override global setting (leave empty for default)</p>
        </div>
      `;
            setupName();
            // Mode toggle
            configBody.querySelectorAll('.toggle-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    action.moveMode = btn.dataset.mode;
                    save();
                    rerender();
                });
            });
            // Point mode fields
            document.getElementById('config-x').addEventListener('change', (e) => {
                action.x = parseInt(e.target.value) || 0;
                save();
            });
            document.getElementById('config-y').addEventListener('change', (e) => {
                action.y = parseInt(e.target.value) || 0;
                save();
            });
            document.getElementById('btn-pick-position').addEventListener('click', async () => {
                await pickPositionFromScreen((pos) => {
                    document.getElementById('config-x').value = pos.x;
                    document.getElementById('config-y').value = pos.y;
                    action.x = pos.x;
                    action.y = pos.y;
                    save();
                });
            });
            // Bounds mode fields
            document.getElementById('config-bounds-x').addEventListener('change', (e) => {
                action.bounds = action.bounds || { x: 0, y: 0, width: 100, height: 100 };
                action.bounds.x = parseInt(e.target.value) || 0;
                save();
            });
            document.getElementById('config-bounds-y').addEventListener('change', (e) => {
                action.bounds = action.bounds || { x: 0, y: 0, width: 100, height: 100 };
                action.bounds.y = parseInt(e.target.value) || 0;
                save();
            });
            document.getElementById('config-bounds-w').addEventListener('change', (e) => {
                action.bounds = action.bounds || { x: 0, y: 0, width: 100, height: 100 };
                action.bounds.width = Math.max(1, parseInt(e.target.value) || 100);
                save();
            });
            document.getElementById('config-bounds-h').addEventListener('change', (e) => {
                action.bounds = action.bounds || { x: 0, y: 0, width: 100, height: 100 };
                action.bounds.height = Math.max(1, parseInt(e.target.value) || 100);
                save();
            });
            document.getElementById('btn-pick-bounds').addEventListener('click', async () => {
                await pickRegionFromScreen((region) => {
                    action.bounds = { x: region.x, y: region.y, width: region.width, height: region.height };
                    document.getElementById('config-bounds-x').value = region.x;
                    document.getElementById('config-bounds-y').value = region.y;
                    document.getElementById('config-bounds-w').value = region.width;
                    document.getElementById('config-bounds-h').value = region.height;
                    save();
                });
            });
            // Image mode fields
            const moveImagePicker = await loadImageOptions('config-move-image-id', action.imageId, (val) => {
                action.imageId = val;
                save();
            });
            document.getElementById('btn-capture-move-image').addEventListener('click', () => {
                captureImageTemplate((imageId) => {
                    action.imageId = imageId;
                    if (moveImagePicker) {
                        moveImagePicker.setValue(imageId);
                        moveImagePicker.refresh();
                    }
                    save();
                });
            });
            document.getElementById('config-move-confidence').addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                document.getElementById('move-conf-value').textContent = val + '%';
                action.imageConfidence = val / 100;
                save();
            });
            document.getElementById('config-move-fail-not-found').addEventListener('change', (e) => {
                action.failOnNotFound = e.target.checked;
                save();
            });
            // Mouse move search region
            document.getElementById('config-move-search-region-enabled').addEventListener('change', (e) => {
                const fields = document.getElementById('move-search-region-fields');
                if (e.target.checked) {
                    action.searchRegion = action.searchRegion || { x: 0, y: 0, width: 200, height: 200 };
                    fields.style.display = '';
                    document.getElementById('move-search-region-display').style.display = '';
                }
                else {
                    action.searchRegion = null;
                    fields.style.display = 'none';
                }
                save();
            });
            document.getElementById('btn-pick-move-search-region').addEventListener('click', async () => {
                await pickRegionFromScreen((region) => {
                    action.searchRegion = { x: region.x, y: region.y, width: region.width, height: region.height };
                    document.getElementById('config-msr-x').value = region.x;
                    document.getElementById('config-msr-y').value = region.y;
                    document.getElementById('config-msr-w').value = region.width;
                    document.getElementById('config-msr-h').value = region.height;
                    document.getElementById('move-search-region-display').style.display = '';
                    save();
                });
            });
            ['config-msr-x', 'config-msr-y', 'config-msr-w', 'config-msr-h'].forEach(id => {
                document.getElementById(id)?.addEventListener('change', (e) => {
                    action.searchRegion = action.searchRegion || { x: 0, y: 0, width: 200, height: 200 };
                    const key = { 'config-msr-x': 'x', 'config-msr-y': 'y', 'config-msr-w': 'width', 'config-msr-h': 'height' }[id];
                    action.searchRegion[key] = Math.max(0, parseInt(e.target.value) || 0);
                    save();
                });
            });
            // Mouse move scale down
            document.getElementById('config-move-scale-down').addEventListener('change', (e) => {
                action.scaleDown = e.target.checked;
                save();
            });
            document.getElementById('config-duration').addEventListener('change', (e) => {
                const val = e.target.value.trim();
                action.duration = val === '' ? undefined : parseInt(val);
                save();
            });
            break;
        case 'mouse_click':
            configBody.innerHTML = nameFieldHtml + `
        <div class="config-field">
          <label>Button</label>
          <select id="config-button">
            <option value="left" ${action.button === 'left' ? 'selected' : ''}>Left</option>
            <option value="right" ${action.button === 'right' ? 'selected' : ''}>Right</option>
            <option value="middle" ${action.button === 'middle' ? 'selected' : ''}>Middle</option>
          </select>
        </div>
        <div class="config-field">
          <label>Click Type</label>
          <select id="config-click-type">
            <option value="single" ${action.clickType === 'single' ? 'selected' : ''}>Single Click</option>
            <option value="double" ${action.clickType === 'double' ? 'selected' : ''}>Double Click</option>
          </select>
        </div>
        <div class="config-field">
          <label>Position (optional)</label>
          <div class="input-group">
            <input type="number" id="config-click-x" placeholder="X" value="${action.x ?? ''}">
            <input type="number" id="config-click-y" placeholder="Y" value="${action.y ?? ''}">
          </div>
          <p class="config-field-hint">Leave empty to click at current position</p>
        </div>
        <div class="config-field">
          <label class="checkbox-label">
            <input type="checkbox" id="config-click-jitter" ${action.jitter !== false ? 'checked' : ''}>
            Click jitter
          </label>
          <p class="config-field-hint">Adds a small random offset to the click position for human-like imprecision</p>
        </div>
      `;
            setupName();
            document.getElementById('config-click-jitter').addEventListener('change', (e) => {
                action.jitter = e.target.checked;
                save();
            });
            document.getElementById('config-button').addEventListener('change', (e) => {
                action.button = e.target.value;
                save();
            });
            document.getElementById('config-click-type').addEventListener('change', (e) => {
                action.clickType = e.target.value;
                save();
            });
            document.getElementById('config-click-x').addEventListener('change', (e) => {
                action.x = e.target.value ? parseInt(e.target.value) : undefined;
                save();
            });
            document.getElementById('config-click-y').addEventListener('change', (e) => {
                action.y = e.target.value ? parseInt(e.target.value) : undefined;
                save();
            });
            break;
        case 'keyboard':
            action.actions = action.actions || [];
            configBody.innerHTML = nameFieldHtml + `
        <div class="config-field">
          <label>Mode</label>
          <select id="config-kb-mode">
            <option value="type" ${action.mode === 'type' ? 'selected' : ''}>Type Text</option>
            <option value="press" ${action.mode === 'press' ? 'selected' : ''}>Press Key</option>
            <option value="hold_and_act" ${action.mode === 'hold_and_act' ? 'selected' : ''}>Hold Key + Actions</option>
          </select>
        </div>
        <div class="config-field" id="field-text" ${action.mode !== 'type' ? 'style="display:none"' : ''}>
          <label>Text to Type</label>
          <textarea id="config-text" rows="3">${action.text || ''}</textarea>
        </div>
        <div class="config-field" id="field-key" ${(action.mode !== 'press' && action.mode !== 'hold_and_act') ? 'style="display:none"' : ''}>
          <label>Key to ${action.mode === 'hold_and_act' ? 'Hold' : 'Press'}</label>
          <div class="key-recorder" id="key-recorder">
            <div class="key-recorder-display" id="key-recorder-display">
              ${action.key ? `<span class="key-badge">${escapeHtml(action.key)}</span>` : '<span class="key-recorder-placeholder">No key set</span>'}
            </div>
            <button class="btn btn-sm key-recorder-btn" id="key-recorder-btn" type="button">
              <span class="key-recorder-btn-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="3" fill="currentColor"/>
                </svg>
              </span>
              <span class="key-recorder-btn-label">Record Key</span>
            </button>
          </div>
          <input type="text" id="config-key" value="${action.key || ''}" placeholder="Or type manually: shift, ctrl+a" class="key-recorder-manual">
        </div>
        <div id="field-hold-actions" ${action.mode !== 'hold_and_act' ? 'style="display:none"' : ''}>
          <div class="config-section">
            <div class="config-section-header">
              <span>Actions while held: <span id="hold-actions-count">${action.actions.length}</span> actions</span>
              <button class="btn btn-secondary btn-sm" id="btn-edit-hold-actions">Edit</button>
            </div>
            <p class="config-field-hint">These actions run while the key is held down. The key is released after all actions complete.</p>
          </div>
        </div>
      `;
            setupName();
            const updateKbFieldVisibility = (mode) => {
                document.getElementById('field-text').style.display = mode === 'type' ? '' : 'none';
                document.getElementById('field-key').style.display = (mode === 'press' || mode === 'hold_and_act') ? '' : 'none';
                document.getElementById('field-hold-actions').style.display = mode === 'hold_and_act' ? '' : 'none';
                const keyLabel = document.querySelector('#field-key label');
                if (keyLabel)
                    keyLabel.textContent = mode === 'hold_and_act' ? 'Key to Hold' : 'Key or Combo';
            };
            document.getElementById('config-kb-mode').addEventListener('change', (e) => {
                action.mode = e.target.value;
                if (e.target.value === 'hold_and_act' && !action.actions) {
                    action.actions = [];
                }
                updateKbFieldVisibility(e.target.value);
                save();
            });
            document.getElementById('config-text').addEventListener('input', (e) => {
                action.text = e.target.value;
                save();
            });
            // Manual key input
            document.getElementById('config-key').addEventListener('change', (e) => {
                action.key = e.target.value;
                updateKeyRecorderDisplay(action.key);
                save();
            });
            // Key recorder
            setupKeyRecorder(action, save);
            document.getElementById('btn-edit-hold-actions')?.addEventListener('click', () => {
                openNestedActionsEditor(action, 'actions', 'Hold Key Actions', index);
            });
            break;
        case 'wait':
            configBody.innerHTML = nameFieldHtml + `
        <div class="config-field">
          <label>Duration (milliseconds)</label>
          <div class="range-inputs">
            <input type="number" id="config-wait-min" min="0" max="60000" value="${action.duration?.min || 500}">
            <span>to</span>
            <input type="number" id="config-wait-max" min="0" max="60000" value="${action.duration?.max || 1000}">
          </div>
          <p class="config-field-hint">Random delay between min and max for natural timing</p>
        </div>
      `;
            setupName();
            document.getElementById('config-wait-min').addEventListener('change', (e) => {
                action.duration = action.duration || {};
                action.duration.min = parseInt(e.target.value) || 500;
                save();
            });
            document.getElementById('config-wait-max').addEventListener('change', (e) => {
                action.duration = action.duration || {};
                action.duration.max = parseInt(e.target.value) || 1000;
                save();
            });
            break;
        case 'conditional':
            renderConditionalConfig(configBody, action, index, nameFieldHtml, save);
            break;
        case 'loop':
            renderLoopConfig(configBody, action, index, nameFieldHtml, save);
            break;
        case 'image_detect':
            renderImageDetectConfig(configBody, action, index, nameFieldHtml, save);
            break;
        case 'pixel_detect':
            renderPixelDetectConfig(configBody, action, index, nameFieldHtml, save);
            break;
        default:
            configBody.innerHTML = '<p style="color: var(--text-secondary);">Unknown action type.</p>';
    }
}

// ===== editor-config-logic.ts =====
async function renderConditionalConfig(configBody, action, index, nameFieldHtml = '', save) {
    if (!save)
        save = () => updateAction(index, action);
    action.condition = action.condition || { type: 'image_present' };
    action.thenActions = action.thenActions || [];
    action.elseActions = action.elseActions || [];
    configBody.innerHTML = nameFieldHtml + `
    <div class="config-field">
      <label>Condition Type</label>
      <select id="config-condition-type">
        <option value="image_present" ${action.condition.type === 'image_present' ? 'selected' : ''}>Image Present</option>
        <option value="image_absent" ${action.condition.type === 'image_absent' ? 'selected' : ''}>Image Absent</option>
        <option value="pixel_match" ${action.condition.type === 'pixel_match' ? 'selected' : ''}>Pixel Color Match</option>
      </select>
    </div>
    <div class="config-field" id="cond-image-field" ${action.condition.type === 'pixel_match' ? 'style="display:none"' : ''}>
      <label>Image Template</label>
      <div id="config-condition-image"></div>
      <button class="btn btn-secondary btn-sm" id="btn-capture-cond-image" style="margin-top:8px">
        Capture New Image
      </button>
    </div>
    <div class="config-field" id="cond-confidence-field" ${action.condition.type === 'pixel_match' ? 'style="display:none"' : ''}>
      <label>Match Confidence: <span id="cond-conf-value">${Math.round((action.condition.confidence || 0.9) * 100)}%</span></label>
      <input type="range" id="config-condition-confidence" min="50" max="100" value="${Math.round((action.condition.confidence || 0.9) * 100)}">
    </div>
    <div class="config-field" id="cond-pixel-field" ${action.condition.type !== 'pixel_match' ? 'style="display:none"' : ''}>
      <label>Pixel Color</label>
      <div class="color-picker-row">
        <input type="color" id="config-condition-color" value="${rgbToHex(action.condition.color)}">
        <span id="cond-color-preview" style="display:inline-block;width:24px;height:24px;border-radius:4px;background:${rgbToHex(action.condition.color)};border:1px solid var(--border)"></span>
      </div>
    </div>
    <div class="config-field" id="cond-tolerance-field" ${action.condition.type !== 'pixel_match' ? 'style="display:none"' : ''}>
      <label>Color Tolerance: <span id="cond-tol-value">${action.condition.tolerance || 10}</span></label>
      <input type="range" id="config-condition-tolerance" min="0" max="50" value="${action.condition.tolerance || 10}">
    </div>
    <div class="config-section">
      <div class="config-section-header">
        <span>Then (if true): <span id="then-actions-count">${action.thenActions.length}</span> actions</span>
        <button class="btn btn-secondary btn-sm" id="btn-edit-then">Edit</button>
      </div>
    </div>
    <div class="config-section">
      <div class="config-section-header">
        <span>Else (if false): <span id="else-actions-count">${action.elseActions.length}</span> actions</span>
        <button class="btn btn-secondary btn-sm" id="btn-edit-else">Edit</button>
      </div>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-continue-error" ${action.continueOnError ? 'checked' : ''}>
        Continue on error
      </label>
    </div>
  `;
    // Load images for dropdown
    const condImagePicker = await loadImageOptions('config-condition-image', action.condition.imageId, (val) => {
        action.condition.imageId = val;
        save();
    });
    const nameInput = document.getElementById('config-action-name');
    if (nameInput) {
        nameInput.addEventListener('input', (e) => {
            action.name = e.target.value.trim() || undefined;
            save();
        });
    }
    document.getElementById('config-condition-type').addEventListener('change', (e) => {
        action.condition.type = e.target.value;
        const isPixel = e.target.value === 'pixel_match';
        document.getElementById('cond-image-field').style.display = isPixel ? 'none' : '';
        document.getElementById('cond-confidence-field').style.display = isPixel ? 'none' : '';
        document.getElementById('cond-pixel-field').style.display = isPixel ? '' : 'none';
        document.getElementById('cond-tolerance-field').style.display = isPixel ? '' : 'none';
        save();
    });
    document.getElementById('config-condition-confidence').addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        document.getElementById('cond-conf-value').textContent = val + '%';
        action.condition.confidence = val / 100;
        save();
    });
    document.getElementById('config-condition-color').addEventListener('change', (e) => {
        action.condition.color = hexToRgb(e.target.value);
        document.getElementById('cond-color-preview').style.background = e.target.value;
        save();
    });
    document.getElementById('config-condition-tolerance').addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        document.getElementById('cond-tol-value').textContent = val;
        action.condition.tolerance = val;
        save();
    });
    document.getElementById('btn-capture-cond-image').addEventListener('click', () => {
        captureImageTemplate((imageId) => {
            action.condition.imageId = imageId;
            if (condImagePicker) {
                condImagePicker.setValue(imageId);
                condImagePicker.refresh();
            }
            save();
        });
    });
    document.getElementById('btn-edit-then').addEventListener('click', () => {
        openNestedActionsEditor(action, 'thenActions', 'Then Actions', index);
    });
    document.getElementById('btn-edit-else').addEventListener('click', () => {
        openNestedActionsEditor(action, 'elseActions', 'Else Actions', index);
    });
    document.getElementById('config-continue-error').addEventListener('change', (e) => {
        action.continueOnError = e.target.checked;
        save();
    });
}
/**
 * Render Loop action config
 */
function renderLoopConfig(configBody, action, index, nameFieldHtml = '', save) {
    if (!save)
        save = () => updateAction(index, action);
    action.actions = action.actions || [];
    action.delay = action.delay || { min: 500, max: 1000 };
    configBody.innerHTML = nameFieldHtml + `
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-loop-infinite" ${action.infinite ? 'checked' : ''}>
        Infinite loop
      </label>
      <p class="config-field-hint">Loop forever until the workflow is stopped</p>
    </div>
    <div class="config-field" id="loop-count-field" ${action.infinite ? 'style="display:none"' : ''}>
      <label>Number of Iterations</label>
      <input type="number" id="config-loop-count" min="1" max="10000" value="${action.count || 3}">
    </div>
    <div class="config-field">
      <label>Delay Between Iterations (ms)</label>
      <div class="range-inputs">
        <input type="number" id="config-loop-delay-min" min="0" max="60000" value="${action.delay.min || 500}">
        <span>to</span>
        <input type="number" id="config-loop-delay-max" min="0" max="60000" value="${action.delay.max || 1000}">
      </div>
    </div>
    <div class="config-section">
      <div class="config-section-header">
        <span>Loop Actions: <span id="loop-actions-count">${action.actions.length}</span> actions</span>
        <button class="btn btn-secondary btn-sm" id="btn-edit-loop-actions">Edit</button>
      </div>
      <p class="config-field-hint">These actions will repeat for each iteration</p>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-loop-continue-error" ${action.continueOnError ? 'checked' : ''}>
        Continue on error
      </label>
    </div>
  `;
    const nameInput = document.getElementById('config-action-name');
    if (nameInput) {
        nameInput.addEventListener('input', (e) => {
            action.name = e.target.value.trim() || undefined;
            save();
        });
    }
    document.getElementById('config-loop-infinite').addEventListener('change', (e) => {
        action.infinite = e.target.checked;
        document.getElementById('loop-count-field').style.display = e.target.checked ? 'none' : '';
        save();
    });
    document.getElementById('config-loop-count').addEventListener('change', (e) => {
        action.count = parseInt(e.target.value) || 3;
        save();
    });
    document.getElementById('config-loop-delay-min').addEventListener('change', (e) => {
        action.delay.min = parseInt(e.target.value) || 500;
        save();
    });
    document.getElementById('config-loop-delay-max').addEventListener('change', (e) => {
        action.delay.max = parseInt(e.target.value) || 1000;
        save();
    });
    document.getElementById('btn-edit-loop-actions').addEventListener('click', () => {
        openNestedActionsEditor(action, 'actions', 'Loop Actions', index);
    });
    document.getElementById('config-loop-continue-error').addEventListener('change', (e) => {
        action.continueOnError = e.target.checked;
        save();
    });
}
/**
 * Render Image Detect action config
 */

// ===== editor-config-image.ts =====
async function renderImageDetectConfig(configBody, action, index, nameFieldHtml = '', save) {
    if (!save)
        save = () => updateAction(index, action);
    configBody.innerHTML = nameFieldHtml + `
    <div class="config-field">
      <label>Image Template</label>
      <div id="config-image-id"></div>
    </div>
    <div class="config-field">
      <button class="btn btn-secondary" id="btn-capture-image">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        Capture New Image
      </button>
    </div>
    <div class="config-field" id="image-preview-container" style="display:none">
      <label>Preview</label>
      <img id="image-preview" style="max-width:100%;max-height:150px;border-radius:4px;border:1px solid var(--border)">
    </div>
    <div class="config-field">
      <label>Match Confidence: <span id="conf-value">${Math.round((action.confidence || 0.9) * 100)}%</span></label>
      <input type="range" id="config-confidence" min="50" max="100" value="${Math.round((action.confidence || 0.9) * 100)}">
      <p class="config-field-hint">Higher values require closer match</p>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-wait-until-found" ${action.waitUntilFound ? 'checked' : ''}>
        Wait until found
      </label>
      <p class="config-field-hint">Keep checking until the image appears on screen</p>
    </div>
    <div class="config-field" id="poll-interval-field" ${!action.waitUntilFound ? 'style="display:none"' : ''}>
      <label>Check interval (ms)</label>
      <input type="number" id="config-poll-interval" min="100" max="30000" value="${action.pollInterval || 500}" placeholder="500">
      <p class="config-field-hint">How often to re-check for the image</p>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-search-region-enabled" ${action.searchRegion ? 'checked' : ''}>
        Limit search region
      </label>
      <p class="config-field-hint">Only search a portion of the screen (much faster)</p>
    </div>
    <div id="search-region-fields" ${!action.searchRegion ? 'style="display:none"' : ''}>
      <div class="config-field">
        <button class="btn btn-secondary" id="btn-pick-search-region">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
            <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
          </svg>
          Pick Search Region
        </button>
      </div>
      <div class="config-field config-row" id="search-region-display" ${!action.searchRegion ? 'style="display:none"' : ''}>
        <div class="config-col">
          <label>X</label>
          <input type="number" id="config-sr-x" value="${action.searchRegion?.x ?? 0}" min="0">
        </div>
        <div class="config-col">
          <label>Y</label>
          <input type="number" id="config-sr-y" value="${action.searchRegion?.y ?? 0}" min="0">
        </div>
        <div class="config-col">
          <label>W</label>
          <input type="number" id="config-sr-w" value="${action.searchRegion?.width ?? 200}" min="1">
        </div>
        <div class="config-col">
          <label>H</label>
          <input type="number" id="config-sr-h" value="${action.searchRegion?.height ?? 200}" min="1">
        </div>
      </div>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-scale-down" ${action.scaleDown ? 'checked' : ''}>
        Scale down for speed
      </label>
      <p class="config-field-hint">Reduces resolution before matching (faster but slightly less precise)</p>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-fail-not-found" ${action.failOnNotFound ? 'checked' : ''} ${action.waitUntilFound ? 'disabled' : ''}>
        Fail if not found
      </label>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-img-continue-error" ${action.continueOnError ? 'checked' : ''}>
        Continue on error
      </label>
    </div>
  `;
    // Load images for dropdown
    const detectImagePicker = await loadImageOptions('config-image-id', action.imageId, (val) => {
        action.imageId = val;
        save();
        updateImagePreview(val);
    });
    const nameInput = document.getElementById('config-action-name');
    if (nameInput) {
        nameInput.addEventListener('input', (e) => {
            action.name = e.target.value.trim() || undefined;
            save();
        });
    }
    document.getElementById('btn-capture-image').addEventListener('click', () => {
        captureImageTemplate((imageId) => {
            action.imageId = imageId;
            if (detectImagePicker) {
                detectImagePicker.setValue(imageId);
                detectImagePicker.refresh();
            }
            save();
            updateImagePreview(imageId);
        });
    });
    document.getElementById('config-confidence').addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        document.getElementById('conf-value').textContent = val + '%';
        action.confidence = val / 100;
        save();
    });
    document.getElementById('config-wait-until-found').addEventListener('change', (e) => {
        action.waitUntilFound = e.target.checked;
        const pollField = document.getElementById('poll-interval-field');
        const failCheckbox = document.getElementById('config-fail-not-found');
        if (pollField)
            pollField.style.display = e.target.checked ? '' : 'none';
        if (failCheckbox)
            failCheckbox.disabled = e.target.checked;
        if (e.target.checked) {
            action.failOnNotFound = false;
            if (failCheckbox)
                failCheckbox.checked = false;
        }
        save();
    });
    document.getElementById('config-poll-interval').addEventListener('change', (e) => {
        action.pollInterval = Math.max(100, parseInt(e.target.value) || 500);
        save();
    });
    document.getElementById('config-fail-not-found').addEventListener('change', (e) => {
        action.failOnNotFound = e.target.checked;
        save();
    });
    document.getElementById('config-img-continue-error').addEventListener('change', (e) => {
        action.continueOnError = e.target.checked;
        save();
    });
    // Search region
    document.getElementById('config-search-region-enabled').addEventListener('change', (e) => {
        const fields = document.getElementById('search-region-fields');
        if (e.target.checked) {
            action.searchRegion = action.searchRegion || { x: 0, y: 0, width: 200, height: 200 };
            fields.style.display = '';
            document.getElementById('search-region-display').style.display = '';
        }
        else {
            action.searchRegion = null;
            fields.style.display = 'none';
        }
        save();
    });
    document.getElementById('btn-pick-search-region').addEventListener('click', async () => {
        await pickRegionFromScreen((region) => {
            action.searchRegion = { x: region.x, y: region.y, width: region.width, height: region.height };
            document.getElementById('config-sr-x').value = region.x;
            document.getElementById('config-sr-y').value = region.y;
            document.getElementById('config-sr-w').value = region.width;
            document.getElementById('config-sr-h').value = region.height;
            document.getElementById('search-region-display').style.display = '';
            save();
        });
    });
    ['config-sr-x', 'config-sr-y', 'config-sr-w', 'config-sr-h'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', (e) => {
            action.searchRegion = action.searchRegion || { x: 0, y: 0, width: 200, height: 200 };
            const key = { 'config-sr-x': 'x', 'config-sr-y': 'y', 'config-sr-w': 'width', 'config-sr-h': 'height' }[id];
            action.searchRegion[key] = Math.max(0, parseInt(e.target.value) || 0);
            save();
        });
    });
    // Scale down
    document.getElementById('config-scale-down').addEventListener('change', (e) => {
        action.scaleDown = e.target.checked;
        save();
    });
    // Show preview if image selected
    if (action.imageId) {
        updateImagePreview(action.imageId);
    }
}

// ===== editor-config-pixel.ts =====
/**
 * Render Pixel Detect action config
 */
function renderPixelDetectConfig(configBody, action, index, nameFieldHtml = '', save) {
    if (!save)
        save = () => updateAction(index, action);
    action.color = action.color || { r: 255, g: 0, b: 0 };
    configBody.innerHTML = nameFieldHtml + `
    <div class="config-field">
      <label>Target Color</label>
      <div class="color-picker-row">
        <input type="color" id="config-pixel-color" value="${rgbToHex(action.color)}">
        <span id="color-preview" style="display:inline-block;width:32px;height:32px;border-radius:4px;background:${rgbToHex(action.color)};border:1px solid var(--border)"></span>
        <button class="btn btn-secondary btn-sm" id="btn-pick-color">Pick from Screen</button>
      </div>
    </div>
    <div class="config-field">
      <label>RGB Values</label>
      <div class="rgb-inputs">
        <div>
          <span>R</span>
          <input type="number" id="config-pixel-r" min="0" max="255" value="${action.color.r}">
        </div>
        <div>
          <span>G</span>
          <input type="number" id="config-pixel-g" min="0" max="255" value="${action.color.g}">
        </div>
        <div>
          <span>B</span>
          <input type="number" id="config-pixel-b" min="0" max="255" value="${action.color.b}">
        </div>
      </div>
    </div>
    <div class="config-field">
      <label>Color Tolerance: <span id="tol-value">${action.tolerance || 10}</span></label>
      <input type="range" id="config-tolerance" min="0" max="50" value="${action.tolerance || 10}">
      <p class="config-field-hint">How much variation to allow (0 = exact match)</p>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-pixel-fail-not-found" ${action.failOnNotFound ? 'checked' : ''}>
        Fail if not found
      </label>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-pixel-continue-error" ${action.continueOnError ? 'checked' : ''}>
        Continue on error
      </label>
    </div>
  `;
    const nameInput = document.getElementById('config-action-name');
    if (nameInput) {
        nameInput.addEventListener('input', (e) => {
            action.name = e.target.value.trim() || undefined;
            save();
        });
    }
    const updateColorFromHex = (hex) => {
        action.color = hexToRgb(hex);
        document.getElementById('color-preview').style.background = hex;
        document.getElementById('config-pixel-r').value = action.color.r;
        document.getElementById('config-pixel-g').value = action.color.g;
        document.getElementById('config-pixel-b').value = action.color.b;
        save();
    };
    const updateColorFromRgb = () => {
        action.color = {
            r: parseInt(document.getElementById('config-pixel-r').value) || 0,
            g: parseInt(document.getElementById('config-pixel-g').value) || 0,
            b: parseInt(document.getElementById('config-pixel-b').value) || 0
        };
        const hex = rgbToHex(action.color);
        document.getElementById('config-pixel-color').value = hex;
        document.getElementById('color-preview').style.background = hex;
        save();
    };
    document.getElementById('config-pixel-color').addEventListener('change', (e) => {
        updateColorFromHex(e.target.value);
    });
    ['config-pixel-r', 'config-pixel-g', 'config-pixel-b'].forEach(id => {
        document.getElementById(id).addEventListener('change', updateColorFromRgb);
    });
    document.getElementById('btn-pick-color').addEventListener('click', async () => {
        await pickColorFromScreen((color) => {
            action.color = color;
            const hex = rgbToHex(color);
            document.getElementById('config-pixel-color').value = hex;
            document.getElementById('color-preview').style.background = hex;
            document.getElementById('config-pixel-r').value = color.r;
            document.getElementById('config-pixel-g').value = color.g;
            document.getElementById('config-pixel-b').value = color.b;
            save();
        });
    });
    document.getElementById('config-tolerance').addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        document.getElementById('tol-value').textContent = val;
        action.tolerance = val;
        save();
    });
    document.getElementById('config-pixel-fail-not-found').addEventListener('change', (e) => {
        action.failOnNotFound = e.target.checked;
        save();
    });
    document.getElementById('config-pixel-continue-error').addEventListener('change', (e) => {
        action.continueOnError = e.target.checked;
        save();
    });
}
/**
 * Helper: Convert RGB to hex
 */
function rgbToHex(color) {
    if (!color)
        return '#ff0000';
    const r = (color.r || 0).toString(16).padStart(2, '0');
    const g = (color.g || 0).toString(16).padStart(2, '0');
    const b = (color.b || 0).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}
/**
 * Helper: Convert hex to RGB
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 255, g: 0, b: 0 };
}

// ===== editor-config-update.ts =====
/**
 * Update an action and save
 */
function updateAction(index, action) {
    if (!state.currentWorkflow)
        return;
    state.currentWorkflow.actions[index] = action;
    markDirty();
    renderActionSequence();
    saveCurrentWorkflow();
}
/**
 * Render Conditional action config
 */

// ===== editor-nested-images.ts =====
/**
 * Create a searchable image picker with folder hierarchy inside a container element.
 * Returns a controller: { onChange(cb), setValue(id), getValue(), destroy() }
 */
async function loadImageOptions(containerId, selectedId, onChangeCb) {
    const container = document.getElementById(containerId);
    if (!container)
        return null;
    let images = [];
    try {
        images = await window.workflowAPI.getImages() || [];
    }
    catch (e) {
        console.error('Failed to load images:', e);
    }
    let currentValue = selectedId || null;
    let isOpen = false;
    let _onChange = onChangeCb || null;
    const chevronSvg = `<svg class="picker-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
    const folderSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
    function getDisplayLabel(id) {
        if (!id)
            return null;
        const img = images.find(i => i.id === id);
        if (!img)
            return id;
        return img.folder ? `${img.folder} / ${img.id}` : img.id;
    }
    // Build the picker DOM
    container.innerHTML = '';
    container.classList.add('image-picker');
    const trigger = document.createElement('div');
    trigger.className = 'image-picker-trigger';
    trigger.innerHTML = currentValue
        ? `<span class="picker-value">${escapeHtml(getDisplayLabel(currentValue))}</span>${chevronSvg}`
        : `<span class="picker-value picker-placeholder">Select image...</span>${chevronSvg}`;
    container.appendChild(trigger);
    const dropdown = document.createElement('div');
    dropdown.className = 'image-picker-dropdown';
    dropdown.style.display = 'none';
    container.appendChild(dropdown);
    function renderDropdown(filter = '') {
        const q = filter.toLowerCase();
        // Group images
        const uncategorized = images.filter(i => !i.folder);
        const folderMap = {};
        images.forEach(img => {
            if (img.folder) {
                if (!folderMap[img.folder])
                    folderMap[img.folder] = [];
                folderMap[img.folder].push(img);
            }
        });
        let html = `<div class="image-picker-search"><input type="text" placeholder="Search images..." value="${escapeHtml(filter)}"></div><div class="image-picker-results">`;
        let hasResults = false;
        // Uncategorized images
        const filteredUncat = uncategorized.filter(img => !q || img.id.toLowerCase().includes(q));
        if (filteredUncat.length > 0) {
            filteredUncat.forEach(img => {
                hasResults = true;
                const sel = img.id === currentValue ? ' selected' : '';
                const thumb = img.path ? `<img class="picker-item-thumb" src="file://${img.path.replace(/\\/g, '/')}?t=${Date.now()}" alt="">` : '';
                html += `<div class="image-picker-item${sel}" data-value="${escapeHtml(img.id)}">${thumb}<span class="picker-item-name">${escapeHtml(img.id)}</span></div>`;
            });
        }
        // Folders
        Object.keys(folderMap).sort().forEach(folder => {
            const folderMatches = folder.toLowerCase().includes(q);
            const filteredImgs = folderMap[folder].filter(img => !q || folderMatches || img.id.toLowerCase().includes(q));
            if (filteredImgs.length > 0) {
                hasResults = true;
                html += `<div class="image-picker-folder">${folderSvg} ${escapeHtml(folder)}</div>`;
                filteredImgs.forEach(img => {
                    const sel = img.id === currentValue ? ' selected' : '';
                    const thumb = img.path ? `<img class="picker-item-thumb" src="file://${img.path.replace(/\\/g, '/')}?t=${Date.now()}" alt="">` : '';
                    html += `<div class="image-picker-item in-folder${sel}" data-value="${escapeHtml(img.id)}">${thumb}<span class="picker-item-name">${escapeHtml(img.id)}</span></div>`;
                });
            }
        });
        if (!hasResults) {
            html += `<div class="image-picker-empty">${q ? 'No images match "' + escapeHtml(filter) + '"' : 'No image templates'}</div>`;
        }
        html += '</div>';
        dropdown.innerHTML = html;
        // Wire search input
        const searchInput = dropdown.querySelector('.image-picker-search input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                renderDropdown(e.target.value);
            });
            // Prevent trigger close when clicking in search
            searchInput.addEventListener('mousedown', (e) => e.stopPropagation());
            // Keep focus
            setTimeout(() => searchInput.focus(), 0);
            // Place cursor at end
            searchInput.selectionStart = searchInput.selectionEnd = searchInput.value.length;
        }
        // Wire item clicks
        dropdown.querySelectorAll('.image-picker-item').forEach(el => {
            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const val = el.dataset.value;
                selectValue(val);
                closeDropdown();
            });
        });
    }
    function selectValue(val) {
        currentValue = val || null;
        trigger.innerHTML = currentValue
            ? `<span class="picker-value">${escapeHtml(getDisplayLabel(currentValue))}</span>${chevronSvg}`
            : `<span class="picker-value picker-placeholder">Select image...</span>${chevronSvg}`;
        if (_onChange)
            _onChange(currentValue);
    }
    function openDropdown() {
        if (isOpen)
            return;
        isOpen = true;
        trigger.classList.add('open');
        dropdown.style.display = '';
        renderDropdown('');
    }
    function closeDropdown() {
        if (!isOpen)
            return;
        isOpen = false;
        trigger.classList.remove('open');
        dropdown.style.display = 'none';
    }
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isOpen)
            closeDropdown();
        else
            openDropdown();
    });
    // Close on outside click
    function handleOutsideClick(e) {
        if (!container.contains(e.target))
            closeDropdown();
    }
    document.addEventListener('mousedown', handleOutsideClick);
    const controller = {
        onChange(cb) { _onChange = cb; },
        setValue(id) { selectValue(id); },
        getValue() { return currentValue; },
        async refresh() {
            try {
                images = await window.workflowAPI.getImages() || [];
            }
            catch (e) { }
            if (isOpen)
                renderDropdown('');
            // Update trigger label
            trigger.innerHTML = currentValue
                ? `<span class="picker-value">${escapeHtml(getDisplayLabel(currentValue))}</span>${chevronSvg}`
                : `<span class="picker-value picker-placeholder">Select image...</span>${chevronSvg}`;
        },
        destroy() {
            document.removeEventListener('mousedown', handleOutsideClick);
        }
    };
    return controller;
}
/**
 * Update image preview
 */
function updateImagePreview(imageId) {
    const container = document.getElementById('image-preview-container');
    const preview = document.getElementById('image-preview');
    if (!container || !preview)
        return;
    if (imageId) {
        // Note: In production, you'd get the actual file path
        container.style.display = '';
        preview.alt = imageId;
    }
    else {
        container.style.display = 'none';
    }
}
/**
 * Capture image template from screen with region selection
 */
async function captureImageTemplate(callback) {
    try {
        // Minimize the main window first
        await window.workflowAPI.minimizeWindow();
        // Small delay to ensure window is minimized
        await new Promise(r => setTimeout(r, 300));
        // Open region selection overlay (includes preview/confirm/redo loop)
        const result = await window.workflowAPI.captureRegionTemplate();
        // Restore the main window
        await window.workflowAPI.restoreWindow();
        if (result.cancelled) {
            showToast('info', 'Cancelled', 'Region capture cancelled');
            return;
        }
        if (!result.success) {
            showToast('error', 'Error', result.error || 'Failed to capture region');
            return;
        }
        showToast('success', 'Image Captured', `Saved as ${result.imageId}`);
        if (callback)
            callback(result.imageId);
    }
    catch (error) {
        console.error('Image capture failed:', error);
        showToast('error', 'Capture Failed', error.message);
        // Restore window even on error
        try {
            await window.workflowAPI.restoreWindow();
        }
        catch (e) { /* ignore */ }
    }
}

// ===== editor-nested-list-modal.ts =====
/**
 * Open nested actions editor modal
 */
function openNestedActionsEditor(parentAction, actionsKey, title, parentIndex) {
    const nestedActions = parentAction[actionsKey] || [];
    const mainActions = state.currentWorkflow ? state.currentWorkflow.actions : [];
    const templates = editorState.templates || [];
    showModal(title, `
      <div class="nested-editor">
        <div class="nested-toolbar">
          <button class="btn btn-secondary" id="btn-nested-quick-record" title="Quick Record into this branch">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="3" fill="currentColor"/>
            </svg>
            Quick Record
          </button>
          <span class="nested-drop-hint">Drag actions here from main sequence</span>
        </div>
        <div class="nested-actions-list" id="nested-actions-list" data-parent-index="${parentIndex}" data-actions-key="${actionsKey}">
          ${nestedActions.length === 0 ? '<p class="empty-nested" id="empty-nested-msg">No actions yet. Add actions below or drag from main sequence.</p>' : ''}
          ${nestedActions.map((action, i) => `
            <div class="nested-action-item" data-index="${i}" draggable="true">
              <span class="nested-drag-handle">⋮⋮</span>
              <span class="nested-num">${i + 1}</span>
              <span class="nested-name">${action.name ? escapeHtml(action.name) : (ACTION_TYPES[action.type]?.name || action.type)}</span>
              <span class="nested-summary">${getActionSummary(action)}</span>
              <button class="btn btn-icon btn-sm" data-edit="${i}" title="Edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="btn btn-icon btn-danger btn-sm" data-delete="${i}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          `).join('')}
        </div>
        <div class="nested-add-tabs">
          <div class="nested-tab-bar">
            <button class="nested-tab active" data-tab="new">New Action</button>
            <button class="nested-tab" data-tab="workflow">From Workflow</button>
            <button class="nested-tab" data-tab="templates">Templates</button>
          </div>
          <div class="nested-tab-content" id="nested-tab-new">
            <div class="nested-add-row">
              <select id="nested-action-type">
                ${Object.entries(ACTION_TYPES).map(([type, meta]) => `
                  <option value="${type}">${meta.name}</option>
                `).join('')}
              </select>
              <button class="btn btn-primary" id="btn-add-nested">Add</button>
            </div>
          </div>
          <div class="nested-tab-content hidden" id="nested-tab-workflow">
            ${mainActions.length === 0 ? '<p class="empty-nested">No actions in workflow</p>' : `
              <div class="nested-source-list">
                ${mainActions.map((action, i) => {
        if (i === parentIndex)
            return '';
        return `
                    <div class="nested-source-item" data-workflow-index="${i}">
                      <span class="nested-num">${i + 1}</span>
                      <span class="nested-name">${action.name ? escapeHtml(action.name) : (ACTION_TYPES[action.type]?.name || action.type)}</span>
                      <span class="nested-summary">${getActionSummary(action)}</span>
                      <div class="nested-source-btns">
                        <button class="btn btn-secondary btn-sm" data-copy-index="${i}" title="Copy into this branch">Copy</button>
                        <button class="btn btn-primary btn-sm" data-move-index="${i}" title="Move into this branch (removes from main)">Move</button>
                      </div>
                    </div>
                  `;
    }).join('')}
              </div>
            `}
          </div>
          <div class="nested-tab-content hidden" id="nested-tab-templates">
            ${templates.length === 0 ? '<p class="empty-nested">No saved templates</p>' : `
              <div class="nested-source-list">
                ${templates.map(t => `
                  <div class="nested-source-item" data-template-id="${t.id}">
                    <span class="nested-name">${escapeHtml(t.name)}</span>
                    <span class="nested-summary">${t.actions.length} actions</span>
                    <button class="btn btn-primary btn-sm" data-insert-template="${t.id}">Insert</button>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      </div>
    `, [
        { label: 'Done', primary: true, action: 'close', onClick: () => updateNestedActionCounts(parentAction, actionsKey) }
    ]);
    // Tab switching
    document.querySelectorAll('.nested-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.nested-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.nested-tab-content').forEach(c => c.classList.add('hidden'));
            tab.classList.add('active');
            document.getElementById(`nested-tab-${tab.dataset.tab}`).classList.remove('hidden');
        });
    });
    // Add new action handler
    document.getElementById('btn-add-nested').addEventListener('click', () => {
        const type = document.getElementById('nested-action-type').value;
        const newAction = createDefaultAction(type);
        parentAction[actionsKey] = parentAction[actionsKey] || [];
        parentAction[actionsKey].push(newAction);
        updateAction(parentIndex, parentAction);
        openNestedActionsEditor(parentAction, actionsKey, title, parentIndex);
    });
    // Copy from workflow handlers
    document.querySelectorAll('[data-copy-index]').forEach(btn => {
        btn.addEventListener('click', () => {
            const srcIndex = parseInt(btn.dataset.copyIndex);
            const srcAction = mainActions[srcIndex];
            if (!srcAction)
                return;
            const copy = JSON.parse(JSON.stringify(srcAction));
            copy.id = generateId();
            parentAction[actionsKey] = parentAction[actionsKey] || [];
            parentAction[actionsKey].push(copy);
            updateAction(parentIndex, parentAction);
            openNestedActionsEditor(parentAction, actionsKey, title, parentIndex);
        });
    });
    // Move from workflow handlers
    document.querySelectorAll('[data-move-index]').forEach(btn => {
        btn.addEventListener('click', () => {
            const srcIndex = parseInt(btn.dataset.moveIndex);
            const [movedAction] = mainActions.splice(srcIndex, 1);
            parentAction[actionsKey] = parentAction[actionsKey] || [];
            parentAction[actionsKey].push(movedAction);
            // Recalculate parentIndex since we removed an item from main
            const newParentIndex = srcIndex < parentIndex ? parentIndex - 1 : parentIndex;
            updateAction(newParentIndex, parentAction);
            renderActionSequence();
            openNestedActionsEditor(parentAction, actionsKey, title, newParentIndex);
        });
    });
    // Insert template handlers
    document.querySelectorAll('[data-insert-template]').forEach(btn => {
        btn.addEventListener('click', () => {
            const templateId = btn.dataset.insertTemplate;
            const template = templates.find(t => t.id === templateId);
            if (!template)
                return;
            const copiedActions = template.actions.map(a => {
                const copy = JSON.parse(JSON.stringify(a));
                copy.id = generateId();
                return copy;
            });
            parentAction[actionsKey] = parentAction[actionsKey] || [];
            parentAction[actionsKey].push(...copiedActions);
            updateAction(parentIndex, parentAction);
            openNestedActionsEditor(parentAction, actionsKey, title, parentIndex);
        });
    });
    // Quick Record handler
    document.getElementById('btn-nested-quick-record').addEventListener('click', async () => {
        window._nestedQuickRecordTarget = {
            parentAction,
            actionsKey,
            parentIndex,
            title
        };
        hideModal();
        if (window.quickRecord) {
            window.quickRecord.startForNested(parentAction, actionsKey, parentIndex, title);
        }
    });
    // Scope all queries to the nested actions list
    const nestedList = document.getElementById('nested-actions-list');
    // Edit handlers
    if (nestedList) {
        nestedList.querySelectorAll('[data-edit]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.edit);
                const nestedAction = parentAction[actionsKey][idx];
                if (nestedAction) {
                    openNestedActionConfig(nestedAction, idx, parentAction, actionsKey, title, parentIndex);
                }
            });
        });
        // Delete handlers
        nestedList.querySelectorAll('[data-delete]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.delete);
                parentAction[actionsKey].splice(idx, 1);
                updateAction(parentIndex, parentAction);
                openNestedActionsEditor(parentAction, actionsKey, title, parentIndex);
            });
        });
    }
    // Setup drag/drop for nested items
    setupNestedDragDrop(parentAction, actionsKey, parentIndex, title);
}

// ===== editor-nested-config.ts =====
/**
 * Open config editor for a single nested action (uses shared renderConfigFields)
 */
function openNestedActionConfig(action, nestedIndex, parentAction, actionsKey, parentTitle, parentIndex) {
    const meta = ACTION_TYPES[action.type] || { name: 'Action' };
    showModal(`Edit ${meta.name} (#${nestedIndex + 1} in ${parentTitle})`, `<div id="nested-config-body" class="nested-config-panel"></div>`, [
        { label: 'Back', class: 'btn-secondary', onClick: () => {
                updateAction(parentIndex, parentAction);
                setTimeout(() => openNestedActionsEditor(parentAction, actionsKey, parentTitle, parentIndex), 50);
            }, closeOnClick: true },
        { label: 'Done', primary: true, action: 'close', onClick: () => {
                updateAction(parentIndex, parentAction);
                updateNestedActionCounts(parentAction, actionsKey);
            } }
    ]);
    const configBody = document.getElementById('nested-config-body');
    if (!configBody)
        return;
    const save = () => updateAction(parentIndex, parentAction);
    renderConfigFields(action, parentIndex, configBody, save);
}
/**
 * Update the action counts displayed in the config panel for conditionals/loops
 */
function updateNestedActionCounts(parentAction, actionsKey) {
    const count = (parentAction[actionsKey] || []).length;
    // Map of actionsKey → possible element IDs that display the count
    const countElementIds = {
        thenActions: ['then-actions-count'],
        elseActions: ['else-actions-count'],
        actions: ['loop-actions-count', 'hold-actions-count']
    };
    const ids = countElementIds[actionsKey] || [];
    for (const id of ids) {
        const el = document.getElementById(id);
        if (el)
            el.textContent = count;
    }
}

// ===== editor-nested-dnd.ts =====
/**
 * Setup drag/drop for nested actions list
 */
function setupNestedDragDrop(parentAction, actionsKey, parentIndex, title) {
    const list = document.getElementById('nested-actions-list');
    if (!list)
        return;
    let draggedIndex = null;
    let dragAllowed = false;
    // Reset drag flag on any mouseup
    document.addEventListener('mouseup', () => { dragAllowed = false; }, { once: false });
    // Make items draggable for reordering - only from drag handle
    list.querySelectorAll('.nested-action-item').forEach(item => {
        // Track mousedown on drag handle to allow drag
        const handle = item.querySelector('.nested-drag-handle');
        if (handle) {
            handle.addEventListener('mousedown', () => { dragAllowed = true; });
        }
        item.addEventListener('dragstart', (e) => {
            // Only allow drag if initiated from the handle
            if (!dragAllowed) {
                e.preventDefault();
                return;
            }
            dragAllowed = false;
            draggedIndex = parseInt(item.dataset.index);
            item.classList.add('dragging');
            e.dataTransfer.setData('text/plain', JSON.stringify({
                type: 'nested-action',
                index: draggedIndex,
                parentIndex,
                actionsKey
            }));
            e.dataTransfer.effectAllowed = 'move';
        });
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            draggedIndex = null;
            dragAllowed = false;
            list.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        });
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            const targetIndex = parseInt(item.dataset.index);
            if (draggedIndex !== null && targetIndex !== draggedIndex) {
                item.classList.add('drag-over');
            }
        });
        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');
            const targetIndex = parseInt(item.dataset.index);
            // Check if dropping from main sequence
            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                if (data.type === 'main-action') {
                    // Moving from main sequence to nested
                    const mainActions = state.currentWorkflow.actions;
                    const [movedAction] = mainActions.splice(data.index, 1);
                    parentAction[actionsKey] = parentAction[actionsKey] || [];
                    parentAction[actionsKey].splice(targetIndex, 0, movedAction);
                    updateAction(parentIndex, parentAction);
                    renderActionSequence();
                    openNestedActionsEditor(parentAction, actionsKey, title, parentIndex);
                    return;
                }
            }
            catch (err) { }
            // Reordering within nested list
            if (draggedIndex !== null && draggedIndex !== targetIndex) {
                const actions = parentAction[actionsKey];
                const [moved] = actions.splice(draggedIndex, 1);
                actions.splice(targetIndex, 0, moved);
                updateAction(parentIndex, parentAction);
                openNestedActionsEditor(parentAction, actionsKey, title, parentIndex);
            }
        });
    });
    // Allow dropping on the list itself (for empty list or end of list)
    list.addEventListener('dragover', (e) => {
        e.preventDefault();
        list.classList.add('drag-over');
    });
    list.addEventListener('dragleave', (e) => {
        if (!list.contains(e.relatedTarget)) {
            list.classList.remove('drag-over');
        }
    });
    list.addEventListener('drop', (e) => {
        e.preventDefault();
        list.classList.remove('drag-over');
        // Check if dropping from main sequence
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.type === 'main-action') {
                const mainActions = state.currentWorkflow.actions;
                const [movedAction] = mainActions.splice(data.index, 1);
                parentAction[actionsKey] = parentAction[actionsKey] || [];
                parentAction[actionsKey].push(movedAction);
                updateAction(parentIndex, parentAction);
                renderActionSequence();
                openNestedActionsEditor(parentAction, actionsKey, title, parentIndex);
            }
        }
        catch (err) { }
    });
}
/**
 * Pick a position from screen using overlay
 */
async function pickPositionFromScreen(callback) {
    try {
        const pos = await window.workflowAPI.pickScreenPosition();
        if (!pos) {
            showToast('info', 'Cancelled', 'Position pick cancelled');
            return;
        }
        showToast('success', 'Position Captured', `X: ${pos.x}, Y: ${pos.y}`);
        if (callback) {
            callback(pos);
        }
    }
    catch (error) {
        console.error('Position capture failed:', error);
        showToast('error', 'Error', 'Failed to capture position');
    }
}
/**
 * Pick a rectangular region from screen using overlay
 */
async function pickRegionFromScreen(callback) {
    try {
        const region = await window.workflowAPI.selectScreenRegion();
        if (!region) {
            showToast('info', 'Cancelled', 'Region selection cancelled');
            return;
        }
        showToast('success', 'Region Captured', `(${region.x}, ${region.y}) ${region.width}×${region.height}`);
        if (callback) {
            callback(region);
        }
    }
    catch (error) {
        console.error('Region capture failed:', error);
        showToast('error', 'Error', 'Failed to capture region');
    }
}
/**
 * Pick a color from screen using overlay
 */
async function pickColorFromScreen(callback) {
    try {
        const pos = await window.workflowAPI.pickScreenPosition();
        if (!pos) {
            showToast('info', 'Cancelled', 'Color pick cancelled');
            return;
        }
        // Small delay to ensure overlay is fully closed before sampling
        await new Promise(resolve => setTimeout(resolve, 100));
        const color = await window.workflowAPI.getPixelColor(pos.x, pos.y);
        if (color) {
            showToast('success', 'Color Captured', `RGB(${color.r}, ${color.g}, ${color.b})`);
            if (callback) {
                callback(color);
            }
        }
        else {
            showToast('error', 'Error', 'Failed to get pixel color');
        }
    }
    catch (error) {
        console.error('Color capture failed:', error);
        showToast('error', 'Error', 'Failed to capture color');
    }
}
// ==================== TEMPLATES ====================

// ===== editor-templates-list.ts =====
/**
 * Load all templates
 */
async function loadTemplates() {
    try {
        editorState.templates = await window.workflowAPI.getTemplates();
        renderTemplateList();
    }
    catch (error) {
        console.error('Failed to load templates:', error);
    }
}
/**
 * Render the template list in the sidebar
 */
function renderTemplateList() {
    if (!templateList)
        return;
    const emptyEl = document.getElementById('empty-templates');
    if (editorState.templates.length === 0) {
        templateList.innerHTML = '';
        if (emptyEl) {
            emptyEl.style.display = '';
            templateList.appendChild(emptyEl);
        }
        return;
    }
    if (emptyEl)
        emptyEl.style.display = 'none';
    templateList.innerHTML = editorState.templates.map(template => `
    <div class="template-item" data-template-id="${template.id}" draggable="true">
      <div class="template-item-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <path d="M3 9h18"/>
          <path d="M9 21V9"/>
        </svg>
      </div>
      <div class="template-item-info">
        <div class="template-item-name">${escapeHtml(template.name)}</div>
        <div class="template-item-meta">${template.actions.length} actions</div>
      </div>
      <div class="template-item-actions">
        <button class="btn btn-icon btn-sm" data-action="rename" title="Rename">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="btn btn-icon btn-danger btn-sm" data-action="delete" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');
    // Add event listeners
    templateList.querySelectorAll('.template-item').forEach(item => {
        const templateId = item.dataset.templateId;
        // Double click to insert
        item.addEventListener('dblclick', () => {
            insertTemplateIntoWorkflow(templateId);
        });
        // Drag to insert
        item.addEventListener('dragstart', (e) => {
            editorState.draggedAction = { templateId, isTemplate: true };
            e.dataTransfer.effectAllowed = 'copy';
            item.classList.add('dragging');
        });
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            editorState.draggedAction = null;
        });
        // Rename button
        item.querySelector('[data-action="rename"]').addEventListener('click', (e) => {
            e.stopPropagation();
            openRenameTemplateModal(templateId);
        });
        // Delete button
        item.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteTemplate(templateId);
        });
    });
}
/**
 * Open modal to save selected actions as template
 */
function openSaveAsTemplateModal() {
    if (!state.currentWorkflow || !state.currentWorkflow.actions || state.currentWorkflow.actions.length === 0) {
        showToast('warning', 'No Actions', 'Add some actions to the workflow first');
        return;
    }
    const actions = state.currentWorkflow.actions;
    showModal('Save as Template', `
      <div class="config-field">
        <label>Template Name</label>
        <input type="text" id="template-name" placeholder="My Template" value="">
      </div>
      <div class="config-field">
        <label>Description (optional)</label>
        <textarea id="template-description" rows="2" placeholder="What does this template do?"></textarea>
      </div>
      <div class="config-field">
        <label>Select Actions to Include</label>
        <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: var(--space-2);">
          ${actions.map((action, i) => `
            <label class="checkbox-label" style="padding: var(--space-1) 0;">
              <input type="checkbox" class="template-action-checkbox" data-index="${i}" checked>
              <span>${i + 1}. ${action.name ? escapeHtml(action.name) + ' - ' : ''}${ACTION_TYPES[action.type]?.name || action.type}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `, [
        { label: 'Cancel', class: 'btn-secondary', action: 'close' },
        { label: 'Save Template', primary: true, onClick: saveAsTemplate }
    ]);
    document.getElementById('template-name').focus();
}
/**
 * Save selected actions as a new template
 */
async function saveAsTemplate() {
    const name = document.getElementById('template-name').value.trim();
    const description = document.getElementById('template-description').value.trim();
    if (!name) {
        showToast('error', 'Error', 'Please enter a template name');
        return;
    }
    const checkboxes = document.querySelectorAll('.template-action-checkbox:checked');
    const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
    if (selectedIndices.length === 0) {
        showToast('error', 'Error', 'Please select at least one action');
        return;
    }
    // Deep copy selected actions with new IDs
    const selectedActions = selectedIndices.map(i => {
        const action = JSON.parse(JSON.stringify(state.currentWorkflow.actions[i]));
        action.id = generateId(); // Generate new ID for the copy
        return action;
    });
    try {
        const template = await window.workflowAPI.createTemplate({
            name,
            description,
            actions: selectedActions
        });
        editorState.templates.push(template);
        renderTemplateList();
        closeModal();
        showToast('success', 'Template Saved', `"${name}" saved with ${selectedActions.length} actions`);
    }
    catch (error) {
        console.error('Failed to save template:', error);
        showToast('error', 'Error', 'Failed to save template');
    }
}

// ===== editor-templates-manage.ts =====
/**
 * Insert a template's actions into the current workflow (as copies)
 */
async function insertTemplateIntoWorkflow(templateId, insertIndex = -1) {
    if (!state.currentWorkflow) {
        showToast('warning', 'No Workflow', 'Open a workflow first');
        return;
    }
    const template = editorState.templates.find(t => t.id === templateId);
    if (!template) {
        showToast('error', 'Error', 'Template not found');
        return;
    }
    // Deep copy actions with new IDs
    const copiedActions = template.actions.map(action => {
        const copy = JSON.parse(JSON.stringify(action));
        copy.id = generateId();
        return copy;
    });
    if (insertIndex === -1 || insertIndex >= state.currentWorkflow.actions.length) {
        state.currentWorkflow.actions.push(...copiedActions);
    }
    else {
        state.currentWorkflow.actions.splice(insertIndex, 0, ...copiedActions);
    }
    markDirty();
    renderActionSequence();
    saveCurrentWorkflow();
    showToast('success', 'Template Inserted', `Added ${copiedActions.length} actions from "${template.name}"`);
}
/**
 * Open modal to rename a template
 */
function openRenameTemplateModal(templateId) {
    const template = editorState.templates.find(t => t.id === templateId);
    if (!template)
        return;
    showModal('Rename Template', `
      <div class="config-field">
        <label>Template Name</label>
        <input type="text" id="rename-template-name" value="${escapeHtml(template.name)}">
      </div>
    `, [
        { label: 'Cancel', class: 'btn-secondary', action: 'close' },
        { label: 'Save', primary: true, onClick: () => renameTemplate(templateId) }
    ]);
    const input = document.getElementById('rename-template-name');
    input.focus();
    input.select();
}
/**
 * Rename a template
 */
async function renameTemplate(templateId) {
    const name = document.getElementById('rename-template-name').value.trim();
    if (!name) {
        showToast('error', 'Error', 'Please enter a name');
        return;
    }
    try {
        const updated = await window.workflowAPI.updateTemplate(templateId, { name });
        const index = editorState.templates.findIndex(t => t.id === templateId);
        if (index !== -1) {
            editorState.templates[index] = updated;
        }
        renderTemplateList();
        closeModal();
        showToast('success', 'Renamed', `Template renamed to "${name}"`);
    }
    catch (error) {
        console.error('Failed to rename template:', error);
        showToast('error', 'Error', 'Failed to rename template');
    }
}
/**
 * Delete a template
 */
async function deleteTemplate(templateId) {
    const template = editorState.templates.find(t => t.id === templateId);
    if (!template)
        return;
    showModal('Delete Template', `<p>Are you sure you want to delete "${escapeHtml(template.name)}"?</p>
     <p style="color: var(--text-secondary); font-size: var(--text-sm);">This action cannot be undone.</p>`, [
        { label: 'Cancel', class: 'btn-secondary', action: 'close' },
        { label: 'Delete', class: 'btn-danger', onClick: async () => {
                try {
                    await window.workflowAPI.deleteTemplate(templateId);
                    editorState.templates = editorState.templates.filter(t => t.id !== templateId);
                    renderTemplateList();
                    closeModal();
                    showToast('success', 'Deleted', 'Template deleted');
                }
                catch (error) {
                    console.error('Failed to delete template:', error);
                    showToast('error', 'Error', 'Failed to delete template');
                }
            } }
    ]);
}

// ===== editor-key-recorder.ts =====
/**
 * Setup the key recorder widget for keyboard action config.
 * Listens for real keydown events and builds a combo string (e.g. "ctrl+shift+a").
 */
function setupKeyRecorder(action, save) {
    const recorder = document.getElementById('key-recorder');
    const btn = document.getElementById('key-recorder-btn');
    const display = document.getElementById('key-recorder-display');
    const manualInput = document.getElementById('config-key');
    if (!recorder || !btn)
        return;
    let isRecording = false;
    let heldKeys = new Set();
    let keydownHandler = null;
    let keyupHandler = null;
    const KEY_DISPLAY_MAP = {
        'Control': 'ctrl',
        'Shift': 'shift',
        'Alt': 'alt',
        'Meta': 'cmd',
        'Enter': 'enter',
        'Backspace': 'backspace',
        'Delete': 'delete',
        'Escape': 'escape',
        'Tab': 'tab',
        'ArrowUp': 'up',
        'ArrowDown': 'down',
        'ArrowLeft': 'left',
        'ArrowRight': 'right',
        'CapsLock': 'capslock',
        ' ': 'space',
        'Home': 'home',
        'End': 'end',
        'PageUp': 'pageup',
        'PageDown': 'pagedown',
        'Insert': 'insert'
    };
    function normalizeKey(e) {
        if (KEY_DISPLAY_MAP[e.key])
            return KEY_DISPLAY_MAP[e.key];
        if (e.key.length === 1)
            return e.key.toLowerCase();
        if (e.key.startsWith('F') && !isNaN(e.key.slice(1)))
            return e.key.toLowerCase();
        return e.key.toLowerCase();
    }
    function buildCombo() {
        const order = ['ctrl', 'alt', 'shift', 'cmd'];
        const modifiers = [];
        const others = [];
        for (const k of heldKeys) {
            if (order.includes(k))
                modifiers.push(k);
            else
                others.push(k);
        }
        modifiers.sort((a, b) => order.indexOf(a) - order.indexOf(b));
        return [...modifiers, ...others].join('+');
    }
    function startRecording() {
        isRecording = true;
        heldKeys.clear();
        recorder.classList.add('recording');
        btn.querySelector('.key-recorder-btn-label').textContent = 'Press a key...';
        display.innerHTML = '<span class="key-recorder-listening">Listening<span class="key-recorder-dots"><span>.</span><span>.</span><span>.</span></span></span>';
        keydownHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const key = normalizeKey(e);
            if (key === 'escape') {
                stopRecording(false);
                return;
            }
            heldKeys.add(key);
            // Live preview of held keys
            const combo = buildCombo();
            display.innerHTML = combo.split('+').map(k => `<span class="key-badge key-badge-live">${escapeHtml(k)}</span>`).join('<span class="key-badge-separator">+</span>');
        };
        keyupHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            // On first key release, finalize the combo
            if (heldKeys.size > 0) {
                const combo = buildCombo();
                action.key = combo;
                manualInput.value = combo;
                save();
                stopRecording(true);
            }
        };
        document.addEventListener('keydown', keydownHandler, true);
        document.addEventListener('keyup', keyupHandler, true);
    }
    function stopRecording(success) {
        isRecording = false;
        recorder.classList.remove('recording');
        btn.querySelector('.key-recorder-btn-label').textContent = 'Record Key';
        if (keydownHandler)
            document.removeEventListener('keydown', keydownHandler, true);
        if (keyupHandler)
            document.removeEventListener('keyup', keyupHandler, true);
        keydownHandler = null;
        keyupHandler = null;
        if (success) {
            updateKeyRecorderDisplay(action.key);
            // Brief success flash
            recorder.classList.add('recorded');
            setTimeout(() => recorder.classList.remove('recorded'), 600);
        }
        else {
            updateKeyRecorderDisplay(action.key);
        }
        heldKeys.clear();
    }
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (isRecording) {
            stopRecording(false);
        }
        else {
            startRecording();
        }
    });
}
/**
 * Update the key recorder display with key badges
 */
function updateKeyRecorderDisplay(key) {
    const display = document.getElementById('key-recorder-display');
    if (!display)
        return;
    if (!key) {
        display.innerHTML = '<span class="key-recorder-placeholder">No key set</span>';
        return;
    }
    display.innerHTML = key.split('+').map(k => `<span class="key-badge">${escapeHtml(k.trim())}</span>`).join('<span class="key-badge-separator">+</span>');
}
/**
 * Helper: Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text)
        return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== images-folders.ts =====
/**
 * Workflow Studio - Images View
 *
 * Manages image template gallery with thumbnails, capture, delete, and virtual folders
 */
let _imagesActiveFolder = null; // null = "All Images"
let _allImages = [];
let _allFolders = [];
/**
 * Initialize images view
 */
function initImagesView() {
    document.getElementById('btn-capture-template')?.addEventListener('click', captureNewTemplate);
    document.getElementById('btn-capture-template-empty')?.addEventListener('click', captureNewTemplate);
    document.getElementById('btn-new-folder')?.addEventListener('click', createNewFolder);
    loadImagesAndFolders();
}
/**
 * Load all data and render both sidebar and gallery
 */
async function loadImagesAndFolders() {
    try {
        const [images, folders] = await Promise.all([
            window.workflowAPI.getImages(),
            window.workflowAPI.getImageFolders()
        ]);
        _allImages = images || [];
        _allFolders = folders || [];
    }
    catch (e) {
        console.error('Failed to load images/folders:', e);
        _allImages = [];
        _allFolders = [];
    }
    renderFolderSidebar();
    renderFilteredGallery();
}
// ==================== FOLDER SIDEBAR ====================
function renderFolderSidebar() {
    const list = document.getElementById('folder-list');
    if (!list)
        return;
    const folderIcon = `<svg class="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
    const allIcon = `<svg class="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
    const allCount = _allImages.length;
    const uncatCount = _allImages.filter(i => !i.folder).length;
    let html = '';
    // All Images
    html += `<div class="folder-item ${_imagesActiveFolder === null ? 'active' : ''}" data-folder-key="__all__">
    ${allIcon}
    <span class="folder-name">All Images</span>
    <span class="folder-count">${allCount}</span>
  </div>`;
    // Uncategorized
    html += `<div class="folder-item ${_imagesActiveFolder === '__uncategorized__' ? 'active' : ''}" data-folder-key="__uncategorized__"
    data-folder-drop="__uncategorized__">
    ${allIcon}
    <span class="folder-name">Uncategorized</span>
    <span class="folder-count">${uncatCount}</span>
  </div>`;
    if (_allFolders.length > 0) {
        html += '<div class="folder-separator"></div>';
    }
    // Custom folders
    _allFolders.forEach(name => {
        const count = _allImages.filter(i => i.folder === name).length;
        html += `<div class="folder-item ${_imagesActiveFolder === name ? 'active' : ''}" data-folder-key="${escapeAttr(name)}"
      data-folder-drop="${escapeAttr(name)}">
      ${folderIcon}
      <span class="folder-name">${escapeHtml(name)}</span>
      <span class="folder-count">${count}</span>
      <div class="folder-actions">
        <button data-folder-rename="${escapeAttr(name)}" title="Rename">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
            <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
          </svg>
        </button>
        <button data-folder-delete="${escapeAttr(name)}" title="Delete folder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>`;
    });
    list.innerHTML = html;
    // Click to select folder
    list.querySelectorAll('.folder-item[data-folder-key]').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.folder-actions'))
                return;
            const key = el.dataset.folderKey;
            if (key === '__all__')
                _imagesActiveFolder = null;
            else if (key === '__uncategorized__')
                _imagesActiveFolder = '__uncategorized__';
            else
                _imagesActiveFolder = key;
            renderFolderSidebar();
            renderFilteredGallery();
        });
    });
    // Rename folder
    list.querySelectorAll('[data-folder-rename]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            startFolderRename(btn.dataset.folderRename);
        });
    });
    // Delete folder
    list.querySelectorAll('[data-folder-delete]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteFolder(btn.dataset.folderDelete);
        });
    });
    // Drop targets for drag-to-move
    list.querySelectorAll('[data-folder-drop]').forEach(el => {
        el.addEventListener('dragover', (e) => {
            e.preventDefault();
            el.classList.add('drag-over');
        });
        el.addEventListener('dragleave', () => {
            el.classList.remove('drag-over');
        });
        el.addEventListener('drop', async (e) => {
            e.preventDefault();
            el.classList.remove('drag-over');
            const imageId = e.dataTransfer.getData('text/image-id');
            if (!imageId)
                return;
            const targetFolder = el.dataset.folderDrop === '__uncategorized__' ? null : el.dataset.folderDrop;
            try {
                await window.workflowAPI.moveImageToFolder(imageId, targetFolder);
                await loadImagesAndFolders();
                showToast('success', 'Moved', `"${imageId}" moved${targetFolder ? ' to ' + targetFolder : ' to Uncategorized'}`);
            }
            catch (err) {
                showToast('error', 'Error', err.message || 'Failed to move image');
            }
        });
    });
}
function escapeAttr(s) {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
async function createNewFolder() {
    showModal('New Folder', `<div class="config-field">
      <label>Folder Name</label>
      <input type="text" id="new-folder-name" placeholder="e.g. Bank, Inventory, UI..." autofocus>
    </div>`, [
        { label: 'Cancel', class: 'btn-secondary' },
        {
            label: 'Create',
            class: 'btn-primary',
            onClick: async () => {
                const name = document.getElementById('new-folder-name').value.trim();
                if (!name)
                    return;
                try {
                    await window.workflowAPI.createImageFolder(name);
                    _imagesActiveFolder = name;
                    await loadImagesAndFolders();
                    showToast('success', 'Created', `Folder "${name}" created`);
                }
                catch (err) {
                    showToast('error', 'Error', err.message || 'Failed to create folder');
                }
            }
        }
    ]);
    setTimeout(() => document.getElementById('new-folder-name')?.focus(), 100);
}
function startFolderRename(currentName) {
    const folderEl = document.querySelector(`[data-folder-key="${CSS.escape(currentName)}"]`);
    if (!folderEl)
        return;
    const nameEl = folderEl.querySelector('.folder-name');
    if (!nameEl || nameEl.querySelector('input'))
        return;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'folder-rename-input';
    input.value = currentName;
    input.spellcheck = false;
    nameEl.textContent = '';
    nameEl.appendChild(input);
    input.select();
    input.focus();
    let committed = false;
    async function commit() {
        if (committed)
            return;
        committed = true;
        const newName = input.value.trim();
        if (!newName || newName === currentName) {
            nameEl.textContent = currentName;
            return;
        }
        try {
            await window.workflowAPI.renameImageFolder(currentName, newName);
            if (_imagesActiveFolder === currentName)
                _imagesActiveFolder = newName;
            await loadImagesAndFolders();
            showToast('success', 'Renamed', `"${currentName}" → "${newName}"`);
        }
        catch (err) {
            showToast('error', 'Error', err.message || 'Failed to rename folder');
            nameEl.textContent = currentName;
        }
    }
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        }
        else if (e.key === 'Escape') {
            e.preventDefault();
            committed = true;
            nameEl.textContent = currentName;
        }
    });
    input.addEventListener('blur', commit);
}
async function deleteFolder(name) {
    showConfirm('Delete Folder', `Delete folder "${name}"? Images inside will be moved to Uncategorized.`, async () => {
        try {
            await window.workflowAPI.deleteImageFolder(name);
            if (_imagesActiveFolder === name)
                _imagesActiveFolder = null;
            await loadImagesAndFolders();
            showToast('success', 'Deleted', `Folder "${name}" deleted`);
        }
        catch (err) {
            showToast('error', 'Error', err.message || 'Failed to delete folder');
        }
    });
}
// ==================== GALLERY ====================

// ===== images-gallery.ts =====
function renderFilteredGallery() {
    const gallery = document.getElementById('image-gallery');
    const emptyState = document.getElementById('images-empty');
    if (!gallery)
        return;
    let filtered;
    if (_imagesActiveFolder === null) {
        filtered = _allImages;
    }
    else if (_imagesActiveFolder === '__uncategorized__') {
        filtered = _allImages.filter(i => !i.folder);
    }
    else {
        filtered = _allImages.filter(i => i.folder === _imagesActiveFolder);
    }
    if (_allImages.length === 0) {
        gallery.innerHTML = '';
        gallery.style.display = 'none';
        if (emptyState)
            emptyState.classList.remove('hidden');
        return;
    }
    gallery.style.display = '';
    if (emptyState)
        emptyState.classList.add('hidden');
    if (filtered.length === 0) {
        gallery.innerHTML = '<p style="color: var(--text-tertiary); padding: var(--space-4); grid-column: 1/-1; text-align:center;">No images in this folder</p>';
        return;
    }
    gallery.innerHTML = filtered.map(img => {
        const filePath = img.path.replace(/\\/g, '/');
        return `
      <div class="image-gallery-item" data-id="${img.id}" draggable="true">
        <img src="file://${filePath}?t=${Date.now()}" alt="${img.id}" loading="lazy">
        <span class="image-name" data-rename="${img.id}" title="Click to rename">${img.id}</span>
        <button class="retake-image" data-retake="${img.id}" title="Retake">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
            <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
        <button class="delete-image" data-delete="${img.id}" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;
    }).join('');
    // Drag start — set image ID for folder drop targets
    gallery.querySelectorAll('.image-gallery-item[draggable]').forEach(el => {
        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/image-id', el.dataset.id);
            el.classList.add('dragging');
        });
        el.addEventListener('dragend', () => {
            el.classList.remove('dragging');
        });
    });
    // Rename handlers
    gallery.querySelectorAll('[data-rename]').forEach(nameEl => {
        nameEl.addEventListener('click', (e) => {
            e.stopPropagation();
            startInlineRename(nameEl, nameEl.dataset.rename);
        });
    });
    // Retake handlers
    gallery.querySelectorAll('[data-retake]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await retakeImage(btn.dataset.retake);
        });
    });
    // Delete handlers
    gallery.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const imageId = btn.dataset.delete;
            showConfirm('Delete Image', `Delete "${imageId}"? This cannot be undone.`, async () => {
                try {
                    await window.workflowAPI.deleteImage(imageId);
                    await loadImagesAndFolders();
                    showToast('success', 'Deleted', 'Image template deleted');
                }
                catch (error) {
                    showToast('error', 'Error', 'Failed to delete image');
                }
            });
        });
    });
}
// Keep this alias for any external callers
async function loadImageGallery() {
    await loadImagesAndFolders();
}
/**
 * Start inline rename on an image name element
 */
function startInlineRename(nameEl, currentId) {
    if (nameEl.querySelector('input'))
        return;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'image-rename-input';
    input.value = currentId;
    input.spellcheck = false;
    nameEl.textContent = '';
    nameEl.appendChild(input);
    input.select();
    input.focus();
    let committed = false;
    async function commit() {
        if (committed)
            return;
        committed = true;
        const newId = input.value.trim();
        if (!newId || newId === currentId) {
            nameEl.textContent = currentId;
            return;
        }
        try {
            await window.workflowAPI.renameImage(currentId, newId);
            showToast('success', 'Renamed', `"${currentId}" → "${newId}"`);
            await loadImagesAndFolders();
        }
        catch (error) {
            showToast('error', 'Rename Failed', error.message || 'Could not rename image');
            nameEl.textContent = currentId;
        }
    }
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        }
        else if (e.key === 'Escape') {
            e.preventDefault();
            committed = true;
            nameEl.textContent = currentId;
        }
    });
    input.addEventListener('blur', commit);
}
/**
 * Refresh all file:// image previews by busting the browser cache
 */
function refreshAllImagePreviews() {
    const bustParam = `t=${Date.now()}`;
    document.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src') || '';
        if (src.startsWith('file://')) {
            const cleanSrc = src.replace(/[?&]t=\d+/, '');
            img.src = cleanSrc + (cleanSrc.includes('?') ? '&' : '?') + bustParam;
        }
    });
}
/**
 * Retake an existing image template (overwrites the file, keeps the same ID)
 */
async function retakeImage(imageId) {
    try {
        await window.workflowAPI.minimizeWindow();
        await new Promise(r => setTimeout(r, 300));
        const result = await window.workflowAPI.captureRegionTemplate({ name: imageId });
        await window.workflowAPI.restoreWindow();
        if (result.cancelled) {
            showToast('info', 'Cancelled', 'Retake cancelled');
            return;
        }
        if (!result.success) {
            showToast('error', 'Error', result.error || 'Failed to capture region');
            return;
        }
        showToast('success', 'Retaken', `"${imageId}" has been updated`);
        try {
            await window.workflowAPI.clearTemplateCache(imageId);
        }
        catch (e) { /* ignore */ }
        await loadImagesAndFolders();
        refreshAllImagePreviews();
    }
    catch (error) {
        console.error('Retake failed:', error);
        showToast('error', 'Error', 'Failed to retake image');
        try {
            await window.workflowAPI.restoreWindow();
        }
        catch (e) { /* ignore */ }
    }
}
/**
 * Capture a new image template with region selection
 */
async function captureNewTemplate() {
    try {
        await window.workflowAPI.minimizeWindow();
        await new Promise(r => setTimeout(r, 300));
        const result = await window.workflowAPI.captureRegionTemplate();
        await window.workflowAPI.restoreWindow();
        if (result.cancelled) {
            showToast('info', 'Cancelled', 'Region capture cancelled');
            return;
        }
        if (!result.success) {
            showToast('error', 'Error', result.error || 'Failed to capture region');
            return;
        }
        // Auto-assign to active folder if viewing a specific folder
        if (_imagesActiveFolder && _imagesActiveFolder !== '__uncategorized__') {
            try {
                await window.workflowAPI.moveImageToFolder(result.imageId, _imagesActiveFolder);
            }
            catch (e) { /* ignore */ }
        }
        showToast('success', 'Captured', `Image template saved as ${result.imageId}`);
        await loadImagesAndFolders();
    }
    catch (error) {
        console.error('Capture failed:', error);
        showToast('error', 'Error', 'Failed to capture image');
        try {
            await window.workflowAPI.restoreWindow();
        }
        catch (e) { /* ignore */ }
    }
}

// ===== settings-init.ts =====
/**
 * Workflow Studio - Settings View
 *
 * Handles application settings and preferences
 */
// DOM references
let workflowsDirInput = null;
let panicHotkeyInput = null;
let pauseHotkeyInput = null;
let clickJitterCheckbox = null;
let jitterRadiusSlider = null;
let jitterRadiusValue = null;
let overshootCheckbox = null;
let typingSpeedMinInput = null;
let typingSpeedMaxInput = null;
let mouseMoveDurationInput = null;
let aiOpenRouterKeyInput = null;
let aiPreferredModelSelect = null;
/**
 * Initialize settings view
 */
function initSettingsView() {
    // Cache DOM elements
    workflowsDirInput = document.getElementById('workflows-dir');
    panicHotkeyInput = document.getElementById('panic-hotkey');
    pauseHotkeyInput = document.getElementById('pause-hotkey');
    clickJitterCheckbox = document.getElementById('click-jitter-enabled');
    jitterRadiusSlider = document.getElementById('jitter-radius');
    jitterRadiusValue = document.getElementById('jitter-radius-value');
    overshootCheckbox = document.getElementById('overshoot-enabled');
    typingSpeedMinInput = document.getElementById('typing-speed-min');
    typingSpeedMaxInput = document.getElementById('typing-speed-max');
    mouseMoveDurationInput = document.getElementById('mouse-move-duration');
    aiOpenRouterKeyInput = document.getElementById('ai-openrouter-key');
    aiPreferredModelSelect = document.getElementById('ai-preferred-model');
    // Setup event listeners
    setupSettingsEvents();
    // Load current settings into UI
    loadSettingsIntoUI();
    // Display app version
    const versionEl = document.getElementById('about-version');
    if (versionEl) {
        versionEl.textContent = window.platform?.appVersion
            ? `v${window.platform.appVersion}`
            : 'vunknown';
    }
}
/**
 * Setup settings event listeners
 */
function setupSettingsEvents() {
    // Browse directory
    document.getElementById('btn-browse-dir').addEventListener('click', browseDirectory);
    // Panic hotkey
    document.getElementById('btn-set-hotkey').addEventListener('click', changePanicHotkey);
    // Pause hotkey
    document.getElementById('btn-set-pause-hotkey')?.addEventListener('click', changePauseHotkey);
    // Check for updates
    document.getElementById('btn-check-updates')?.addEventListener('click', checkForUpdates);
    // Click jitter
    clickJitterCheckbox.addEventListener('change', async () => {
        state.settings.clickJitter = state.settings.clickJitter || {};
        state.settings.clickJitter.enabled = clickJitterCheckbox.checked;
        await saveSettings({ clickJitter: state.settings.clickJitter });
    });
    // Jitter radius
    jitterRadiusSlider.addEventListener('input', () => {
        jitterRadiusValue.textContent = jitterRadiusSlider.value;
    });
    jitterRadiusSlider.addEventListener('change', async () => {
        state.settings.clickJitter = state.settings.clickJitter || {};
        state.settings.clickJitter.radius = parseInt(jitterRadiusSlider.value);
        await saveSettings({ clickJitter: state.settings.clickJitter });
    });
    // Overshoot
    overshootCheckbox.addEventListener('change', async () => {
        state.settings.overshoot = state.settings.overshoot || {};
        state.settings.overshoot.enabled = overshootCheckbox.checked;
        await saveSettings({ overshoot: state.settings.overshoot });
    });
    // Typing speed
    typingSpeedMinInput.addEventListener('change', async () => {
        state.settings.typingSpeed = state.settings.typingSpeed || {};
        state.settings.typingSpeed.min = parseInt(typingSpeedMinInput.value) || 50;
        await saveSettings({ typingSpeed: state.settings.typingSpeed });
    });
    typingSpeedMaxInput.addEventListener('change', async () => {
        state.settings.typingSpeed = state.settings.typingSpeed || {};
        state.settings.typingSpeed.max = parseInt(typingSpeedMaxInput.value) || 150;
        await saveSettings({ typingSpeed: state.settings.typingSpeed });
    });
    // Mouse movement duration
    mouseMoveDurationInput.addEventListener('change', async () => {
        state.settings.mouseMoveDuration = parseInt(mouseMoveDurationInput.value) || 250;
        await saveSettings({ mouseMoveDuration: state.settings.mouseMoveDuration });
    });
    // OpenRouter API key
    aiOpenRouterKeyInput?.addEventListener('change', async () => {
        state.settings.ai = state.settings.ai || {};
        state.settings.ai.openRouterApiKey = aiOpenRouterKeyInput.value.trim();
        await saveSettings({ ai: state.settings.ai });
    });
    // Preferred AI model
    aiPreferredModelSelect?.addEventListener('change', async () => {
        state.settings.ai = state.settings.ai || {};
        state.settings.ai.preferredModel = aiPreferredModelSelect.value || 'codex-5.3';
        await saveSettings({ ai: state.settings.ai });
    });
}
/**
 * Load current settings into the UI
 */
async function loadSettingsIntoUI() {
    // Reload settings
    state.settings = await window.workflowAPI.getSettings();
    // Workflows directory
    let workflowsDir = '';
    try {
        workflowsDir = await window.workflowAPI.getWorkflowsDir();
    }
    catch (error) {
        console.error('Failed to fetch workflows directory:', error);
    }
    if (!workflowsDir) {
        try {
            workflowsDir = await window.workflowAPI.getSetting('workflowsDir');
        }
        catch (error) {
            console.error('Failed to fetch persisted workflows directory:', error);
        }
    }
    workflowsDirInput.value = workflowsDir || state.settings.workflowsDir || '';
    // Panic hotkey
    panicHotkeyInput.value = state.settings.panicHotkey || 'F7';
    // Pause hotkey
    pauseHotkeyInput.value = state.settings.pauseHotkey || 'F6';
    // Click jitter
    const jitter = state.settings.clickJitter || {};
    clickJitterCheckbox.checked = jitter.enabled !== false;
    jitterRadiusSlider.value = jitter.radius || 3;
    jitterRadiusValue.textContent = jitterRadiusSlider.value;
    // Overshoot
    const overshoot = state.settings.overshoot || {};
    overshootCheckbox.checked = overshoot.enabled !== false;
    // Typing speed
    const typing = state.settings.typingSpeed || {};
    typingSpeedMinInput.value = typing.min || 50;
    typingSpeedMaxInput.value = typing.max || 150;
    // Mouse movement duration
    mouseMoveDurationInput.value = state.settings.mouseMoveDuration ?? 250;
    // AI assistant settings
    const ai = state.settings.ai || {};
    aiOpenRouterKeyInput.value = ai.openRouterApiKey || '';
    aiPreferredModelSelect.value = ai.preferredModel || 'codex-5.3';
    // Load image gallery
    loadImageGallery();
}

// ===== settings-actions.ts =====
/**
 * Browse for workflows directory
 */
async function browseDirectory() {
    try {
        const defaultPath = workflowsDirInput.value || await window.workflowAPI.getWorkflowsDir();
        const selectedDir = await window.workflowAPI.selectDirectory({
            title: 'Select Workflows Directory',
            defaultPath
        });
        if (selectedDir) {
            workflowsDirInput.value = selectedDir;
            await saveSettings({ workflowsDir: selectedDir });
            showToast('success', 'Saved', 'Workflows directory updated');
            // Reload workflows from new directory
            await loadWorkflows();
        }
    }
    catch (error) {
        console.error('Failed to select directory:', error);
        showToast('error', 'Error', 'Failed to select directory');
    }
}
/**
 * Change panic hotkey
 */
async function changePanicHotkey() {
    showModal('Change Panic Hotkey', `
      <p style="margin-bottom: var(--space-4);">Press the key or key combination you want to use as the panic hotkey.</p>
      <div class="config-field">
        <input type="text" id="new-hotkey-input" placeholder="Press a key..." readonly style="text-align: center; font-size: var(--text-lg);">
      </div>
      <p class="config-field-hint">Common options: F7, Escape, Ctrl+Shift+Q</p>
    `, [
        { label: 'Cancel', class: 'btn-secondary' },
        {
            label: 'Save',
            class: 'btn-primary',
            onClick: async () => {
                const newHotkey = document.getElementById('new-hotkey-input').value;
                if (newHotkey) {
                    try {
                        await window.workflowAPI.setPanicHotkey(newHotkey);
                        await saveSettings({ panicHotkey: newHotkey });
                        panicHotkeyInput.value = newHotkey;
                        showToast('success', 'Saved', 'Panic hotkey updated');
                    }
                    catch (error) {
                        showToast('error', 'Error', 'Failed to set hotkey');
                    }
                }
            }
        }
    ]);
    // Setup key capture
    const input = document.getElementById('new-hotkey-input');
    input.focus();
    input.addEventListener('keydown', (e) => {
        e.preventDefault();
        const parts = [];
        if (e.ctrlKey)
            parts.push('Ctrl');
        if (e.altKey)
            parts.push('Alt');
        if (e.shiftKey)
            parts.push('Shift');
        if (e.metaKey)
            parts.push('Cmd');
        // Get the key name
        let key = e.key;
        if (key === ' ')
            key = 'Space';
        if (key === 'Control' || key === 'Alt' || key === 'Shift' || key === 'Meta') {
            // Don't add modifier-only keys
            input.value = parts.join('+') || '';
            return;
        }
        // Capitalize single letters
        if (key.length === 1) {
            key = key.toUpperCase();
        }
        parts.push(key);
        input.value = parts.join('+');
    });
}
/**
 * Change pause hotkey
 */
async function changePauseHotkey() {
    showModal('Change Pause / Resume Hotkey', `
      <p style="margin-bottom: var(--space-4);">Press the key or key combination you want to use to pause and resume workflows.</p>
      <div class="config-field">
        <input type="text" id="new-pause-hotkey-input" placeholder="Press a key..." readonly style="text-align: center; font-size: var(--text-lg);">
      </div>
      <p class="config-field-hint">Common options: F6, Pause, Ctrl+Shift+P</p>
    `, [
        { label: 'Cancel', class: 'btn-secondary' },
        {
            label: 'Save',
            class: 'btn-primary',
            onClick: async () => {
                const newHotkey = document.getElementById('new-pause-hotkey-input').value;
                if (newHotkey) {
                    try {
                        await window.workflowAPI.setPauseHotkey(newHotkey);
                        await saveSettings({ pauseHotkey: newHotkey });
                        pauseHotkeyInput.value = newHotkey;
                        showToast('success', 'Saved', 'Pause hotkey updated');
                    }
                    catch (error) {
                        showToast('error', 'Error', 'Failed to set hotkey');
                    }
                }
            }
        }
    ]);
    // Setup key capture
    const input = document.getElementById('new-pause-hotkey-input');
    input.focus();
    input.addEventListener('keydown', (e) => {
        e.preventDefault();
        const parts = [];
        if (e.ctrlKey)
            parts.push('Ctrl');
        if (e.altKey)
            parts.push('Alt');
        if (e.shiftKey)
            parts.push('Shift');
        if (e.metaKey)
            parts.push('Cmd');
        let key = e.key;
        if (key === ' ')
            key = 'Space';
        if (key === 'Control' || key === 'Alt' || key === 'Shift' || key === 'Meta') {
            input.value = parts.join('+') || '';
            return;
        }
        if (key.length === 1) {
            key = key.toUpperCase();
        }
        parts.push(key);
        input.value = parts.join('+');
    });
}
/**
 * Save settings to storage
 */
async function saveSettings(updates) {
    try {
        state.settings = await window.workflowAPI.updateSettings(updates);
        window.dispatchEvent(new CustomEvent('settings:updated', { detail: { settings: state.settings } }));
    }
    catch (error) {
        console.error('Failed to save settings:', error);
        showToast('error', 'Error', 'Failed to save settings');
    }
}
/**
 * Manually check for updates
 */
async function checkForUpdates() {
    const btn = document.getElementById('btn-check-updates');
    const label = document.getElementById('check-updates-label');
    const hint = document.getElementById('update-status-hint');
    if (!btn || !label)
        return;
    // Set loading state
    btn.disabled = true;
    btn.classList.add('checking');
    label.textContent = 'Checking...';
    if (hint)
        hint.textContent = 'Contacting update server...';
    // Listen for result
    const onAvailable = (info) => {
        label.textContent = 'Update Available!';
        if (hint)
            hint.textContent = `Version ${info?.version || 'new'} is available — downloading now`;
        btn.classList.remove('checking');
        btn.classList.add('update-found');
        cleanup();
    };
    const onNotAvailable = () => {
        label.textContent = 'Up to Date';
        if (hint)
            hint.textContent = `You're on the latest version (v${window.platform?.appVersion || '?'})`;
        btn.classList.remove('checking');
        btn.classList.add('up-to-date');
        cleanup();
        // Reset after a few seconds
        setTimeout(() => {
            label.textContent = 'Check for Updates';
            btn.disabled = false;
            btn.classList.remove('up-to-date');
            if (hint)
                hint.textContent = 'Updates are checked automatically every 30 minutes';
        }, 4000);
    };
    const onError = (err) => {
        label.textContent = 'Check Failed';
        if (hint)
            hint.textContent = err?.message || 'Could not reach update server';
        btn.classList.remove('checking');
        btn.classList.add('check-failed');
        cleanup();
        setTimeout(() => {
            label.textContent = 'Check for Updates';
            btn.disabled = false;
            btn.classList.remove('check-failed');
            if (hint)
                hint.textContent = 'Updates are checked automatically every 30 minutes';
        }, 4000);
    };
    function cleanup() {
        window.workflowAPI.onUpdateAvailable?.removeListener?.(onAvailable);
        window.workflowAPI.onUpdateNotAvailable?.removeListener?.(onNotAvailable);
        window.workflowAPI.onUpdateError?.removeListener?.(onError);
    }
    // Register one-shot listeners
    if (window.workflowAPI.onUpdateAvailable)
        window.workflowAPI.onUpdateAvailable(onAvailable);
    if (window.workflowAPI.onUpdateNotAvailable)
        window.workflowAPI.onUpdateNotAvailable(onNotAvailable);
    if (window.workflowAPI.onUpdateError)
        window.workflowAPI.onUpdateError(onError);
    try {
        await window.workflowAPI.checkForUpdates();
    }
    catch (err) {
        onError(err);
    }
    // Fallback timeout in case no event fires
    setTimeout(() => {
        if (btn.classList.contains('checking')) {
            onError({ message: 'Timed out waiting for update server' });
        }
    }, 15000);
}

// ===== hotkeys-core.ts =====
/**
 * Workflow Studio - Hotkeys View
 *
 * Manages global hotkey bindings for launching workflows from any application.
 */
let hotkeyBindings = [];
let pendingAccelerator = null;
/**
 * Initialize hotkeys view
 */
function initHotkeysView() {
    setupHotkeyEvents();
    loadHotkeys();
    // Listen for hotkey triggered events
    window.workflowAPI.onHotkeyTriggered((data) => {
        if (data.ignored) {
            if (data.reason === 'already_running') {
                showToast('warning', 'Hotkey Ignored', 'A workflow is already running');
            }
            else if (data.reason === 'not_found') {
                showToast('error', 'Workflow Not Found', `"${data.workflowName}" no longer exists`);
            }
        }
        else {
            showToast('info', 'Hotkey Triggered', `Running "${data.workflowName}"`);
        }
    });
}
/**
 * Load hotkey bindings and render
 */
async function loadHotkeys() {
    try {
        hotkeyBindings = await window.workflowAPI.getHotkeys();
        renderHotkeyList();
        populateWorkflowSelect();
    }
    catch (error) {
        console.error('[Hotkeys] Failed to load:', error);
    }
}
/**
 * Populate the workflow dropdown (excluding workflows that already have hotkeys)
 */
function populateWorkflowSelect() {
    const select = document.getElementById('hotkey-workflow-select');
    if (!select)
        return;
    const assignedIds = new Set(hotkeyBindings.map(b => b.workflowId));
    select.innerHTML = '<option value="">Select a workflow...</option>';
    (state.workflows || []).forEach(w => {
        if (!assignedIds.has(w.id)) {
            const opt = document.createElement('option');
            opt.value = w.id;
            opt.textContent = w.name || 'Untitled';
            select.appendChild(opt);
        }
    });
}
/**
 * Render the list of hotkey bindings
 */
function renderHotkeyList() {
    const list = document.getElementById('hotkeys-list');
    const empty = document.getElementById('hotkeys-empty');
    if (!list || !empty)
        return;
    if (hotkeyBindings.length === 0) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');
    list.innerHTML = hotkeyBindings.map(binding => `
    <div class="hotkey-binding-card" data-workflow-id="${binding.workflowId}">
      <div class="hotkey-binding-keys">
        ${formatAcceleratorBadges(binding.accelerator)}
      </div>
      <div class="hotkey-binding-info">
        <div class="hotkey-binding-workflow">${escapeHtml(binding.workflowName || 'Unknown Workflow')}</div>
        <div class="hotkey-binding-hint">Press from any app to run this workflow</div>
      </div>
      <div class="hotkey-binding-actions">
        <button class="btn btn-sm btn-secondary hotkey-test-btn" data-workflow-id="${binding.workflowId}" title="Test run this workflow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </button>
        <button class="btn btn-sm btn-danger hotkey-remove-btn" data-workflow-id="${binding.workflowId}" title="Remove hotkey">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');
    // Wire up remove buttons
    list.querySelectorAll('.hotkey-remove-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const workflowId = btn.dataset.workflowId;
            await window.workflowAPI.removeHotkey(workflowId);
            showToast('success', 'Removed', 'Hotkey removed');
            loadHotkeys();
        });
    });
    // Wire up test buttons
    list.querySelectorAll('.hotkey-test-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const workflowId = btn.dataset.workflowId;
            const workflow = state.workflows.find(w => w.id === workflowId);
            if (workflow) {
                try {
                    await window.workflowAPI.executeWorkflow(workflow, {});
                }
                catch (err) {
                    showToast('error', 'Error', err.message);
                }
            }
        });
    });
}
/**
 * Format an Electron accelerator string into key badges
 */
function formatAcceleratorBadges(accelerator) {
    if (!accelerator)
        return '<span class="key-recorder-placeholder">None</span>';
    return accelerator.split('+').map(k => `<span class="key-badge">${escapeHtml(k.trim())}</span>`).join('<span class="key-badge-separator">+</span>');
}
/**
 * Setup event listeners for the hotkeys view
 */
function setupHotkeyEvents() {
    const addBtn = document.getElementById('btn-add-hotkey');
    const select = document.getElementById('hotkey-workflow-select');
    if (!addBtn || !select)
        return;
    // Update add button state
    function updateAddBtnState() {
        addBtn.disabled = !select.value || !pendingAccelerator;
    }
    select.addEventListener('change', updateAddBtnState);
    // Add hotkey
    addBtn.addEventListener('click', async () => {
        const workflowId = select.value;
        const workflow = state.workflows.find(w => w.id === workflowId);
        if (!workflowId || !pendingAccelerator || !workflow)
            return;
        addBtn.disabled = true;
        try {
            await window.workflowAPI.setHotkey(pendingAccelerator, workflowId, workflow.name);
            showToast('success', 'Hotkey Added', `${pendingAccelerator} → ${workflow.name}`);
            // Reset form
            pendingAccelerator = null;
            select.value = '';
            document.getElementById('hotkey-recorder-display').innerHTML =
                '<span class="key-recorder-placeholder">No hotkey set</span>';
            document.getElementById('hotkey-recorder').classList.remove('recorded');
            loadHotkeys();
        }
        catch (error) {
            showToast('error', 'Error', error.message || 'Failed to add hotkey');
            addBtn.disabled = false;
        }
    });
    // Setup the hotkey recorder
    setupHotkeyRecorder(updateAddBtnState);
}

// ===== hotkeys-recorder.ts =====
/**
 * Setup the hotkey recorder for the add form.
 * Records key combos and converts to Electron accelerator format.
 */
function setupHotkeyRecorder(onUpdate) {
    const recorder = document.getElementById('hotkey-recorder');
    const btn = document.getElementById('hotkey-recorder-btn');
    const display = document.getElementById('hotkey-recorder-display');
    if (!recorder || !btn)
        return;
    let isRecording = false;
    let heldKeys = new Set();
    let keydownHandler = null;
    let keyupHandler = null;
    // Map browser key names to Electron accelerator names
    const ACCELERATOR_MAP = {
        'Control': 'CommandOrControl',
        'Shift': 'Shift',
        'Alt': 'Alt',
        'Meta': 'Super',
        'Enter': 'Enter',
        'Backspace': 'Backspace',
        'Delete': 'Delete',
        'Tab': 'Tab',
        'ArrowUp': 'Up',
        'ArrowDown': 'Down',
        'ArrowLeft': 'Left',
        'ArrowRight': 'Right',
        'Home': 'Home',
        'End': 'End',
        'PageUp': 'PageUp',
        'PageDown': 'PageDown',
        'Insert': 'Insert',
        ' ': 'Space',
        'Escape': 'Escape'
    };
    // Display-friendly names
    const DISPLAY_MAP = {
        'CommandOrControl': 'Ctrl',
        'Super': 'Win',
        'Space': 'Space'
    };
    function toAccelerator(e) {
        if (ACCELERATOR_MAP[e.key])
            return ACCELERATOR_MAP[e.key];
        if (e.key.length === 1)
            return e.key.toUpperCase();
        if (e.key.startsWith('F') && !isNaN(e.key.slice(1)))
            return e.key;
        return e.key;
    }
    function toDisplay(accel) {
        return DISPLAY_MAP[accel] || accel;
    }
    function isModifier(accel) {
        return ['CommandOrControl', 'Shift', 'Alt', 'Super'].includes(accel);
    }
    function buildAccelerator() {
        const order = ['CommandOrControl', 'Alt', 'Shift', 'Super'];
        const modifiers = [];
        const others = [];
        for (const k of heldKeys) {
            if (order.includes(k))
                modifiers.push(k);
            else
                others.push(k);
        }
        modifiers.sort((a, b) => order.indexOf(a) - order.indexOf(b));
        return [...modifiers, ...others].join('+');
    }
    function startRecording() {
        isRecording = true;
        heldKeys.clear();
        recorder.classList.add('recording');
        btn.querySelector('.hotkey-recorder-btn-label').textContent = 'Press keys...';
        display.innerHTML = '<span class="key-recorder-listening">Listening<span class="key-recorder-dots"><span>.</span><span>.</span><span>.</span></span></span>';
        keydownHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const key = toAccelerator(e);
            if (key === 'Escape') {
                stopRecording(false);
                return;
            }
            heldKeys.add(key);
            // Live preview
            const accel = buildAccelerator();
            display.innerHTML = accel.split('+').map(k => `<span class="key-badge key-badge-live">${escapeHtml(toDisplay(k))}</span>`).join('<span class="key-badge-separator">+</span>');
        };
        keyupHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (heldKeys.size > 0) {
                const accel = buildAccelerator();
                // Validate: must have at least one modifier + one non-modifier
                const hasModifier = [...heldKeys].some(k => isModifier(k));
                const hasKey = [...heldKeys].some(k => !isModifier(k));
                if (hasModifier && hasKey) {
                    pendingAccelerator = accel;
                    stopRecording(true);
                }
                else if (!hasModifier) {
                    // Show error
                    display.innerHTML = '<span style="color: var(--color-danger-400); font-size: var(--text-sm);">Must include Ctrl, Alt, or Shift</span>';
                    heldKeys.clear();
                    setTimeout(() => {
                        if (isRecording) {
                            display.innerHTML = '<span class="key-recorder-listening">Listening<span class="key-recorder-dots"><span>.</span><span>.</span><span>.</span></span></span>';
                        }
                    }, 1500);
                    return;
                }
                else {
                    // Only modifiers, keep listening
                    heldKeys.clear();
                    display.innerHTML = '<span class="key-recorder-listening">Now press a key...<span class="key-recorder-dots"><span>.</span><span>.</span><span>.</span></span></span>';
                    return;
                }
            }
        };
        document.addEventListener('keydown', keydownHandler, true);
        document.addEventListener('keyup', keyupHandler, true);
    }
    function stopRecording(success) {
        isRecording = false;
        recorder.classList.remove('recording');
        btn.querySelector('.hotkey-recorder-btn-label').textContent = 'Record Hotkey';
        if (keydownHandler)
            document.removeEventListener('keydown', keydownHandler, true);
        if (keyupHandler)
            document.removeEventListener('keyup', keyupHandler, true);
        keydownHandler = null;
        keyupHandler = null;
        if (success && pendingAccelerator) {
            display.innerHTML = pendingAccelerator.split('+').map(k => `<span class="key-badge">${escapeHtml(toDisplay(k))}</span>`).join('<span class="key-badge-separator">+</span>');
            recorder.classList.add('recorded');
            setTimeout(() => recorder.classList.remove('recorded'), 600);
        }
        else if (!pendingAccelerator) {
            display.innerHTML = '<span class="key-recorder-placeholder">No hotkey set</span>';
        }
        heldKeys.clear();
        if (onUpdate)
            onUpdate();
    }
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (isRecording) {
            stopRecording(false);
        }
        else {
            startRecording();
        }
    });
}

// ===== execution-init.ts =====
/**
 * Workflow Studio - Execution Overlay
 *
 * Handles execution progress display and controls
 */
// DOM references
let executionOverlay = null;
let executionWorkflowName = null;
let progressFill = null;
let progressText = null;
let executionAction = null;
let btnPauseExecution = null;
let btnStopExecution = null;
let waitCountdown = null;
let waitCountdownFill = null;
let waitCountdownLabel = null;
let waitCountdownTime = null;
// Execution state
let currentExecution = {
    workflow: null,
    totalLoops: 1,
    currentLoop: 0,
    totalActions: 0,
    currentAction: 0,
    isPaused: false
};
// Scheduled stop state
let scheduledStopTime = null; // Date object or null
let scheduledStopInterval = null;
let scheduledFollowUpWorkflowId = null; // workflow ID to run after stop
// Current wait state (for syncing to floating bar)
let currentWait = { active: false, duration: 0, remaining: 0, paused: false };
/**
 * Initialize execution elements
 */
function initExecutionUI() {
    executionOverlay = document.getElementById('execution-overlay');
    executionWorkflowName = document.getElementById('execution-workflow-name');
    progressFill = document.getElementById('progress-fill');
    progressText = document.getElementById('execution-progress-text');
    executionAction = document.getElementById('execution-action');
    btnPauseExecution = document.getElementById('btn-pause-execution');
    btnStopExecution = document.getElementById('btn-stop-execution');
    waitCountdown = document.getElementById('wait-countdown');
    waitCountdownFill = document.getElementById('wait-countdown-fill');
    waitCountdownLabel = document.getElementById('wait-countdown-label');
    waitCountdownTime = document.getElementById('wait-countdown-time');
    // Setup button listeners
    btnPauseExecution.addEventListener('click', togglePause);
    btnStopExecution.addEventListener('click', stopExecution);
    // Wait countdown events
    window.workflowAPI.onWaitStart((data) => {
        showWaitCountdown(data.duration);
    });
    window.workflowAPI.onWaitTick((data) => {
        updateWaitCountdown(data.duration, data.remaining, data.paused);
    });
    // Hide countdown when a new (non-wait) action starts
    window.workflowAPI.onActionStarted((data) => {
        if (data.action && data.action.type !== 'wait') {
            hideWaitCountdown();
        }
    });
    // Floating bar (native window) controls
    const btnMinimize = document.getElementById('btn-minimize-execution');
    if (btnMinimize) {
        btnMinimize.addEventListener('click', async () => {
            executionOverlay.classList.add('hidden');
            await window.workflowAPI.showFloatingBar();
            // Sync current pause state to the floating bar
            await window.workflowAPI.updateFloatingBarPause(currentExecution.isPaused);
            // Sync current wait state if active
            if (currentWait.active && currentWait.remaining > 0) {
                await window.workflowAPI.syncFloatingBarWait({
                    duration: currentWait.duration,
                    remaining: currentWait.remaining,
                    paused: currentWait.paused
                });
            }
            // Sync scheduled stop timer if active
            if (scheduledStopTime) {
                const remaining = scheduledStopTime - new Date();
                if (remaining > 0) {
                    await window.workflowAPI.updateFloatingBarStopTimer({
                        visible: true,
                        text: `\u23F1 ${formatCountdown(remaining)}`
                    });
                }
            }
        });
    }
    // Listen for floating bar button events
    window.workflowAPI.onFloatingBarPauseClicked(() => {
        togglePause();
    });
    window.workflowAPI.onFloatingBarStopClicked(() => {
        stopExecution();
    });
    window.workflowAPI.onFloatingBarExpandClicked(() => {
        executionOverlay.classList.remove('hidden');
    });
    // Scheduled stop controls
    const btnSetStopTime = document.getElementById('btn-set-stop-time');
    const btnClearStopTime = document.getElementById('btn-clear-stop-time');
    const btnClearStopTimeActive = document.getElementById('btn-clear-stop-time-active');
    const stopTimeInput = document.getElementById('scheduled-stop-time');
    if (btnSetStopTime) {
        btnSetStopTime.addEventListener('click', () => {
            const val = stopTimeInput?.value;
            if (!val)
                return;
            setScheduledStop(val);
        });
    }
    if (stopTimeInput) {
        stopTimeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const val = stopTimeInput.value;
                if (val)
                    setScheduledStop(val);
            }
        });
    }
    if (btnClearStopTime) {
        btnClearStopTime.addEventListener('click', clearScheduledStop);
    }
    if (btnClearStopTimeActive) {
        btnClearStopTimeActive.addEventListener('click', clearScheduledStop);
    }
}
window.initExecutionUI = initExecutionUI;
// Initialize when DOM is ready
// Execution UI initialization is triggered by runtime/bootstrap.ts.
/**
 * Show execution overlay
 */
function showExecutionOverlay(workflow) {
    currentExecution = {
        workflow: workflow,
        totalLoops: workflow.loopCount || 1,
        currentLoop: 0,
        totalActions: workflow.actions?.length || 0,
        currentAction: 0,
        isPaused: false
    };
    executionWorkflowName.textContent = workflow.name || 'Running Workflow';
    updateProgressDisplay();
    executionAction.textContent = 'Starting...';
    // Reset pause button and update hotkey labels
    currentExecution.isPaused = false;
    setPauseButtonState(false);
    const stopLabel = document.getElementById('stop-hotkey-label');
    if (stopLabel)
        stopLabel.textContent = state.settings?.panicHotkey || 'F7';
    // Reset scheduled stop UI
    clearScheduledStop();
    populateFollowUpWorkflows();
    // Hide floating bar native window, show overlay
    window.workflowAPI.hideFloatingBar();
    executionOverlay.classList.remove('hidden');
    // Show stop button in editor
    document.getElementById('btn-run').classList.add('hidden');
    document.getElementById('btn-stop').classList.remove('hidden');
}
/**
 * Hide execution overlay
 */
function hideExecutionOverlay() {
    executionOverlay.classList.add('hidden');
    // Close floating bar native window
    window.workflowAPI.closeFloatingBar();
    // Clear any scheduled stop timer
    clearScheduledStop();
    // Hide stop button in editor
    document.getElementById('btn-run').classList.remove('hidden');
    document.getElementById('btn-stop').classList.add('hidden');
}
/**
 * Update execution progress from action event
 */
function updateExecutionProgress(data) {
    currentExecution.currentAction = data.index + 1;
    currentExecution.totalActions = data.total;
    updateProgressDisplay();
    // Update action text
    const action = data.action;
    const actionType = ACTION_TYPES[action.type];
    const typeName = actionType?.name || action.type;
    const displayName = action.name ? `${typeName} (${action.name})` : typeName;
    executionAction.textContent = `${displayName}: ${getActionSummary(action)}`;
    // Highlight current action in editor
    highlightCurrentAction(data.index);
}
/**
 * Update loop progress from loop event
 */
function updateLoopProgress(data) {
    currentExecution.currentLoop = data.loop;
    currentExecution.totalLoops = data.total;
    currentExecution.currentAction = 0;
    updateProgressDisplay();
}

// ===== execution-controls.ts =====
/**
 * Update the progress display
 */
function updateProgressDisplay() {
    const { currentLoop, totalLoops, currentAction, totalActions } = currentExecution;
    // Calculate overall progress
    const actionsPerLoop = totalActions || 1;
    const completedActions = ((currentLoop - 1) * actionsPerLoop) + currentAction;
    const totalAllActions = totalLoops * actionsPerLoop;
    const progress = totalAllActions > 0 ? (completedActions / totalAllActions) * 100 : 0;
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `Loop ${currentLoop}/${totalLoops} - Action ${currentAction}/${totalActions}`;
}
/**
 * Highlight current action in editor sequence
 */
function highlightCurrentAction(index) {
    // Remove existing highlight
    document.querySelectorAll('.sequence-item.executing').forEach(el => {
        el.classList.remove('executing');
    });
    // Add highlight to current action
    const items = document.querySelectorAll('.sequence-item');
    if (items[index]) {
        items[index].classList.add('executing');
        items[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}
/**
 * Toggle pause/resume
 */
async function togglePause() {
    if (currentExecution.isPaused) {
        await window.workflowAPI.resumeExecution();
        currentExecution.isPaused = false;
        setPauseButtonState(false);
        executionAction.textContent = 'Resuming...';
    }
    else {
        await window.workflowAPI.pauseExecution();
        currentExecution.isPaused = true;
        setPauseButtonState(true);
        executionAction.textContent = 'Paused';
    }
}
/**
 * Sync pause/resume button state across overlay and floating bar
 */
function setPauseButtonState(paused) {
    const pauseIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
    const resumeIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    const pauseKey = state.settings?.pauseHotkey || 'F6';
    if (btnPauseExecution) {
        btnPauseExecution.innerHTML = paused
            ? `${resumeIcon} Resume (<span class="hotkey-label" id="pause-hotkey-label">${pauseKey}</span>)`
            : `${pauseIcon} Pause (<span class="hotkey-label" id="pause-hotkey-label">${pauseKey}</span>)`;
    }
    // Sync to floating bar native window
    window.workflowAPI.updateFloatingBarPause(paused);
}
/**
 * Stop execution
 */
async function stopExecution() {
    clearScheduledStop();
    await window.workflowAPI.emergencyStop();
    hideWaitCountdown();
    hideExecutionOverlay();
}
/**
 * Show wait countdown with chosen duration
 */
function showWaitCountdown(duration) {
    currentWait = { active: true, duration, remaining: duration, paused: false };
    if (!waitCountdown)
        return;
    waitCountdownLabel.textContent = `Waiting ${formatMs(duration)}`;
    waitCountdownTime.textContent = formatMs(duration);
    waitCountdownFill.style.width = '100%';
    waitCountdownFill.style.transition = 'none';
    waitCountdown.classList.remove('hidden');
}
/**
 * Update wait countdown with remaining time
 */
function updateWaitCountdown(duration, remaining, paused) {
    currentWait = { active: true, duration, remaining, paused };
    if (!waitCountdown)
        return;
    if (remaining <= 0 && !paused) {
        hideWaitCountdown();
        return;
    }
    const pct = (remaining / duration) * 100;
    waitCountdownFill.style.transition = paused ? 'none' : 'width 60ms linear';
    waitCountdownFill.style.width = `${pct}%`;
    waitCountdownTime.textContent = paused ? `${formatMs(remaining)} (paused)` : formatMs(remaining);
}
/**
 * Hide wait countdown
 */
function hideWaitCountdown() {
    currentWait = { active: false, duration: 0, remaining: 0, paused: false };
    if (waitCountdown) {
        waitCountdown.classList.add('hidden');
    }
}

// ===== execution-schedule.ts =====
/**
 * Format milliseconds for display
 */
function formatMs(ms) {
    if (ms >= 1000) {
        return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${Math.round(ms)}ms`;
}
/**
 * Set a scheduled stop time from a time string (HH:MM)
 */
function setScheduledStop(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);
    // If the time is in the past, assume tomorrow
    if (target <= now) {
        target.setDate(target.getDate() + 1);
    }
    scheduledStopTime = target;
    // Capture selected follow-up workflow
    const followUpSelect = document.getElementById('scheduled-stop-workflow');
    scheduledFollowUpWorkflowId = followUpSelect?.value || null;
    // Show active state, hide input controls
    const controls = document.getElementById('scheduled-stop-controls');
    const active = document.getElementById('scheduled-stop-active');
    const thenSection = document.getElementById('scheduled-stop-then');
    if (controls)
        controls.classList.add('hidden');
    if (thenSection)
        thenSection.classList.add('hidden');
    if (active)
        active.classList.remove('hidden');
    // Show follow-up info in active area
    const thenInfo = document.getElementById('scheduled-stop-then-info');
    if (thenInfo && scheduledFollowUpWorkflowId) {
        const opt = followUpSelect?.querySelector(`option[value="${scheduledFollowUpWorkflowId}"]`);
        thenInfo.textContent = `Then run: ${opt?.textContent || scheduledFollowUpWorkflowId}`;
    }
    else if (thenInfo) {
        thenInfo.textContent = '';
    }
    // Start the countdown interval
    updateScheduledStopDisplay();
    if (scheduledStopInterval)
        clearInterval(scheduledStopInterval);
    scheduledStopInterval = setInterval(updateScheduledStopDisplay, 1000);
}
/**
 * Clear the scheduled stop
 */
function clearScheduledStop() {
    scheduledStopTime = null;
    scheduledFollowUpWorkflowId = null;
    if (scheduledStopInterval) {
        clearInterval(scheduledStopInterval);
        scheduledStopInterval = null;
    }
    // Reset UI
    const controls = document.getElementById('scheduled-stop-controls');
    const active = document.getElementById('scheduled-stop-active');
    const thenSection = document.getElementById('scheduled-stop-then');
    if (controls)
        controls.classList.remove('hidden');
    if (thenSection)
        thenSection.classList.remove('hidden');
    if (active)
        active.classList.add('hidden');
    const thenInfo = document.getElementById('scheduled-stop-then-info');
    if (thenInfo)
        thenInfo.textContent = '';
    // Clear floating bar stop timer
    window.workflowAPI.updateFloatingBarStopTimer({ visible: false });
}
/**
 * Update the scheduled stop countdown display and auto-stop if time reached
 */
function updateScheduledStopDisplay() {
    if (!scheduledStopTime)
        return;
    const now = new Date();
    const remaining = scheduledStopTime - now;
    if (remaining <= 0) {
        // Time reached — stop execution and optionally run follow-up
        const followUpId = scheduledFollowUpWorkflowId;
        stopExecution();
        if (followUpId) {
            runFollowUpWorkflow(followUpId);
        }
        return;
    }
    const countdownStr = formatCountdown(remaining);
    const targetStr = scheduledStopTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    // Ensure active countdown is visible
    const controls = document.getElementById('scheduled-stop-controls');
    const active = document.getElementById('scheduled-stop-active');
    if (controls)
        controls.classList.add('hidden');
    if (active)
        active.classList.remove('hidden');
    // Update overlay countdown
    const countdownEl = document.getElementById('scheduled-stop-countdown');
    if (countdownEl) {
        countdownEl.innerHTML = `<span class="stop-countdown-value">${countdownStr}</span> <span class="stop-target-time">until ${targetStr}</span>`;
    }
    // Update floating bar native window
    window.workflowAPI.updateFloatingBarStopTimer({
        visible: true,
        text: `\u23F1 ${countdownStr}`
    });
}
/**
 * Format a duration in ms to a human-readable countdown string
 */
function formatCountdown(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
    }
    if (minutes > 0) {
        return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
    }
    return `${seconds}s`;
}
/**
 * Populate the follow-up workflow dropdown with all available workflows
 */
async function populateFollowUpWorkflows() {
    const select = document.getElementById('scheduled-stop-workflow');
    if (!select)
        return;
    const currentId = currentExecution.workflow?.id;
    try {
        const workflows = await window.workflowAPI.getWorkflows();
        select.innerHTML = '<option value="">— None —</option>';
        (workflows || []).forEach(w => {
            if (w.id === currentId)
                return; // exclude the currently running workflow
            const opt = document.createElement('option');
            opt.value = w.id;
            opt.textContent = w.name || w.id;
            select.appendChild(opt);
        });
    }
    catch (e) {
        console.error('Failed to load workflows for follow-up selector:', e);
    }
}
/**
 * Run a follow-up workflow after a scheduled stop
 */
async function runFollowUpWorkflow(workflowId) {
    try {
        const workflow = await window.workflowAPI.getWorkflow(workflowId);
        if (!workflow) {
            showToast('error', 'Error', 'Follow-up workflow not found');
            return;
        }
        // Small delay to let the previous execution fully clean up
        await new Promise(r => setTimeout(r, 500));
        const result = await window.workflowAPI.executeWorkflow(workflow);
        if (result.success) {
            showExecutionOverlay(workflow);
        }
        else {
            showToast('error', 'Error', result.error || 'Failed to start follow-up workflow');
        }
    }
    catch (e) {
        console.error('Failed to run follow-up workflow:', e);
        showToast('error', 'Error', 'Failed to start follow-up workflow');
    }
}

// ===== quick-record-core.ts =====
/**
 * Quick Record Mode
 *
 * Power-user feature for rapidly adding mouse actions by clicking on screen.
 *
 * Modes:
 * - move: Add mouse move action only
 * - click: Add mouse click action only
 * - move+click: Add mouse move followed by click (most common)
 *
 * Keyboard shortcuts during recording:
 * - 1 or M: Switch to Move mode
 * - 2 or C: Switch to Click mode
 * - 3 or B: Switch to Move+Click (Both) mode
 * - ESC: Exit recording mode
 */
let isRecording = false;
let recordMode = 'move+click'; // 'move', 'click', 'move+click'
let recordButton = null;
let actionsAdded = 0;
let positionUnsubscribe = null;
let nestedTarget = null; // For recording into conditional/loop branches
/**
 * Initialize Quick Record Mode
 */
function initQuickRecord() {
    recordButton = document.getElementById('btn-quick-record');
    if (recordButton) {
        recordButton.addEventListener('click', toggleQuickRecord);
    }
    // Global keyboard shortcut to start recording
    document.addEventListener('keydown', handleGlobalKeydown);
    // Subscribe to position events from main process
    positionUnsubscribe = window.workflowAPI.onQuickRecordPosition((data) => {
        handleQuickRecordPosition(data);
    });
}
/**
 * Handle global keydown for quick record shortcuts
 */
function handleGlobalKeydown(e) {
    // R key to toggle record mode (when not in an input)
    if (e.key.toLowerCase() === 'r' && !isInputFocused()) {
        e.preventDefault();
        toggleQuickRecord();
    }
}
/**
 * Check if an input element is focused
 */
function isInputFocused() {
    const active = document.activeElement;
    return active && (active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.tagName === 'SELECT' ||
        active.isContentEditable);
}
/**
 * Toggle Quick Record Mode
 */
async function toggleQuickRecord() {
    if (!state.currentWorkflow) {
        showToast('warning', 'No Workflow', 'Open a workflow first');
        return;
    }
    if (isRecording) {
        stopQuickRecord();
    }
    else {
        await startQuickRecord();
    }
}
/**
 * Start Quick Record Mode
 */
async function startQuickRecord() {
    isRecording = true;
    actionsAdded = 0;
    recordButton.classList.add('recording');
    showToast('info', 'Quick Record', 'Click anywhere on screen to add actions. Press ESC to stop.');
    // Open the recording overlay
    try {
        const result = await window.workflowAPI.startQuickRecord({
            mode: recordMode
        });
        // Recording was stopped (promise resolves when overlay closes)
        finishQuickRecord();
    }
    catch (error) {
        console.error('Quick record error:', error);
        finishQuickRecord();
    }
}
/**
 * Stop Quick Record Mode (called by user)
 */
function stopQuickRecord() {
    window.workflowAPI.stopQuickRecord?.();
    finishQuickRecord();
}
/**
 * Start Quick Record for nested actions (conditional/loop branches)
 */
async function startForNested(parentAction, actionsKey, parentIndex, title) {
    nestedTarget = { parentAction, actionsKey, parentIndex, title };
    isRecording = true;
    actionsAdded = 0;
    recordButton?.classList.add('recording');
    showToast('info', 'Quick Record', `Recording into "${title}". Click anywhere, press ESC to stop.`);
    try {
        const result = await window.workflowAPI.startQuickRecord({
            mode: recordMode
        });
        finishQuickRecord();
    }
    catch (error) {
        console.error('Quick record error:', error);
        finishQuickRecord();
    }
}
/**
 * Finish recording and update UI
 */
function finishQuickRecord() {
    if (!isRecording)
        return;
    isRecording = false;
    recordButton?.classList.remove('recording');
    const wasNested = nestedTarget !== null;
    const nestedTitle = nestedTarget?.title;
    if (actionsAdded > 0) {
        if (wasNested) {
            showToast('success', 'Recording Complete', `Added ${actionsAdded} action${actionsAdded !== 1 ? 's' : ''} to "${nestedTitle}"`);
            // Update config panel counts and reopen the nested editor
            const { parentAction, actionsKey, title, parentIndex } = nestedTarget;
            // Update the count display in config panel
            if (typeof updateNestedActionCounts === 'function') {
                updateNestedActionCounts(parentAction, actionsKey);
            }
            setTimeout(() => {
                if (typeof openNestedActionsEditor === 'function') {
                    openNestedActionsEditor(parentAction, actionsKey, title, parentIndex);
                }
            }, 100);
        }
        else {
            showToast('success', 'Recording Complete', `Added ${actionsAdded} action${actionsAdded !== 1 ? 's' : ''}`);
        }
    }
    nestedTarget = null;
}

// ===== quick-record-actions.ts =====
/**
 * Handle position captured during quick record
 */
function handleQuickRecordPosition(data) {
    if (!state.currentWorkflow)
        return;
    const position = { x: data.x, y: data.y };
    const sequence = data.sequence || ['move', 'click'];
    // Determine target array for actions
    let targetArray;
    if (nestedTarget) {
        nestedTarget.parentAction[nestedTarget.actionsKey] = nestedTarget.parentAction[nestedTarget.actionsKey] || [];
        targetArray = nestedTarget.parentAction[nestedTarget.actionsKey];
    }
    else {
        targetArray = state.currentWorkflow.actions;
    }
    // Add each action in the sequence
    for (const actionType of sequence) {
        let action;
        switch (actionType) {
            case 'move':
                action = {
                    id: generateId(),
                    type: 'mouse_move',
                    x: position.x,
                    y: position.y
                };
                break;
            case 'click':
                action = {
                    id: generateId(),
                    type: 'mouse_click',
                    button: 'left',
                    clickType: 'single'
                };
                break;
            case 'double':
                action = {
                    id: generateId(),
                    type: 'mouse_click',
                    button: 'left',
                    clickType: 'double'
                };
                break;
            case 'right':
                action = {
                    id: generateId(),
                    type: 'mouse_click',
                    button: 'right',
                    clickType: 'single'
                };
                break;
            case 'delay':
                action = {
                    id: generateId(),
                    type: 'wait',
                    duration: { min: 100, max: 100 }
                };
                break;
            default:
                continue;
        }
        if (action) {
            targetArray.push(action);
            actionsAdded++;
        }
    }
    // Update the parent action if recording to nested target
    if (nestedTarget) {
        updateAction(nestedTarget.parentIndex, nestedTarget.parentAction);
    }
    markDirty();
    renderActionSequence();
    saveCurrentWorkflow();
}
/**
 * Set the recording mode
 */
function setRecordMode(mode) {
    if (['move', 'click', 'move+click'].includes(mode)) {
        recordMode = mode;
        // Update UI if recording
        if (isRecording) {
            window.workflowAPI.updateQuickRecordMode?.(mode);
        }
    }
}
/**
 * Get current recording state
 */
function getQuickRecordState() {
    return {
        isRecording,
        recordMode,
        actionsAdded
    };
}
// Export for use in other modules
window.quickRecord = {
    init: initQuickRecord,
    toggle: toggleQuickRecord,
    start: startQuickRecord,
    startForNested: startForNested,
    stop: stopQuickRecord,
    handlePosition: handleQuickRecordPosition,
    setMode: setRecordMode,
    getState: getQuickRecordState
};
