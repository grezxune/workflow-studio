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
  if (!recentRunContainer && !recentAddedContainer) return;

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
  } catch (error) {
    console.error('Failed to load recent workflows:', error);
  }
}

function renderRecentWorkflowList(container, workflows, emptyMessage, metaFormatter) {
  if (!container) return;

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
  if (!window.workflowAPI?.importExecutionHistory) return;

  try {
    const stored = localStorage.getItem('workflow-execution-history');
    if (!stored) return;

    const existing = await window.workflowAPI.getExecutionHistory({ limit: 1 });
    if (Array.isArray(existing) && existing.length > 0) return; // store already populated

    const legacyHistory = JSON.parse(stored);
    if (!Array.isArray(legacyHistory) || legacyHistory.length === 0) return;

    const result = await window.workflowAPI.importExecutionHistory(legacyHistory);
    if (result?.success) {
      localStorage.removeItem('workflow-execution-history');
    }
  } catch (error) {
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
