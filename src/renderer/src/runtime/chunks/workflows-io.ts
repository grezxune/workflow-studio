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

