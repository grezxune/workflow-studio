/**
 * Handle position captured during quick record
 */
function handleQuickRecordPosition(data) {
  if (!state.currentWorkflow) return;
  
  const position = { x: data.x, y: data.y };
  const sequence = data.sequence || ['move', 'click'];
  
  // Determine target array for actions
  let targetArray;
  if (nestedTarget) {
    nestedTarget.parentAction[nestedTarget.actionsKey] = nestedTarget.parentAction[nestedTarget.actionsKey] || [];
    targetArray = nestedTarget.parentAction[nestedTarget.actionsKey];
  } else {
    targetArray = state.currentWorkflow.actions;
  }
  
  // Add each action in the sequence
  for (const actionType of sequence) {
    let action;
    
    switch (actionType) {
      case 'move':
        action = {
          id: generateId(),
          type: 'mouse_move',
          x: position.x,
          y: position.y
        };
        break;
        
      case 'click':
        action = {
          id: generateId(),
          type: 'mouse_click',
          button: 'left',
          clickType: 'single'
        };
        break;
        
      case 'double':
        action = {
          id: generateId(),
          type: 'mouse_click',
          button: 'left',
          clickType: 'double'
        };
        break;
        
      case 'right':
        action = {
          id: generateId(),
          type: 'mouse_click',
          button: 'right',
          clickType: 'single'
        };
        break;
        
      case 'delay':
        action = {
          id: generateId(),
          type: 'wait',
          duration: { min: 100, max: 100 }
        };
        break;
        
      default:
        continue;
    }
    
    if (action) {
      targetArray.push(action);
      actionsAdded++;
    }
  }
  
  // Update the parent action if recording to nested target
  if (nestedTarget) {
    updateAction(nestedTarget.parentIndex, nestedTarget.parentAction);
  }
  
  markDirty();
  renderActionSequence();
  saveCurrentWorkflow();
}

/**
 * Set the recording mode
 */
function setRecordMode(mode) {
  if (['move', 'click', 'move+click'].includes(mode)) {
    recordMode = mode;
    
    // Update UI if recording
    if (isRecording) {
      window.workflowAPI.updateQuickRecordMode?.(mode);
    }
  }
}

/**
 * Get current recording state
 */
function getQuickRecordState() {
  return {
    isRecording,
    recordMode,
    actionsAdded
  };
}

// Export for use in other modules
window.quickRecord = {
  init: initQuickRecord,
  toggle: toggleQuickRecord,
  start: startQuickRecord,
  startForNested: startForNested,
  stop: stopQuickRecord,
  handlePosition: handleQuickRecordPosition,
  setMode: setRecordMode,
  getState: getQuickRecordState
};
