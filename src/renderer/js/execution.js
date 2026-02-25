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
  } else {
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
  if (!waitCountdown) return;
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
  if (!waitCountdown) return;
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
  if (controls) controls.classList.add('hidden');
  if (thenSection) thenSection.classList.add('hidden');
  if (active) active.classList.remove('hidden');

  // Show follow-up info in active area
  const thenInfo = document.getElementById('scheduled-stop-then-info');
  if (thenInfo && scheduledFollowUpWorkflowId) {
    const opt = followUpSelect?.querySelector(`option[value="${scheduledFollowUpWorkflowId}"]`);
    thenInfo.textContent = `Then run: ${opt?.textContent || scheduledFollowUpWorkflowId}`;
  } else if (thenInfo) {
    thenInfo.textContent = '';
  }

  // Start the countdown interval
  updateScheduledStopDisplay();
  if (scheduledStopInterval) clearInterval(scheduledStopInterval);
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
  if (controls) controls.classList.remove('hidden');
  if (thenSection) thenSection.classList.remove('hidden');
  if (active) active.classList.add('hidden');

  const thenInfo = document.getElementById('scheduled-stop-then-info');
  if (thenInfo) thenInfo.textContent = '';

  // Clear floating bar stop timer
  window.workflowAPI.updateFloatingBarStopTimer({ visible: false });
}

/**
 * Update the scheduled stop countdown display and auto-stop if time reached
 */
function updateScheduledStopDisplay() {
  if (!scheduledStopTime) return;

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
  if (controls) controls.classList.add('hidden');
  if (active) active.classList.remove('hidden');

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
  if (!select) return;

  const currentId = currentExecution.workflow?.id;

  try {
    const workflows = await window.workflowAPI.getWorkflows();
    select.innerHTML = '<option value="">— None —</option>';
    (workflows || []).forEach(w => {
      if (w.id === currentId) return; // exclude the currently running workflow
      const opt = document.createElement('option');
      opt.value = w.id;
      opt.textContent = w.name || w.id;
      select.appendChild(opt);
    });
  } catch (e) {
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
    } else {
      showToast('error', 'Error', result.error || 'Failed to start follow-up workflow');
    }
  } catch (e) {
    console.error('Failed to run follow-up workflow:', e);
    showToast('error', 'Error', 'Failed to start follow-up workflow');
  }
}
