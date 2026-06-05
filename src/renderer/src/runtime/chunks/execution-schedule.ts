/* Execution — scheduled-stop (random range) + max-run-time + follow-up (ported from WIP). Shares the execution runtime global scope. */

function formatMs(ms) {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.round(ms)}ms`;
}

/**
 * Resolve a clock-time range (HH:MM strings) into one concrete stop time.
 *
 * - Only `from` given → exact stop at that time.
 * - `from`–`to` given → a random moment within the window.
 * Handles ranges that cross midnight and windows that have already elapsed
 * (rolled to tomorrow), and never picks a moment that is already in the past.
 */
function computeRandomStopTime(fromStr, toStr) {
  const now = new Date();
  const atToday = (str) => {
    const [h, m] = str.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  const from = atToday(fromStr);

  if (!toStr) {
    if (from <= now) from.setDate(from.getDate() + 1);
    return { target: from, rangeLabel: `at ${formatClock(from)}` };
  }

  const to = atToday(toStr);
  if (to <= from) to.setDate(to.getDate() + 1); // crosses midnight
  if (to <= now) { // whole window already passed → tomorrow
    from.setDate(from.getDate() + 1);
    to.setDate(to.getDate() + 1);
  }

  const lower = Math.max(from.getTime(), now.getTime()); // don't pick the past
  const upper = Math.max(to.getTime(), lower);
  const target = new Date(lower + Math.random() * (upper - lower));
  return { target, rangeLabel: `between ${formatClock(from)} and ${formatClock(to)}` };
}

/**
 * Arm a scheduled stop from a clock-time range.
 * @param {{from: string, to?: string, followUpId?: string|null}} opts
 */
function setScheduledStop({ from, to = '', followUpId } = {}) {
  if (!from) return;

  const { target, rangeLabel } = computeRandomStopTime(from, to);

  // Follow-up workflow: honour an explicit id, else read the overlay select.
  const followUpSelect = document.getElementById('scheduled-stop-workflow');
  const resolvedFollowUp = followUpId !== undefined ? followUpId : (followUpSelect?.value || null);

  // Reflect the range that was used back into the inputs (e.g. when armed from the bar).
  const fromInput = document.getElementById('scheduled-stop-from');
  const toInput = document.getElementById('scheduled-stop-to');
  if (fromInput) fromInput.value = from;
  if (toInput) toInput.value = to;

  armScheduledStopAt(target, {
    rangeLabel,
    followUpId: resolvedFollowUp,
    pickedText: to ? `Picked ${rangeLabel}` : ''
  });
}

/**
 * Arm the auto-stop for a concrete target time and start the countdown.
 * Shared by the clock-range scheduler and the max-run-time fallback.
 * @param {Date} target
 * @param {{rangeLabel?: string, followUpId?: string|null, pickedText?: string}} opts
 */
function armScheduledStopAt(target, { rangeLabel = '', followUpId = null, pickedText = '' } = {}) {
  scheduledStopTime = target;
  scheduledStopSetAt = new Date();
  scheduledStopRangeLabel = rangeLabel;
  scheduledFollowUpWorkflowId = followUpId;

  // Show active state, hide input controls
  const controls = document.getElementById('scheduled-stop-controls');
  const active = document.getElementById('scheduled-stop-active');
  const thenSection = document.getElementById('scheduled-stop-then');
  if (controls) controls.classList.add('hidden');
  if (thenSection) thenSection.classList.add('hidden');
  if (active) active.classList.remove('hidden');

  // Show which window the time was drawn from
  const picked = document.getElementById('scheduled-stop-picked');
  if (picked) picked.textContent = pickedText;

  // Show follow-up info in active area
  const thenInfo = document.getElementById('scheduled-stop-then-info');
  if (thenInfo && scheduledFollowUpWorkflowId) {
    const followUpSelect = document.getElementById('scheduled-stop-workflow');
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
 * When the user hasn't scheduled their own stop, fall back to the global
 * "Max run time" setting: stop the run after the configured length, randomised
 * by ±30 minutes so runs don't all end at exactly the same elapsed time.
 */
function armMaxRunTimeStop() {
  const cfg = state.settings?.maxRunTime;
  // Canonical milliseconds, with a fallback for any legacy minutes-based value.
  const baseMs = Number(cfg?.ms ?? (cfg?.minutes != null ? cfg.minutes * 60 * 1000 : NaN));
  if (!cfg?.enabled || !Number.isFinite(baseMs) || baseMs <= 0) return;

  const JITTER_MS = 30 * 60 * 1000; // ±30 min
  const cappedMs = Math.max(60 * 1000, baseMs + (Math.random() * 2 - 1) * JITTER_MS);
  const target = new Date(Date.now() + cappedMs);

  armScheduledStopAt(target, {
    rangeLabel: 'max run time',
    pickedText: `Max run time — about ${Math.round(baseMs / 60000)} min ±30 min`
  });
}

/**
 * Build the rich stop-timer payload pushed to the floating bar.
 */
function buildStopTimerPayload() {
  if (!scheduledStopTime) return { visible: false };
  const remaining = scheduledStopTime - new Date();
  if (remaining <= 0) return { visible: false };
  const span = scheduledStopSetAt ? (scheduledStopTime - scheduledStopSetAt) : remaining;
  const countdown = formatCountdown(remaining);
  return {
    visible: true,
    targetLabel: formatClock(scheduledStopTime),
    countdown,
    remaining,
    fraction: span > 0 ? Math.max(0, Math.min(1, remaining / span)) : 0,
    rangeLabel: scheduledStopRangeLabel,
    text: `⏱ ${countdown}` // legacy fallback
  };
}

/**
 * Format a Date as a short clock time, e.g. "3:27 PM".
 */
function formatClock(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Clear the scheduled stop
 */
function clearScheduledStop() {
  scheduledStopTime = null;
  scheduledStopSetAt = null;
  scheduledStopRangeLabel = '';
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
  const picked = document.getElementById('scheduled-stop-picked');
  if (picked) picked.textContent = '';

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
  const targetStr = formatClock(scheduledStopTime);

  // Ensure active countdown is visible
  const controls = document.getElementById('scheduled-stop-controls');
  const active = document.getElementById('scheduled-stop-active');
  if (controls) controls.classList.add('hidden');
  if (active) active.classList.remove('hidden');

  // Update overlay countdown
  const countdownEl = document.getElementById('scheduled-stop-countdown');
  if (countdownEl) {
    countdownEl.innerHTML = `<span class="stop-countdown-value">${countdownStr}</span> <span class="stop-target-time">until ${escapeHtml(targetStr)}</span>`;
  }

  // Update floating bar native window
  window.workflowAPI.updateFloatingBarStopTimer(buildStopTimerPayload());
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

function submitScheduledStopFromInputs() {
  const from = document.getElementById('scheduled-stop-from')?.value;
  const to = document.getElementById('scheduled-stop-to')?.value;
  if (!from && !to) return;
  const followUpSelect = document.getElementById('scheduled-stop-workflow');
  setScheduledStop({ from: from || to, to: (from && to) ? to : '', followUpId: followUpSelect?.value || null });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initExecutionUI);

/**
 * Show execution overlay
 */
