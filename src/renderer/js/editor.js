/**
 * Workflow Studio - Editor View
 *
 * Handles workflow editing, action palette, and drag-drop
 */

// Action types with their metadata
const ACTION_TYPES = {
  mouse_move: {
    name: 'Mouse Move',
    icon: '<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/>',
    description: 'Move cursor to position'
  },
  mouse_click: {
    name: 'Mouse Click',
    icon: '<path d="M9 9a3 3 0 1 0 6 0 3 3 0 0 0-6 0z"/><path d="M12 3v3m0 12v3m9-9h-3M6 12H3"/>',
    description: 'Click at position'
  },
  keyboard: {
    name: 'Keyboard',
    icon: '<rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><line x1="6" y1="8" x2="6.01" y2="8"/><line x1="10" y1="8" x2="10.01" y2="8"/><line x1="14" y1="8" x2="14.01" y2="8"/><line x1="18" y1="8" x2="18.01" y2="8"/><line x1="8" y1="12" x2="8.01" y2="12"/><line x1="12" y1="12" x2="12.01" y2="12"/><line x1="16" y1="12" x2="16.01" y2="12"/><line x1="7" y1="16" x2="17" y2="16"/>',
    description: 'Type text or press keys'
  },
  wait: {
    name: 'Wait',
    icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    description: 'Wait for duration'
  },
  conditional: {
    name: 'Conditional',
    icon: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    description: 'If/then logic'
  },
  loop: {
    name: 'Loop',
    icon: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    description: 'Repeat actions'
  },
  image_detect: {
    name: 'Find Image',
    icon: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    description: 'Detect image on screen'
  },
  pixel_detect: {
    name: 'Find Pixel',
    icon: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
    description: 'Find pixel by color'
  }
};

// Editor state
let editorState = {
  selectedActionIndex: -1,
  draggedAction: null,
  isDirty: false
};

// DOM references
let actionList = null;
let actionSequence = null;
let workflowNameInput = null;
let loopCountInput = null;
let loopDelayMinInput = null;
let loopDelayMaxInput = null;
let configPanel = null;

/**
 * Initialize editor view
 */
function initEditorView() {
  actionList = document.getElementById('action-list');
  actionSequence = document.getElementById('action-sequence');
  workflowNameInput = document.getElementById('workflow-name');
  loopCountInput = document.getElementById('loop-count');
  loopDelayMinInput = document.getElementById('loop-delay-min');
  loopDelayMaxInput = document.getElementById('loop-delay-max');
  configPanel = document.getElementById('config-panel');

  // Populate action palette
  populateActionPalette();

  // Setup event listeners
  setupEditorEvents();
}

/**
 * Populate the action palette with draggable action items
 */
function populateActionPalette() {
  actionList.innerHTML = '';

  Object.entries(ACTION_TYPES).forEach(([type, meta]) => {
    const item = document.createElement('div');
    item.className = 'action-item';
    item.dataset.type = type;
    item.draggable = true;

    item.innerHTML = `
      <div class="action-item-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${meta.icon}
        </svg>
      </div>
      <div class="action-item-info">
        <div class="action-item-name">${meta.name}</div>
        <div class="action-item-desc">${meta.description}</div>
      </div>
    `;

    // Double click to add
    item.addEventListener('dblclick', () => {
      addActionToSequence(type);
    });

    // Drag start
    item.addEventListener('dragstart', (e) => {
      editorState.draggedAction = { type, isNew: true };
      e.dataTransfer.effectAllowed = 'copy';
      item.classList.add('dragging');
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      editorState.draggedAction = null;
    });

    actionList.appendChild(item);
  });
}

/**
 * Setup editor event listeners
 */
function setupEditorEvents() {
  // Workflow name change
  workflowNameInput.addEventListener('input', () => {
    if (state.currentWorkflow) {
      state.currentWorkflow.name = workflowNameInput.value;
      markDirty();
    }
  });

  workflowNameInput.addEventListener('blur', saveCurrentWorkflow);

  // Loop settings
  [loopCountInput, loopDelayMinInput, loopDelayMaxInput].forEach(input => {
    input.addEventListener('change', () => {
      if (state.currentWorkflow) {
        state.currentWorkflow.loopCount = parseInt(loopCountInput.value) || 1;
        state.currentWorkflow.loopDelay = {
          min: parseInt(loopDelayMinInput.value) || 500,
          max: parseInt(loopDelayMaxInput.value) || 1000
        };
        markDirty();
        saveCurrentWorkflow();
      }
    });
  });

  // Action sequence drag/drop
  actionSequence.addEventListener('dragover', handleDragOver);
  actionSequence.addEventListener('drop', handleDrop);
  actionSequence.addEventListener('dragleave', handleDragLeave);

  // Toolbar buttons
  document.getElementById('btn-run').addEventListener('click', runCurrentWorkflow);
  document.getElementById('btn-dry-run').addEventListener('click', () => runCurrentWorkflow(true));
  document.getElementById('btn-stop').addEventListener('click', stopExecution);

  // Config panel close
  document.getElementById('btn-close-config').addEventListener('click', closeConfigPanel);
}

/**
 * Load a workflow into the editor
 */
function loadWorkflowIntoEditor(workflow) {
  state.currentWorkflow = workflow;
  editorState.selectedActionIndex = -1;
  editorState.isDirty = false;

  // Set form values
  workflowNameInput.value = workflow.name || 'Untitled Workflow';
  loopCountInput.value = workflow.loopCount || 1;
  loopDelayMinInput.value = workflow.loopDelay?.min || 500;
  loopDelayMaxInput.value = workflow.loopDelay?.max || 1000;

  // Render action sequence
  renderActionSequence();

  // Close config panel
  closeConfigPanel();
}

/**
 * Render the action sequence
 */
function renderActionSequence() {
  const actions = state.currentWorkflow?.actions || [];

  if (actions.length === 0) {
    actionSequence.innerHTML = `
      <div class="empty-sequence">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        <p>Drag actions here to build your workflow</p>
      </div>
    `;
    return;
  }

  actionSequence.innerHTML = '';

  actions.forEach((action, index) => {
    const item = createSequenceItem(action, index);
    actionSequence.appendChild(item);
  });
}

/**
 * Create a sequence item element
 */
function createSequenceItem(action, index) {
  const meta = ACTION_TYPES[action.type] || { name: 'Unknown', icon: '' };
  const item = document.createElement('div');
  item.className = 'sequence-item';
  item.dataset.index = index;
  item.draggable = true;

  if (index === editorState.selectedActionIndex) {
    item.classList.add('selected');
  }

  const summary = getActionSummary(action);

  item.innerHTML = `
    <span class="sequence-item-number">${index + 1}</span>
    <div class="sequence-item-icon" data-type="${action.type}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${meta.icon}
      </svg>
    </div>
    <div class="sequence-item-content">
      <div class="sequence-item-title">${meta.name}</div>
      <div class="sequence-item-summary">${summary}</div>
    </div>
    <div class="sequence-item-actions">
      <button class="btn btn-icon" data-action="edit" title="Edit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="btn btn-icon btn-danger" data-action="delete" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
  `;

  // Apply color to icon
  const iconEl = item.querySelector('.sequence-item-icon');
  const type = action.type;
  iconEl.style.background = getActionColor(type, 0.2);
  iconEl.style.color = getActionColor(type, 1);

  // Click to select
  item.addEventListener('click', (e) => {
    if (e.target.closest('[data-action]')) return;
    selectAction(index);
  });

  // Action buttons
  item.querySelector('[data-action="edit"]').addEventListener('click', () => {
    openConfigPanel(index);
  });

  item.querySelector('[data-action="delete"]').addEventListener('click', () => {
    deleteAction(index);
  });

  // Drag for reordering
  item.addEventListener('dragstart', (e) => {
    editorState.draggedAction = { index, isNew: false };
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => item.classList.add('dragging'), 0);
  });

  item.addEventListener('dragend', () => {
    item.classList.remove('dragging');
    editorState.draggedAction = null;
  });

  return item;
}

/**
 * Get action color
 */
function getActionColor(type, alpha = 1) {
  const colors = {
    mouse_move: `rgba(34, 211, 238, ${alpha})`,
    mouse_click: `rgba(96, 165, 250, ${alpha})`,
    keyboard: `rgba(167, 139, 250, ${alpha})`,
    wait: `rgba(251, 191, 36, ${alpha})`,
    conditional: `rgba(52, 211, 153, ${alpha})`,
    loop: `rgba(251, 113, 133, ${alpha})`,
    image_detect: `rgba(129, 140, 248, ${alpha})`,
    pixel_detect: `rgba(244, 114, 182, ${alpha})`
  };
  return colors[type] || `rgba(161, 161, 170, ${alpha})`;
}

/**
 * Get a summary string for an action
 */
function getActionSummary(action) {
  switch (action.type) {
    case 'mouse_move':
      return action.x !== undefined ? `Move to (${action.x}, ${action.y})` : 'Move to position';
    case 'mouse_click':
      const btn = action.button || 'left';
      const click = action.clickType === 'double' ? 'Double click' : 'Click';
      return `${click} ${btn} button`;
    case 'keyboard':
      if (action.mode === 'type') {
        const text = action.text || '';
        return `Type "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"`;
      }
      return `Press ${action.key || 'key'}`;
    case 'wait':
      if (action.duration) {
        const min = action.duration.min || action.duration;
        const max = action.duration.max || action.duration;
        return min === max ? `Wait ${min}ms` : `Wait ${min}-${max}ms`;
      }
      return 'Wait for condition';
    case 'conditional':
      return action.condition?.type || 'If condition';
    case 'loop':
      return `Repeat ${action.count || 1} times`;
    case 'image_detect':
      return action.imageId ? 'Find saved image' : 'Find image';
    case 'pixel_detect':
      return action.color ? `Find color #${action.color.r.toString(16)}${action.color.g.toString(16)}${action.color.b.toString(16)}` : 'Find pixel color';
    default:
      return '';
  }
}

/**
 * Handle dragover for drop zone
 */
function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = editorState.draggedAction?.isNew ? 'copy' : 'move';
  actionSequence.classList.add('drag-over');

  // Find drop position
  const afterElement = getDragAfterElement(actionSequence, e.clientY);
  const dragging = document.querySelector('.sequence-item.dragging');

  if (afterElement == null) {
    if (dragging) actionSequence.appendChild(dragging);
  } else {
    if (dragging) actionSequence.insertBefore(dragging, afterElement);
  }
}

/**
 * Handle drop
 */
function handleDrop(e) {
  e.preventDefault();
  actionSequence.classList.remove('drag-over');

  if (!editorState.draggedAction) return;

  if (editorState.draggedAction.isNew) {
    // Add new action
    const dropIndex = getDropIndex(e.clientY);
    addActionToSequence(editorState.draggedAction.type, dropIndex);
  } else {
    // Reorder existing action
    const fromIndex = editorState.draggedAction.index;
    const toIndex = getDropIndex(e.clientY);

    if (fromIndex !== toIndex) {
      reorderAction(fromIndex, toIndex);
    }
  }

  editorState.draggedAction = null;
}

/**
 * Handle drag leave
 */
function handleDragLeave(e) {
  if (!actionSequence.contains(e.relatedTarget)) {
    actionSequence.classList.remove('drag-over');
  }
}

/**
 * Get drop index from mouse position
 */
function getDropIndex(y) {
  const items = [...actionSequence.querySelectorAll('.sequence-item:not(.dragging)')];
  if (items.length === 0) return 0;

  for (let i = 0; i < items.length; i++) {
    const box = items[i].getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0) return i;
  }

  return items.length;
}

/**
 * Get element to insert after based on Y position
 */
function getDragAfterElement(container, y) {
  const items = [...container.querySelectorAll('.sequence-item:not(.dragging)')];

  return items.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;

    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

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
    keyboard: { type, mode: 'type', text: '' },
    wait: { type, duration: { min: 500, max: 1000 } },
    conditional: { type, condition: { type: 'image_present' }, thenActions: [], elseActions: [] },
    loop: { type, count: 3, actions: [], delay: { min: 500, max: 1000 } },
    image_detect: { type, imageId: null, confidence: 0.9 },
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
 * Mark workflow as dirty (unsaved changes)
 */
function markDirty() {
  editorState.isDirty = true;
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
            <li>Open System Preferences</li>
            <li>Go to Security & Privacy > Privacy</li>
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
      showToast('error', 'Permission Required', 'Grant Accessibility permission in System Preferences');
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

/**
 * Render config fields for an action
 */
function renderConfigFields(action, index) {
  const configBody = document.getElementById('config-body');
  configBody.innerHTML = '';

  switch (action.type) {
    case 'mouse_move':
      configBody.innerHTML = `
        <div class="config-field">
          <label>X Position</label>
          <input type="number" id="config-x" value="${action.x || 0}">
        </div>
        <div class="config-field">
          <label>Y Position</label>
          <input type="number" id="config-y" value="${action.y || 0}">
        </div>
        <div class="config-field">
          <button class="btn btn-secondary" id="btn-pick-position">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
              <circle cx="12" cy="12" r="10"/>
              <line x1="22" y1="12" x2="18" y2="12"/>
              <line x1="6" y1="12" x2="2" y2="12"/>
              <line x1="12" y1="6" x2="12" y2="2"/>
              <line x1="12" y1="22" x2="12" y2="18"/>
            </svg>
            Pick from Screen
          </button>
          <p class="config-field-hint">Click to select position with your mouse</p>
        </div>
      `;

      document.getElementById('config-x').addEventListener('change', (e) => {
        action.x = parseInt(e.target.value) || 0;
        updateAction(index, action);
      });

      document.getElementById('config-y').addEventListener('change', (e) => {
        action.y = parseInt(e.target.value) || 0;
        updateAction(index, action);
      });

      document.getElementById('btn-pick-position').addEventListener('click', async () => {
        await pickPositionFromScreen((pos) => {
          document.getElementById('config-x').value = pos.x;
          document.getElementById('config-y').value = pos.y;
          action.x = pos.x;
          action.y = pos.y;
          updateAction(index, action);
        });
      });
      break;

    case 'mouse_click':
      configBody.innerHTML = `
        <div class="config-field">
          <label>Button</label>
          <select id="config-button">
            <option value="left" ${action.button === 'left' ? 'selected' : ''}>Left</option>
            <option value="right" ${action.button === 'right' ? 'selected' : ''}>Right</option>
            <option value="middle" ${action.button === 'middle' ? 'selected' : ''}>Middle</option>
          </select>
        </div>
        <div class="config-field">
          <label>Click Type</label>
          <select id="config-click-type">
            <option value="single" ${action.clickType === 'single' ? 'selected' : ''}>Single Click</option>
            <option value="double" ${action.clickType === 'double' ? 'selected' : ''}>Double Click</option>
          </select>
        </div>
        <div class="config-field">
          <label>Position (optional)</label>
          <div class="input-group">
            <input type="number" id="config-click-x" placeholder="X" value="${action.x ?? ''}">
            <input type="number" id="config-click-y" placeholder="Y" value="${action.y ?? ''}">
          </div>
          <p class="config-field-hint">Leave empty to click at current position</p>
        </div>
      `;

      document.getElementById('config-button').addEventListener('change', (e) => {
        action.button = e.target.value;
        updateAction(index, action);
      });

      document.getElementById('config-click-type').addEventListener('change', (e) => {
        action.clickType = e.target.value;
        updateAction(index, action);
      });

      document.getElementById('config-click-x').addEventListener('change', (e) => {
        action.x = e.target.value ? parseInt(e.target.value) : undefined;
        updateAction(index, action);
      });

      document.getElementById('config-click-y').addEventListener('change', (e) => {
        action.y = e.target.value ? parseInt(e.target.value) : undefined;
        updateAction(index, action);
      });
      break;

    case 'keyboard':
      configBody.innerHTML = `
        <div class="config-field">
          <label>Mode</label>
          <select id="config-kb-mode">
            <option value="type" ${action.mode === 'type' ? 'selected' : ''}>Type Text</option>
            <option value="press" ${action.mode === 'press' ? 'selected' : ''}>Press Key</option>
          </select>
        </div>
        <div class="config-field" id="field-text" ${action.mode !== 'type' ? 'style="display:none"' : ''}>
          <label>Text to Type</label>
          <textarea id="config-text" rows="3">${action.text || ''}</textarea>
        </div>
        <div class="config-field" id="field-key" ${action.mode !== 'press' ? 'style="display:none"' : ''}>
          <label>Key or Combo</label>
          <input type="text" id="config-key" value="${action.key || ''}" placeholder="e.g., ctrl+c, enter, a">
          <p class="config-field-hint">Examples: enter, tab, ctrl+a, cmd+shift+s</p>
        </div>
      `;

      document.getElementById('config-kb-mode').addEventListener('change', (e) => {
        action.mode = e.target.value;
        document.getElementById('field-text').style.display = action.mode === 'type' ? '' : 'none';
        document.getElementById('field-key').style.display = action.mode === 'press' ? '' : 'none';
        updateAction(index, action);
      });

      document.getElementById('config-text').addEventListener('input', (e) => {
        action.text = e.target.value;
        updateAction(index, action);
      });

      document.getElementById('config-key').addEventListener('change', (e) => {
        action.key = e.target.value;
        updateAction(index, action);
      });
      break;

    case 'wait':
      configBody.innerHTML = `
        <div class="config-field">
          <label>Duration (milliseconds)</label>
          <div class="range-inputs">
            <input type="number" id="config-wait-min" min="0" max="60000" value="${action.duration?.min || 500}">
            <span>to</span>
            <input type="number" id="config-wait-max" min="0" max="60000" value="${action.duration?.max || 1000}">
          </div>
          <p class="config-field-hint">Random delay between min and max for natural timing</p>
        </div>
      `;

      document.getElementById('config-wait-min').addEventListener('change', (e) => {
        action.duration = action.duration || {};
        action.duration.min = parseInt(e.target.value) || 500;
        updateAction(index, action);
      });

      document.getElementById('config-wait-max').addEventListener('change', (e) => {
        action.duration = action.duration || {};
        action.duration.max = parseInt(e.target.value) || 1000;
        updateAction(index, action);
      });
      break;

    case 'conditional':
      renderConditionalConfig(configBody, action, index);
      break;

    case 'loop':
      renderLoopConfig(configBody, action, index);
      break;

    case 'image_detect':
      renderImageDetectConfig(configBody, action, index);
      break;

    case 'pixel_detect':
      renderPixelDetectConfig(configBody, action, index);
      break;

    default:
      configBody.innerHTML = '<p style="color: var(--text-secondary);">Unknown action type.</p>';
  }
}

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
function renderConditionalConfig(configBody, action, index) {
  action.condition = action.condition || { type: 'image_present' };
  action.thenActions = action.thenActions || [];
  action.elseActions = action.elseActions || [];

  configBody.innerHTML = `
    <div class="config-field">
      <label>Condition Type</label>
      <select id="config-condition-type">
        <option value="image_present" ${action.condition.type === 'image_present' ? 'selected' : ''}>Image Present</option>
        <option value="image_absent" ${action.condition.type === 'image_absent' ? 'selected' : ''}>Image Absent</option>
        <option value="pixel_match" ${action.condition.type === 'pixel_match' ? 'selected' : ''}>Pixel Color Match</option>
      </select>
    </div>
    <div class="config-field" id="cond-image-field" ${action.condition.type === 'pixel_match' ? 'style="display:none"' : ''}>
      <label>Image Template</label>
      <select id="config-condition-image">
        <option value="">Select image...</option>
      </select>
      <button class="btn btn-secondary btn-sm" id="btn-capture-cond-image" style="margin-top:8px">
        Capture New Image
      </button>
    </div>
    <div class="config-field" id="cond-confidence-field" ${action.condition.type === 'pixel_match' ? 'style="display:none"' : ''}>
      <label>Match Confidence: <span id="cond-conf-value">${Math.round((action.condition.confidence || 0.9) * 100)}%</span></label>
      <input type="range" id="config-condition-confidence" min="50" max="100" value="${Math.round((action.condition.confidence || 0.9) * 100)}">
    </div>
    <div class="config-field" id="cond-pixel-field" ${action.condition.type !== 'pixel_match' ? 'style="display:none"' : ''}>
      <label>Pixel Color</label>
      <div class="color-picker-row">
        <input type="color" id="config-condition-color" value="${rgbToHex(action.condition.color)}">
        <span id="cond-color-preview" style="display:inline-block;width:24px;height:24px;border-radius:4px;background:${rgbToHex(action.condition.color)};border:1px solid var(--border)"></span>
      </div>
    </div>
    <div class="config-field" id="cond-tolerance-field" ${action.condition.type !== 'pixel_match' ? 'style="display:none"' : ''}>
      <label>Color Tolerance: <span id="cond-tol-value">${action.condition.tolerance || 10}</span></label>
      <input type="range" id="config-condition-tolerance" min="0" max="50" value="${action.condition.tolerance || 10}">
    </div>
    <div class="config-section">
      <div class="config-section-header">
        <span>Then (if true): ${action.thenActions.length} actions</span>
        <button class="btn btn-secondary btn-sm" id="btn-edit-then">Edit</button>
      </div>
    </div>
    <div class="config-section">
      <div class="config-section-header">
        <span>Else (if false): ${action.elseActions.length} actions</span>
        <button class="btn btn-secondary btn-sm" id="btn-edit-else">Edit</button>
      </div>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-continue-error" ${action.continueOnError ? 'checked' : ''}>
        Continue on error
      </label>
    </div>
  `;

  // Load images for dropdown
  loadImageOptions('config-condition-image', action.condition.imageId);

  document.getElementById('config-condition-type').addEventListener('change', (e) => {
    action.condition.type = e.target.value;
    const isPixel = e.target.value === 'pixel_match';
    document.getElementById('cond-image-field').style.display = isPixel ? 'none' : '';
    document.getElementById('cond-confidence-field').style.display = isPixel ? 'none' : '';
    document.getElementById('cond-pixel-field').style.display = isPixel ? '' : 'none';
    document.getElementById('cond-tolerance-field').style.display = isPixel ? '' : 'none';
    updateAction(index, action);
  });

  document.getElementById('config-condition-image').addEventListener('change', (e) => {
    action.condition.imageId = e.target.value || null;
    updateAction(index, action);
  });

  document.getElementById('config-condition-confidence').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('cond-conf-value').textContent = val + '%';
    action.condition.confidence = val / 100;
    updateAction(index, action);
  });

  document.getElementById('config-condition-color').addEventListener('change', (e) => {
    action.condition.color = hexToRgb(e.target.value);
    document.getElementById('cond-color-preview').style.background = e.target.value;
    updateAction(index, action);
  });

  document.getElementById('config-condition-tolerance').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('cond-tol-value').textContent = val;
    action.condition.tolerance = val;
    updateAction(index, action);
  });

  document.getElementById('btn-capture-cond-image').addEventListener('click', () => {
    captureImageTemplate((imageId) => {
      action.condition.imageId = imageId;
      loadImageOptions('config-condition-image', imageId);
      updateAction(index, action);
    });
  });

  document.getElementById('btn-edit-then').addEventListener('click', () => {
    openNestedActionsEditor(action, 'thenActions', 'Then Actions', index);
  });

  document.getElementById('btn-edit-else').addEventListener('click', () => {
    openNestedActionsEditor(action, 'elseActions', 'Else Actions', index);
  });

  document.getElementById('config-continue-error').addEventListener('change', (e) => {
    action.continueOnError = e.target.checked;
    updateAction(index, action);
  });
}

/**
 * Render Loop action config
 */
function renderLoopConfig(configBody, action, index) {
  action.actions = action.actions || [];
  action.delay = action.delay || { min: 500, max: 1000 };

  configBody.innerHTML = `
    <div class="config-field">
      <label>Number of Iterations</label>
      <input type="number" id="config-loop-count" min="1" max="10000" value="${action.count || 3}">
    </div>
    <div class="config-field">
      <label>Delay Between Iterations (ms)</label>
      <div class="range-inputs">
        <input type="number" id="config-loop-delay-min" min="0" max="60000" value="${action.delay.min || 500}">
        <span>to</span>
        <input type="number" id="config-loop-delay-max" min="0" max="60000" value="${action.delay.max || 1000}">
      </div>
    </div>
    <div class="config-section">
      <div class="config-section-header">
        <span>Loop Actions: ${action.actions.length} actions</span>
        <button class="btn btn-secondary btn-sm" id="btn-edit-loop-actions">Edit</button>
      </div>
      <p class="config-field-hint">These actions will repeat for each iteration</p>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-loop-continue-error" ${action.continueOnError ? 'checked' : ''}>
        Continue on error
      </label>
    </div>
  `;

  document.getElementById('config-loop-count').addEventListener('change', (e) => {
    action.count = parseInt(e.target.value) || 3;
    updateAction(index, action);
  });

  document.getElementById('config-loop-delay-min').addEventListener('change', (e) => {
    action.delay.min = parseInt(e.target.value) || 500;
    updateAction(index, action);
  });

  document.getElementById('config-loop-delay-max').addEventListener('change', (e) => {
    action.delay.max = parseInt(e.target.value) || 1000;
    updateAction(index, action);
  });

  document.getElementById('btn-edit-loop-actions').addEventListener('click', () => {
    openNestedActionsEditor(action, 'actions', 'Loop Actions', index);
  });

  document.getElementById('config-loop-continue-error').addEventListener('change', (e) => {
    action.continueOnError = e.target.checked;
    updateAction(index, action);
  });
}

/**
 * Render Image Detect action config
 */
function renderImageDetectConfig(configBody, action, index) {
  configBody.innerHTML = `
    <div class="config-field">
      <label>Image Template</label>
      <select id="config-image-id">
        <option value="">Select image...</option>
      </select>
    </div>
    <div class="config-field">
      <button class="btn btn-secondary" id="btn-capture-image">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        Capture New Image
      </button>
    </div>
    <div class="config-field" id="image-preview-container" style="display:none">
      <label>Preview</label>
      <img id="image-preview" style="max-width:100%;max-height:150px;border-radius:4px;border:1px solid var(--border)">
    </div>
    <div class="config-field">
      <label>Match Confidence: <span id="conf-value">${Math.round((action.confidence || 0.9) * 100)}%</span></label>
      <input type="range" id="config-confidence" min="50" max="100" value="${Math.round((action.confidence || 0.9) * 100)}">
      <p class="config-field-hint">Higher values require closer match</p>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-fail-not-found" ${action.failOnNotFound ? 'checked' : ''}>
        Fail if not found
      </label>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-img-continue-error" ${action.continueOnError ? 'checked' : ''}>
        Continue on error
      </label>
    </div>
  `;

  // Load images for dropdown
  loadImageOptions('config-image-id', action.imageId);

  document.getElementById('config-image-id').addEventListener('change', (e) => {
    action.imageId = e.target.value || null;
    updateAction(index, action);
    updateImagePreview(action.imageId);
  });

  document.getElementById('btn-capture-image').addEventListener('click', () => {
    captureImageTemplate((imageId) => {
      action.imageId = imageId;
      loadImageOptions('config-image-id', imageId);
      updateAction(index, action);
      updateImagePreview(imageId);
    });
  });

  document.getElementById('config-confidence').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('conf-value').textContent = val + '%';
    action.confidence = val / 100;
    updateAction(index, action);
  });

  document.getElementById('config-fail-not-found').addEventListener('change', (e) => {
    action.failOnNotFound = e.target.checked;
    updateAction(index, action);
  });

  document.getElementById('config-img-continue-error').addEventListener('change', (e) => {
    action.continueOnError = e.target.checked;
    updateAction(index, action);
  });

  // Show preview if image selected
  if (action.imageId) {
    updateImagePreview(action.imageId);
  }
}

/**
 * Render Pixel Detect action config
 */
function renderPixelDetectConfig(configBody, action, index) {
  action.color = action.color || { r: 255, g: 0, b: 0 };

  configBody.innerHTML = `
    <div class="config-field">
      <label>Target Color</label>
      <div class="color-picker-row">
        <input type="color" id="config-pixel-color" value="${rgbToHex(action.color)}">
        <span id="color-preview" style="display:inline-block;width:32px;height:32px;border-radius:4px;background:${rgbToHex(action.color)};border:1px solid var(--border)"></span>
        <button class="btn btn-secondary btn-sm" id="btn-pick-color">Pick from Screen</button>
      </div>
    </div>
    <div class="config-field">
      <label>RGB Values</label>
      <div class="rgb-inputs">
        <div>
          <span>R</span>
          <input type="number" id="config-pixel-r" min="0" max="255" value="${action.color.r}">
        </div>
        <div>
          <span>G</span>
          <input type="number" id="config-pixel-g" min="0" max="255" value="${action.color.g}">
        </div>
        <div>
          <span>B</span>
          <input type="number" id="config-pixel-b" min="0" max="255" value="${action.color.b}">
        </div>
      </div>
    </div>
    <div class="config-field">
      <label>Color Tolerance: <span id="tol-value">${action.tolerance || 10}</span></label>
      <input type="range" id="config-tolerance" min="0" max="50" value="${action.tolerance || 10}">
      <p class="config-field-hint">How much variation to allow (0 = exact match)</p>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-pixel-fail-not-found" ${action.failOnNotFound ? 'checked' : ''}>
        Fail if not found
      </label>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-pixel-continue-error" ${action.continueOnError ? 'checked' : ''}>
        Continue on error
      </label>
    </div>
  `;

  const updateColorFromHex = (hex) => {
    action.color = hexToRgb(hex);
    document.getElementById('color-preview').style.background = hex;
    document.getElementById('config-pixel-r').value = action.color.r;
    document.getElementById('config-pixel-g').value = action.color.g;
    document.getElementById('config-pixel-b').value = action.color.b;
    updateAction(index, action);
  };

  const updateColorFromRgb = () => {
    action.color = {
      r: parseInt(document.getElementById('config-pixel-r').value) || 0,
      g: parseInt(document.getElementById('config-pixel-g').value) || 0,
      b: parseInt(document.getElementById('config-pixel-b').value) || 0
    };
    const hex = rgbToHex(action.color);
    document.getElementById('config-pixel-color').value = hex;
    document.getElementById('color-preview').style.background = hex;
    updateAction(index, action);
  };

  document.getElementById('config-pixel-color').addEventListener('change', (e) => {
    updateColorFromHex(e.target.value);
  });

  ['config-pixel-r', 'config-pixel-g', 'config-pixel-b'].forEach(id => {
    document.getElementById(id).addEventListener('change', updateColorFromRgb);
  });

  document.getElementById('btn-pick-color').addEventListener('click', async () => {
    await pickColorFromScreen((color) => {
      action.color = color;
      const hex = rgbToHex(color);
      document.getElementById('config-pixel-color').value = hex;
      document.getElementById('color-preview').style.background = hex;
      document.getElementById('config-pixel-r').value = color.r;
      document.getElementById('config-pixel-g').value = color.g;
      document.getElementById('config-pixel-b').value = color.b;
      updateAction(index, action);
    });
  });

  document.getElementById('config-tolerance').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('tol-value').textContent = val;
    action.tolerance = val;
    updateAction(index, action);
  });

  document.getElementById('config-pixel-fail-not-found').addEventListener('change', (e) => {
    action.failOnNotFound = e.target.checked;
    updateAction(index, action);
  });

  document.getElementById('config-pixel-continue-error').addEventListener('change', (e) => {
    action.continueOnError = e.target.checked;
    updateAction(index, action);
  });
}

/**
 * Helper: Convert RGB to hex
 */
function rgbToHex(color) {
  if (!color) return '#ff0000';
  const r = (color.r || 0).toString(16).padStart(2, '0');
  const g = (color.g || 0).toString(16).padStart(2, '0');
  const b = (color.b || 0).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

/**
 * Helper: Convert hex to RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 0, b: 0 };
}

/**
 * Load image options into a select dropdown
 */
async function loadImageOptions(selectId, selectedId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  try {
    const images = await window.workflowAPI.getImages();
    select.innerHTML = '<option value="">Select image...</option>';
    images.forEach(img => {
      const option = document.createElement('option');
      option.value = img.id;
      option.textContent = img.id;
      if (img.id === selectedId) option.selected = true;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Failed to load images:', error);
  }
}

/**
 * Update image preview
 */
function updateImagePreview(imageId) {
  const container = document.getElementById('image-preview-container');
  const preview = document.getElementById('image-preview');
  if (!container || !preview) return;

  if (imageId) {
    // Note: In production, you'd get the actual file path
    container.style.display = '';
    preview.alt = imageId;
  } else {
    container.style.display = 'none';
  }
}

/**
 * Capture image template from screen with region selection
 */
async function captureImageTemplate(callback) {
  try {
    // Minimize the main window first
    await window.workflowAPI.minimizeWindow();

    // Small delay to ensure window is minimized
    await new Promise(r => setTimeout(r, 300));

    // Open region selection overlay
    const result = await window.workflowAPI.captureRegionTemplate();

    if (result.cancelled) {
      showToast('info', 'Cancelled', 'Region capture cancelled');
      return;
    }

    if (!result.success) {
      showToast('error', 'Error', result.error || 'Failed to capture region');
      return;
    }

    showToast('success', 'Image Captured', `Saved as ${result.imageId}`);
    if (callback) callback(result.imageId);
  } catch (error) {
    console.error('Image capture failed:', error);
    showToast('error', 'Capture Failed', error.message);
  }
}

/**
 * Open nested actions editor modal
 */
function openNestedActionsEditor(parentAction, actionsKey, title, parentIndex) {
  const nestedActions = parentAction[actionsKey] || [];

  showModal(
    title,
    `
      <div class="nested-editor">
        <div class="nested-actions-list" id="nested-actions-list">
          ${nestedActions.length === 0 ? '<p class="empty-nested">No actions yet. Add actions below.</p>' : ''}
          ${nestedActions.map((action, i) => `
            <div class="nested-action-item" data-index="${i}">
              <span class="nested-num">${i + 1}</span>
              <span class="nested-name">${ACTION_TYPES[action.type]?.name || action.type}</span>
              <span class="nested-summary">${getActionSummary(action)}</span>
              <button class="btn btn-icon btn-danger btn-sm" data-delete="${i}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          `).join('')}
        </div>
        <div class="nested-add-section">
          <label>Add Action</label>
          <select id="nested-action-type">
            ${Object.entries(ACTION_TYPES).map(([type, meta]) => `
              <option value="${type}">${meta.name}</option>
            `).join('')}
          </select>
          <button class="btn btn-primary" id="btn-add-nested">Add</button>
        </div>
      </div>
    `,
    [
      { label: 'Done', primary: true, action: 'close' }
    ]
  );

  // Add action handler
  document.getElementById('btn-add-nested').addEventListener('click', () => {
    const type = document.getElementById('nested-action-type').value;
    const newAction = createDefaultAction(type);
    parentAction[actionsKey] = parentAction[actionsKey] || [];
    parentAction[actionsKey].push(newAction);
    updateAction(parentIndex, parentAction);
    openNestedActionsEditor(parentAction, actionsKey, title, parentIndex);
  });

  // Delete handlers
  document.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.delete);
      parentAction[actionsKey].splice(idx, 1);
      updateAction(parentIndex, parentAction);
      openNestedActionsEditor(parentAction, actionsKey, title, parentIndex);
    });
  });
}

/**
 * Pick a position from screen using overlay
 */
async function pickPositionFromScreen(callback) {
  try {
    const pos = await window.workflowAPI.pickScreenPosition();

    if (!pos) {
      showToast('info', 'Cancelled', 'Position pick cancelled');
      return;
    }

    showToast('success', 'Position Captured', `X: ${pos.x}, Y: ${pos.y}`);

    if (callback) {
      callback(pos);
    }
  } catch (error) {
    console.error('Position capture failed:', error);
    showToast('error', 'Error', 'Failed to capture position');
  }
}

/**
 * Pick a color from screen using overlay
 */
async function pickColorFromScreen(callback) {
  try {
    const pos = await window.workflowAPI.pickScreenPosition();

    if (!pos) {
      showToast('info', 'Cancelled', 'Color pick cancelled');
      return;
    }

    // Small delay to ensure overlay is fully closed before sampling
    await new Promise(resolve => setTimeout(resolve, 100));

    const color = await window.workflowAPI.getPixelColor(pos.x, pos.y);

    if (color) {
      showToast('success', 'Color Captured', `RGB(${color.r}, ${color.g}, ${color.b})`);
      if (callback) {
        callback(color);
      }
    } else {
      showToast('error', 'Error', 'Failed to get pixel color');
    }
  } catch (error) {
    console.error('Color capture failed:', error);
    showToast('error', 'Error', 'Failed to capture color');
  }
}
