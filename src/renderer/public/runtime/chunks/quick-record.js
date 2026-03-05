/**
 * Quick Record Mode
 * 
 * Power-user feature for rapidly adding mouse actions by clicking on screen.
 * 
 * Modes:
 * - move: Add mouse move action only
 * - click: Add mouse click action only  
 * - move+click: Add mouse move followed by click (most common)
 * 
 * Keyboard shortcuts during recording:
 * - 1 or M: Switch to Move mode
 * - 2 or C: Switch to Click mode
 * - 3 or B: Switch to Move+Click (Both) mode
 * - ESC: Exit recording mode
 */

let isRecording = false;
let recordMode = 'move+click'; // 'move', 'click', 'move+click'
let recordButton = null;
let actionsAdded = 0;
let positionUnsubscribe = null;
let nestedTarget = null; // For recording into conditional/loop branches

/**
 * Initialize Quick Record Mode
 */
function initQuickRecord() {
  recordButton = document.getElementById('btn-quick-record');
  
  if (recordButton) {
    recordButton.addEventListener('click', toggleQuickRecord);
  }
  
  // Global keyboard shortcut to start recording
  document.addEventListener('keydown', handleGlobalKeydown);
  
  // Subscribe to position events from main process
  positionUnsubscribe = window.workflowAPI.onQuickRecordPosition((data) => {
    handleQuickRecordPosition(data);
  });
}

/**
 * Handle global keydown for quick record shortcuts
 */
function handleGlobalKeydown(e) {
  // R key to toggle record mode (when not in an input)
  if (e.key.toLowerCase() === 'r' && !isInputFocused()) {
    e.preventDefault();
    toggleQuickRecord();
  }
}

/**
 * Check if an input element is focused
 */
function isInputFocused() {
  const active = document.activeElement;
  return active && (
    active.tagName === 'INPUT' || 
    active.tagName === 'TEXTAREA' || 
    active.tagName === 'SELECT' ||
    active.isContentEditable
  );
}

/**
 * Toggle Quick Record Mode
 */
async function toggleQuickRecord() {
  if (!state.currentWorkflow) {
    showToast('warning', 'No Workflow', 'Open a workflow first');
    return;
  }
  
  if (isRecording) {
    stopQuickRecord();
  } else {
    await startQuickRecord();
  }
}

/**
 * Start Quick Record Mode
 */
async function startQuickRecord() {
  isRecording = true;
  actionsAdded = 0;
  recordButton.classList.add('recording');
  
  showToast('info', 'Quick Record', 'Click anywhere on screen to add actions. Press ESC to stop.');
  
  // Open the recording overlay
  try {
    const result = await window.workflowAPI.startQuickRecord({
      mode: recordMode
    });
    
    // Recording was stopped (promise resolves when overlay closes)
    finishQuickRecord();
  } catch (error) {
    console.error('Quick record error:', error);
    finishQuickRecord();
  }
}

/**
 * Stop Quick Record Mode (called by user)
 */
function stopQuickRecord() {
  window.workflowAPI.stopQuickRecord?.();
  finishQuickRecord();
}

/**
 * Start Quick Record for nested actions (conditional/loop branches)
 */
async function startForNested(parentAction, actionsKey, parentIndex, title) {
  nestedTarget = { parentAction, actionsKey, parentIndex, title };
  isRecording = true;
  actionsAdded = 0;
  recordButton?.classList.add('recording');
  
  showToast('info', 'Quick Record', `Recording into "${title}". Click anywhere, press ESC to stop.`);
  
  try {
    const result = await window.workflowAPI.startQuickRecord({
      mode: recordMode
    });
    
    finishQuickRecord();
  } catch (error) {
    console.error('Quick record error:', error);
    finishQuickRecord();
  }
}

/**
 * Finish recording and update UI
 */
function finishQuickRecord() {
  if (!isRecording) return;
  
  isRecording = false;
  recordButton?.classList.remove('recording');
  
  const wasNested = nestedTarget !== null;
  const nestedTitle = nestedTarget?.title;
  
  if (actionsAdded > 0) {
    if (wasNested) {
      showToast('success', 'Recording Complete', `Added ${actionsAdded} action${actionsAdded !== 1 ? 's' : ''} to "${nestedTitle}"`);
      // Update config panel counts and reopen the nested editor
      const { parentAction, actionsKey, title, parentIndex } = nestedTarget;
      
      // Update the count display in config panel
      if (typeof updateNestedActionCounts === 'function') {
        updateNestedActionCounts(parentAction, actionsKey);
      }
      
      setTimeout(() => {
        if (typeof openNestedActionsEditor === 'function') {
          openNestedActionsEditor(parentAction, actionsKey, title, parentIndex);
        }
      }, 100);
    } else {
      showToast('success', 'Recording Complete', `Added ${actionsAdded} action${actionsAdded !== 1 ? 's' : ''}`);
    }
  }
  
  nestedTarget = null;
}

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
