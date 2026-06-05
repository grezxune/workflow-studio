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
  completeAnalyticsLiveExecution('completed');
  addToExecutionHistory();
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
