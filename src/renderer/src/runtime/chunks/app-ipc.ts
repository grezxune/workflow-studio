function setupIPCListeners() {
  // Track current execution for history
  let currentExecution = null;

  // Execution events
  window.workflowAPI.onExecutionStarted((data) => {
    updateExecutionState('running');
    showExecutionOverlay(data.workflow);
    currentExecution = {
      workflowName: data.workflow?.name || 'Unknown',
      workflowId: data.workflow?.id,
      loops: data.totalLoops || 1,
      actions: data.workflow?.actions?.length || 0,
      startTime: Date.now()
    };
  });

  window.workflowAPI.onExecutionCompleted((data) => {
    updateExecutionState('idle');
    hideExecutionOverlay();
    showToast('success', 'Complete', 'Workflow execution completed');
    if (currentExecution) {
      addToExecutionHistory({
        ...currentExecution,
        status: 'completed',
        duration: Date.now() - currentExecution.startTime
      });
      currentExecution = null;
    }
  });

  window.workflowAPI.onExecutionStopped((data) => {
    updateExecutionState('idle');
    hideExecutionOverlay();
    showToast('warning', 'Stopped', 'Workflow execution stopped');
    if (currentExecution) {
      addToExecutionHistory({
        ...currentExecution,
        status: 'stopped',
        duration: Date.now() - currentExecution.startTime
      });
      currentExecution = null;
    }
  });

  window.workflowAPI.onExecutionError((data) => {
    updateExecutionState('error');
    hideExecutionOverlay();
    showToast('error', 'Error', data.error || 'Execution failed');
    if (currentExecution) {
      addToExecutionHistory({
        ...currentExecution,
        status: 'error',
        error: data.error,
        duration: Date.now() - currentExecution.startTime
      });
      currentExecution = null;
    }
  });

  window.workflowAPI.onExecutionPaused(() => {
    updateExecutionState('paused');
  });

  window.workflowAPI.onExecutionResumed(() => {
    updateExecutionState('running');
  });

  window.workflowAPI.onActionStarted((data) => {
    updateExecutionProgress(data);
  });

  window.workflowAPI.onLoopStarted((data) => {
    updateLoopProgress(data);
  });

  window.workflowAPI.onAudioPlay?.((data) => {
    playWorkflowSound(data);
  });

  // Listen for panic trigger
  window.workflowAPI.onPanicTriggered?.((data) => {
    updateExecutionState('idle');
    hideExecutionOverlay();
    showToast('warning', 'Emergency Stop', `Panic triggered: ${data.source}`);
    if (currentExecution) {
      addToExecutionHistory({
        ...currentExecution,
        status: 'stopped',
        duration: Date.now() - currentExecution.startTime
      });
      currentExecution = null;
    }
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
