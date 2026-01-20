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

// Execution state
let currentExecution = {
  workflow: null,
  totalLoops: 1,
  currentLoop: 0,
  totalActions: 0,
  currentAction: 0,
  isPaused: false
};

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

  // Setup button listeners
  btnPauseExecution.addEventListener('click', togglePause);
  btnStopExecution.addEventListener('click', stopExecution);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initExecutionUI);

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

  // Reset pause button
  currentExecution.isPaused = false;
  btnPauseExecution.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="6" y="4" width="4" height="16"/>
      <rect x="14" y="4" width="4" height="16"/>
    </svg>
    Pause
  `;

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
  const actionName = actionType?.name || action.type;
  executionAction.textContent = `${actionName}: ${getActionSummary(action)}`;

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
    btnPauseExecution.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="6" y="4" width="4" height="16"/>
        <rect x="14" y="4" width="4" height="16"/>
      </svg>
      Pause
    `;
    executionAction.textContent = 'Resuming...';
  } else {
    await window.workflowAPI.pauseExecution();
    currentExecution.isPaused = true;
    btnPauseExecution.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
      Resume
    `;
    executionAction.textContent = 'Paused';
  }
}

/**
 * Stop execution
 */
async function stopExecution() {
  await window.workflowAPI.emergencyStop();
  hideExecutionOverlay();
}
