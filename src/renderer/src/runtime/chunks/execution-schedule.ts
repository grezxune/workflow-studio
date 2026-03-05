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
