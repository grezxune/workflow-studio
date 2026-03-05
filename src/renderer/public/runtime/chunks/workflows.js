/**
 * Workflow Studio - Workflows View
 *
 * Handles workflow list display and management
 */

let workflowGrid = null;
let emptyWorkflows = null;
let recentContainer = null;
let historyList = null;

// Execution history storage
let executionHistory = [];
const MAX_HISTORY = 50;

/**
 * Initialize workflows view
 */
function initWorkflowsView() {
  workflowGrid = document.getElementById('workflow-grid');
  emptyWorkflows = document.getElementById('empty-workflows');
  recentContainer = document.getElementById('recent-workflows-list');
  historyList = document.getElementById('history-list');

  // New workflow buttons
  document.getElementById('btn-new-workflow').addEventListener('click', createNewWorkflow);
  document.getElementById('btn-new-workflow-empty')?.addEventListener('click', createNewWorkflow);

  // Import/Export buttons
  document.getElementById('btn-import-workflow')?.addEventListener('click', importWorkflow);
  document.getElementById('btn-export-all')?.addEventListener('click', exportAllWorkflows);

  // Load execution history from storage
  loadExecutionHistory();
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
  if (countEl) countEl.textContent = state.workflows.length > 0 ? state.workflows.length : '';
  if (sectionHeader) sectionHeader.classList.toggle('hidden', state.workflows.length === 0);

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
    if (e.target.closest('[data-action]')) return;
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
  } catch (error) {
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
  } catch (error) {
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
      } catch (err) {
        console.warn('Could not check permissions:', err);
      }
    }

    const result = await window.workflowAPI.executeWorkflow(workflow);

    if (!result.success) {
      if (result.error && result.error.includes('Accessibility permission')) {
        showAccessibilityPermissionModal();
      } else {
        showToast('error', 'Error', result.error || 'Failed to start workflow');
      }
    }
  } catch (error) {
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
  } catch (error) {
    console.error('Failed to duplicate workflow:', error);
    showToast('error', 'Error', 'Failed to duplicate workflow');
  }
}

/**
 * Confirm and delete a workflow
 */
function confirmDeleteWorkflow(workflow) {
  showConfirm(
    'Delete Workflow',
    `Are you sure you want to delete "${escapeHtml(workflow.name)}"? This cannot be undone.`,
    () => deleteWorkflow(workflow.id)
  );
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
  } catch (error) {
    console.error('Failed to delete workflow:', error);
    showToast('error', 'Error', 'Failed to delete workflow');
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
  if (!str) return '';
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    console.error('Failed to export workflows:', error);
    showToast('error', 'Error', 'Failed to export workflows');
  }
}

/**
 * Render recent workflows
 */
async function renderRecentWorkflows() {
  if (!recentContainer) return;

  try {
    const recent = await window.workflowAPI.getRecentWorkflows();

    if (!recent || recent.length === 0) {
      recentContainer.innerHTML = '<p style="color: var(--text-tertiary); font-size: var(--text-sm);">No recent workflows</p>';
      return;
    }

    recentContainer.innerHTML = recent.slice(0, 5).map(workflow => `
      <div class="recent-item" data-id="${workflow.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>${escapeHtml(workflow.name)}</span>
      </div>
    `).join('');

    // Add click handlers
    recentContainer.querySelectorAll('.recent-item').forEach(item => {
      item.addEventListener('click', () => {
        openWorkflowInEditor(item.dataset.id);
      });
    });
  } catch (error) {
    console.error('Failed to load recent workflows:', error);
  }
}

/**
 * Load execution history from localStorage
 */
function loadExecutionHistory() {
  try {
    const stored = localStorage.getItem('workflow-execution-history');
    if (stored) {
      executionHistory = JSON.parse(stored);
    }
  } catch (e) {
    executionHistory = [];
  }
  renderExecutionHistory();
}

/**
 * Save execution history to localStorage
 */
function saveExecutionHistory() {
  try {
    localStorage.setItem('workflow-execution-history', JSON.stringify(executionHistory.slice(0, MAX_HISTORY)));
  } catch (e) {
    console.error('Failed to save execution history:', e);
  }
}

/**
 * Add entry to execution history
 */
function addToExecutionHistory(entry) {
  executionHistory.unshift({
    ...entry,
    timestamp: new Date().toISOString()
  });
  executionHistory = executionHistory.slice(0, MAX_HISTORY);
  saveExecutionHistory();
  renderExecutionHistory();
}

/**
 * Render execution history panel
 */
function renderExecutionHistory() {
  if (!historyList) return;

  if (executionHistory.length === 0) {
    historyList.innerHTML = '';
    return;
  }

  historyList.innerHTML = executionHistory.slice(0, 10).map(entry => `
    <div class="history-item">
      <div class="history-status ${entry.status}"></div>
      <div class="history-info">
        <div class="history-name">${escapeHtml(entry.workflowName)}</div>
        <div class="history-meta">
          ${formatTimeAgo(entry.timestamp)} - ${entry.loops || 1} loop${entry.loops !== 1 ? 's' : ''}, ${entry.actions || 0} actions
        </div>
      </div>
    </div>
  `).join('');
}

/**
 * Clear execution history
 */
function clearExecutionHistory() {
  executionHistory = [];
  saveExecutionHistory();
  renderExecutionHistory();
  showToast('info', 'Cleared', 'Execution history cleared');
}

/**
 * Format time ago
 */
function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
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
  } else {
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

  showModal(
    'Assign Hotkey',
    `
      <p style="margin-bottom: var(--space-4)">Assign a hotkey to run <strong>${escapeHtml(workflow.name)}</strong></p>
      <div class="config-field">
        <label>Hotkey</label>
        <select id="hotkey-select">
          <option value="">None</option>
          ${hotkeys.map(hk => `<option value="${hk}" ${currentHotkey === hk ? 'selected' : ''}>${hk}</option>`).join('')}
        </select>
        <p class="config-field-hint">Note: F7 is reserved for panic stop</p>
      </div>
    `,
    [
      { label: 'Cancel', action: 'close' },
      { label: 'Save', primary: true, action: () => {
        const hotkey = document.getElementById('hotkey-select').value;
        setupWorkflowHotkey(workflow.id, hotkey);
        closeModal();
      }}
    ]
  );
}
