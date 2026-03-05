/**
 * Update an action and save
 */
function updateAction(index, action) {
  if (!state.currentWorkflow) return;

  state.currentWorkflow.actions[index] = action;
  markDirty();
  renderActionSequence();
  saveCurrentWorkflow();
}

/**
 * Render Conditional action config
 */
