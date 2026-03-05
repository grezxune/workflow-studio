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
