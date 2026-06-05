/**
 * Add an action to the sequence
 */
function addActionToSequence(type, index = -1) {
  if (!state.currentWorkflow) return;

  const action = createDefaultAction(type);

  if (index === -1 || index >= state.currentWorkflow.actions.length) {
    state.currentWorkflow.actions.push(action);
    index = state.currentWorkflow.actions.length - 1;
  } else {
    state.currentWorkflow.actions.splice(index, 0, action);
  }

  markDirty();
  renderActionSequence();
  saveCurrentWorkflow();

  // Open config panel for new action
  openConfigPanel(index);
}

/**
 * Create a default action of a given type
 */
function createDefaultAction(type) {
  const defaults = {
    mouse_move: { type, x: 0, y: 0 },
    mouse_click: { type, button: 'left', clickType: 'single' },
    keyboard: { type, mode: 'type', text: '', actions: [] },
    wait: { type, duration: { min: 500, max: 1000 } },
    conditional: {
      type,
      condition: { type: 'image_present' },
      elseCondition: { type: 'image_present' },
      useElseCondition: false,
      waitUntilEitherCondition: false,
      pollInterval: 500,
      thenActions: [],
      elseActions: []
    },
    loop: { type, count: 3, actions: [], delay: { min: 500, max: 1000 } },
    image_detect: { type, detectMode: 'present', imageId: null, confidence: 0.9, soundId: 'none', soundVolume: 100, soundRepeatCount: 1, speechText: '' },
    pixel_detect: { type, color: { r: 255, g: 0, b: 0 }, tolerance: 10 }
  };

  return { id: generateId(), ...defaults[type] } || { id: generateId(), type };
}

/**
 * Delete an action
 */
function deleteAction(index) {
  if (!state.currentWorkflow) return;

  state.currentWorkflow.actions.splice(index, 1);

  if (editorState.selectedActionIndex === index) {
    editorState.selectedActionIndex = -1;
    closeConfigPanel();
  } else if (editorState.selectedActionIndex > index) {
    editorState.selectedActionIndex--;
  }

  markDirty();
  renderActionSequence();
  saveCurrentWorkflow();
}

/**
 * Reorder an action
 */
function reorderAction(fromIndex, toIndex) {
  if (!state.currentWorkflow) return;

  const [action] = state.currentWorkflow.actions.splice(fromIndex, 1);
  state.currentWorkflow.actions.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, action);

  markDirty();
  renderActionSequence();
  saveCurrentWorkflow();
}

/**
 * Select an action
 */
function selectAction(index) {
  editorState.selectedActionIndex = index;
  renderActionSequence();
  openConfigPanel(index);
}

/**
 * Mark workflow as dirty (unsaved changes) and trigger debounced auto-save
 */
let _autoSaveTimer = null;
function markDirty() {
  editorState.isDirty = true;
  // Debounced auto-save: persist within 500ms of last change
  if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(() => {
    saveCurrentWorkflow();
  }, 500);
}

/**
 * Manual save triggered by button or Ctrl+S — always saves and shows feedback
 */
async function manualSaveWorkflow() {
  if (!state.currentWorkflow) return;
  try {
    await window.workflowAPI.updateWorkflow(state.currentWorkflow.id, state.currentWorkflow);
    editorState.isDirty = false;
    const index = state.workflows.findIndex(w => w.id === state.currentWorkflow.id);
    if (index !== -1) state.workflows[index] = { ...state.currentWorkflow };
    showToast('success', 'Saved', `"${state.currentWorkflow.name || 'Workflow'}" saved`);
  } catch (error) {
    console.error('Failed to save workflow:', error);
    showToast('error', 'Error', 'Failed to save workflow');
  }
}

/**
 * Save current workflow
 */
async function saveCurrentWorkflow() {
  if (!state.currentWorkflow || !editorState.isDirty) return;

  try {
    await window.workflowAPI.updateWorkflow(state.currentWorkflow.id, state.currentWorkflow);
    editorState.isDirty = false;

    // Update in state.workflows list
    const index = state.workflows.findIndex(w => w.id === state.currentWorkflow.id);
    if (index !== -1) {
      state.workflows[index] = { ...state.currentWorkflow };
    }
  } catch (error) {
    console.error('Failed to save workflow:', error);
    showToast('error', 'Error', 'Failed to save workflow');
  }
}

/**
 * Run current workflow
 */
async function runCurrentWorkflow(dryRun = false) {
  if (!state.currentWorkflow) return;

  await saveCurrentWorkflow();

  if (!state.currentWorkflow.actions || state.currentWorkflow.actions.length === 0) {
    showToast('warning', 'Empty', 'Add some actions first');
    return;
  }

  // Check permissions first (macOS)
  if (window.platform.isMac && !dryRun) {
    try {
      const status = await window.workflowAPI.getPermissionStatus();
      if (!status.accessibility) {
        showModal('Accessibility Permission Required', `
          <p>Workflow Studio needs Accessibility permission to control your mouse and keyboard.</p>
          <p>Please grant access in:</p>
          <ol style="margin: 12px 0; padding-left: 20px;">
            <li>Open System Settings</li>
            <li>Go to Privacy & Security</li>
            <li>Select Accessibility</li>
            <li>Add and enable Workflow Studio</li>
          </ol>
          <p>After granting permission, try running the workflow again.</p>
        `, [
          { label: 'Request Permission', primary: true, onClick: async () => {
            await window.workflowAPI.requestAccessibilityPermission();
          }},
          { label: 'Cancel', class: 'btn-secondary' }
        ]);
        return;
      }
    } catch (err) {
      console.warn('Could not check permissions:', err);
    }
  }

  const result = await window.workflowAPI.executeWorkflow(state.currentWorkflow, { dryRun });

  if (!result.success) {
    // Check if it's a permission error
    if (result.error && result.error.includes('Accessibility permission')) {
      showToast('error', 'Permission Required', 'Grant Accessibility permission in System Settings');
    } else {
      showToast('error', 'Error', result.error || 'Failed to start');
    }
  }
}

/**
 * Stop workflow execution
 */
async function stopExecution() {
  await window.workflowAPI.emergencyStop();
  completeAnalyticsLiveExecution('completed');
  addToExecutionHistory();
}

/**
 * Open config panel for action
 */
function openConfigPanel(index) {
  if (!state.currentWorkflow) return;

  const action = state.currentWorkflow.actions[index];
  if (!action) return;

  editorState.selectedActionIndex = index;
  renderActionSequence();

  const meta = ACTION_TYPES[action.type] || { name: 'Action' };
  document.getElementById('config-title').textContent = `Configure ${meta.name}`;

  renderConfigFields(action, index);

  configPanel.classList.remove('hidden');
}

/**
 * Close config panel
 */
function closeConfigPanel() {
  configPanel.classList.add('hidden');
  editorState.selectedActionIndex = -1;
  renderActionSequence();
}

