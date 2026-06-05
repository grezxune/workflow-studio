function setupIPCListeners() {
  // Track current execution for history
  let currentExecution = null;

  // Execution events
  window.workflowAPI.onExecutionStarted((data) => {
    updateExecutionState('running');
    showExecutionOverlay(data.workflow);
    const startTime = Date.now();
    currentExecution = {
      workflowName: data.workflow?.name || 'Unknown',
      workflowId: data.workflow?.id,
      loopsConfigured: data.totalLoops || 1,
      actions: data.workflow?.actions?.length || 0,
      dryRun: !!data.dryRun,
      startTime,
      startedAt: new Date(startTime).toISOString()
    };
    setAnalyticsLiveExecution(currentExecution, 'running');
  });

  window.workflowAPI.onExecutionCompleted((data) => {
    updateExecutionState('idle');
    hideExecutionOverlay();
    showToast('success', 'Complete', 'Workflow execution completed');
    completeAnalyticsLiveExecution('completed');
    if (currentExecution) {
      addToExecutionHistory({
        ...currentExecution,
        status: 'completed',
        duration: Date.now() - currentExecution.startTime
      });
      currentExecution = null;
    }
    addToExecutionHistory();
  });

  window.workflowAPI.onExecutionStopped((data) => {
    updateExecutionState('idle');
    hideExecutionOverlay();
    showToast('success', 'Done', 'Workflow execution finished');
    completeAnalyticsLiveExecution('completed');
    if (currentExecution) {
      addToExecutionHistory({
        ...currentExecution,
        status: 'completed',
        duration: Date.now() - currentExecution.startTime
      });
      currentExecution = null;
    }
    addToExecutionHistory();
  });

  window.workflowAPI.onExecutionError((data) => {
    updateExecutionState('error');
    hideExecutionOverlay();
    showToast('error', 'Error', data.error || 'Execution failed');
    completeAnalyticsLiveExecution('error', { error: data.error });
    if (currentExecution) {
      addToExecutionHistory({
        ...currentExecution,
        status: 'error',
        error: data.error,
        duration: Date.now() - currentExecution.startTime
      });
      currentExecution = null;
    }
    addToExecutionHistory();
  });

  window.workflowAPI.onExecutionPaused(() => {
    updateExecutionState('paused');
    updateAnalyticsLiveExecution({ status: 'paused' });
  });

  window.workflowAPI.onExecutionResumed(() => {
    updateExecutionState('running');
    updateAnalyticsLiveExecution({ status: 'running' });
  });

  window.workflowAPI.onActionStarted((data) => {
    updateExecutionProgress(data);
    updateAnalyticsLiveExecution({ actions: currentExecution?.actions || 0 });
  });

  window.workflowAPI.onLoopStarted((data) => {
    updateLoopProgress(data);
    updateAnalyticsLiveExecution({ completedLoops: data.loop ?? data.currentLoop ?? null });
  });

  window.workflowAPI.onAudioPlay?.((data) => {
    playWorkflowSound(data);
  });

  // Listen for panic trigger
  window.workflowAPI.onPanicTriggered?.((data) => {
    updateExecutionState('idle');
    hideExecutionOverlay();
    showToast('warning', 'Emergency Stop', `Panic triggered: ${data.source}`);
    completeAnalyticsLiveExecution('completed');
    if (currentExecution) {
      addToExecutionHistory({
        ...currentExecution,
        status: 'completed',
        duration: Date.now() - currentExecution.startTime
      });
      currentExecution = null;
    }
    addToExecutionHistory();
  });

  // Auto-update events
  setupUpdateListeners();
}

/**
 * Update execution state in UI
 */
function updateExecutionState(newState) {
  state.executionState = newState;

  elements.statusDot.className = 'status-dot ' + newState;

  const labels = {
    idle: 'Idle',
    running: 'Running',
    paused: 'Paused',
    error: 'Error'
  };
  elements.statusText.textContent = labels[newState] || newState;
}

/**
 * Show a toast notification
 */
