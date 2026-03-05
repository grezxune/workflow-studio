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

