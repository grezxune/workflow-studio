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
      if (!val) return;
      setScheduledStop(val);
    });
  }

  if (stopTimeInput) {
    stopTimeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = stopTimeInput.value;
        if (val) setScheduledStop(val);
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
  if (stopLabel) stopLabel.textContent = state.settings?.panicHotkey || 'F7';

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

/**
