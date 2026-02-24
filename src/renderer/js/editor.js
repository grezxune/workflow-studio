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
  isDirty: false,
  templates: [],
  selectedActionIndices: [], // For multi-select when saving templates
  compactView: false
};

// DOM references
let actionList = null;
let actionSequence = null;
let workflowNameInput = null;
let loopCountInput = null;
let loopDelayMinInput = null;
let loopDelayMaxInput = null;
let configPanel = null;
let templateList = null;
let toggleViewBtn = null;

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
  templateList = document.getElementById('template-list');
  toggleViewBtn = document.getElementById('btn-toggle-view');

  // Populate action palette
  populateActionPalette();

  // Setup event listeners
  setupEditorEvents();

  // Setup view toggle
  setupViewToggle();

  // Setup preview overlay
  setupPreviewOverlay();

  // Load templates
  loadTemplates();
}

/**
 * Setup view toggle button
 */
function setupViewToggle() {
  if (!toggleViewBtn) return;
  
  toggleViewBtn.addEventListener('click', toggleCompactView);
  
  // Keyboard shortcut V for view toggle
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'v' && !isInputFocused()) {
      e.preventDefault();
      toggleCompactView();
    }
  });
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
 * Toggle between compact and normal view
 */
function toggleCompactView() {
  editorState.compactView = !editorState.compactView;
  
  if (editorState.compactView) {
    actionSequence.classList.add('compact-view');
  } else {
    actionSequence.classList.remove('compact-view');
  }
  
  // Update button icons
  const listIcon = document.getElementById('icon-list-view');
  const gridIcon = document.getElementById('icon-grid-view');
  if (listIcon && gridIcon) {
    listIcon.style.display = editorState.compactView ? 'none' : 'block';
    gridIcon.style.display = editorState.compactView ? 'block' : 'none';
  }
}

/**
 * Setup preview overlay toggle
 */
function setupPreviewOverlay() {
  const previewBtn = document.getElementById('btn-preview-overlay');
  if (!previewBtn) return;

  let previewActive = false;

  async function togglePreview() {
    if (!state.currentWorkflow) {
      showToast('warning', 'No Workflow', 'Open a workflow first');
      return;
    }

    if (previewActive) {
      await window.workflowAPI.closeWorkflowPreview();
      previewActive = false;
      previewBtn.classList.remove('active');
      return;
    }

    const result = await window.workflowAPI.showWorkflowPreview(state.currentWorkflow);
    if (result && result.success) {
      previewActive = true;
      previewBtn.classList.add('active');
      showToast('info', 'Preview Overlay', `Showing ${result.targetCount} targets. Press ESC on overlay to close.`);
    } else if (result && result.error) {
      showToast('warning', 'No Targets', result.error);
    }
  }

  previewBtn.addEventListener('click', togglePreview);

  // Listen for overlay closed externally (ESC on overlay)
  window.workflowAPI.onWorkflowPreviewClosed(() => {
    previewActive = false;
    previewBtn.classList.remove('active');
  });

  // Keyboard shortcut P
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'p' && !isInputFocused()) {
      e.preventDefault();
      togglePreview();
    }
  });
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

  // Save as template button
  document.getElementById('btn-save-as-template').addEventListener('click', openSaveAsTemplateModal);
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
  const actionName = action.name ? `<div class="sequence-item-name">${escapeHtml(action.name)}</div>` : '';

  const compactLabel = getCompactLabel(action);
  
  item.innerHTML = `
    <span class="sequence-item-number">${index + 1}</span>
    <div class="sequence-item-icon" data-type="${action.type}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${meta.icon}
      </svg>
    </div>
    <span class="sequence-item-compact-label" title="${escapeHtml(summary)}">${escapeHtml(compactLabel)}</span>
    <div class="sequence-item-content">
      ${actionName}
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
    if (e.target.closest('[data-action]') || e.target.closest('.inline-children') || e.target.closest('.inline-toggle')) return;
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
    if (e.target.closest('.inline-children')) { e.preventDefault(); return; }
    editorState.draggedAction = { index, isNew: false };
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'main-action',
      index: index
    }));
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => item.classList.add('dragging'), 0);
  });

  item.addEventListener('dragend', () => {
    item.classList.remove('dragging');
    editorState.draggedAction = null;
  });

  // Inline nested children for actions with sub-action branches
  const inlineBranches = getInlineBranches(action);
  if (inlineBranches.length > 0) {
    item.appendChild(renderInlineChildren(action, index, inlineBranches));
  }

  return item;
}

/**
 * Get the inline branches for an action type.
 * Returns an array of { key, label, actions } objects.
 * Any action type that has nested sub-actions should be registered here.
 */
function getInlineBranches(action) {
  switch (action.type) {
    case 'loop':
      return [{ key: 'actions', label: 'Loop Actions', actions: action.actions || [] }];
    case 'conditional':
      return [
        { key: 'thenActions', label: 'Then', actions: action.thenActions || [] },
        { key: 'elseActions', label: 'Else', actions: action.elseActions || [] }
      ];
    case 'keyboard':
      if (action.mode === 'hold_and_act') {
        return [{ key: 'actions', label: `Hold ${action.key || 'key'}`, actions: action.actions || [] }];
      }
      return [];
    default:
      return [];
  }
}

/**
 * Render inline children container for an action's branches.
 * Shared by loop, conditional, keyboard hold_and_act, and any future nested action types.
 * Supports drag/drop reorder within branch, drag from main sequence, move-out, edit, delete.
 */
function renderInlineChildren(action, index, branches) {
  const childrenContainer = document.createElement('div');
  childrenContainer.className = 'inline-children';

  branches.forEach(branch => {
    const branchEl = document.createElement('div');
    branchEl.className = 'inline-branch';

    const header = document.createElement('div');
    header.className = 'inline-branch-header';
    header.innerHTML = `
      <span class="inline-branch-label">${branch.label}</span>
      <span class="inline-branch-count">${branch.actions.length} action${branch.actions.length !== 1 ? 's' : ''}</span>
    `;
    branchEl.appendChild(header);

    const listEl = document.createElement('div');
    listEl.className = 'inline-branch-list';
    listEl.dataset.parentIndex = index;
    listEl.dataset.actionsKey = branch.key;

    if (branch.actions.length === 0) {
      listEl.innerHTML = '<div class="inline-empty">Drop actions here</div>';
    } else {
      let inlineDragIndex = null;
      let inlineDragAllowed = false;

      branch.actions.forEach((childAction, ci) => {
        const childEl = document.createElement('div');
        childEl.className = 'inline-child-item';
        childEl.draggable = true;
        childEl.dataset.childIndex = ci;
        childEl.innerHTML = `
          <span class="inline-child-handle" title="Drag to reorder">⋮⋮</span>
          <span class="inline-child-num">${ci + 1}</span>
          <span class="inline-child-name">${childAction.name ? escapeHtml(childAction.name) : (ACTION_TYPES[childAction.type]?.name || childAction.type)}</span>
          <span class="inline-child-summary">${getActionSummary(childAction)}</span>
          <div class="inline-child-buttons">
            <button class="btn btn-icon btn-sm inline-child-edit" title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn btn-icon btn-sm inline-child-moveout" title="Move out to main sequence">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
            <button class="btn btn-icon btn-sm btn-danger inline-child-delete" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        `;

        // Drag handle
        const handle = childEl.querySelector('.inline-child-handle');
        handle.addEventListener('mousedown', () => { inlineDragAllowed = true; });

        childEl.addEventListener('dragstart', (e) => {
          if (!inlineDragAllowed) { e.preventDefault(); return; }
          e.stopPropagation();
          inlineDragAllowed = false;
          inlineDragIndex = ci;
          childEl.classList.add('dragging');
          e.dataTransfer.setData('text/plain', JSON.stringify({
            type: 'inline-child',
            childIndex: ci,
            branchKey: branch.key,
            parentIndex: index
          }));
          e.dataTransfer.effectAllowed = 'move';
        });

        childEl.addEventListener('dragend', (e) => {
          e.stopPropagation();
          childEl.classList.remove('dragging');
          inlineDragIndex = null;
          inlineDragAllowed = false;
          listEl.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        });

        childEl.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (inlineDragIndex !== null && ci !== inlineDragIndex) {
            childEl.classList.add('drag-over');
          }
        });

        childEl.addEventListener('dragleave', () => {
          childEl.classList.remove('drag-over');
        });

        childEl.addEventListener('drop', (e) => {
          e.preventDefault();
          e.stopPropagation();
          childEl.classList.remove('drag-over');

          try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.type === 'inline-child' && data.branchKey === branch.key && data.parentIndex === index) {
              const arr = action[branch.key];
              const [moved] = arr.splice(data.childIndex, 1);
              arr.splice(ci, 0, moved);
              updateAction(index, action);
              markDirty();
              renderActionSequence();
              saveCurrentWorkflow();
              return;
            }
            if (data.type === 'main-action' && data.index !== index) {
              const mainActions = state.currentWorkflow.actions;
              const [movedAction] = mainActions.splice(data.index, 1);
              action[branch.key] = action[branch.key] || [];
              action[branch.key].splice(ci, 0, movedAction);
              const newIndex = data.index < index ? index - 1 : index;
              updateAction(newIndex, action);
              markDirty();
              renderActionSequence();
              saveCurrentWorkflow();
            }
          } catch (err) {}
        });

        // Edit button
        childEl.querySelector('.inline-child-edit').addEventListener('click', (e) => {
          e.stopPropagation();
          openNestedActionConfig(childAction, ci, action, branch.key, branch.label, index);
        });

        // Move-out button
        childEl.querySelector('.inline-child-moveout').addEventListener('click', (e) => {
          e.stopPropagation();
          const branchArr = action[branch.key];
          if (!branchArr) return;
          const [movedAction] = branchArr.splice(ci, 1);
          state.currentWorkflow.actions.splice(index + 1, 0, movedAction);
          updateAction(index, action);
          markDirty();
          renderActionSequence();
          saveCurrentWorkflow();
        });

        // Delete button
        childEl.querySelector('.inline-child-delete').addEventListener('click', (e) => {
          e.stopPropagation();
          action[branch.key].splice(ci, 1);
          updateAction(index, action);
          markDirty();
          renderActionSequence();
          saveCurrentWorkflow();
        });

        listEl.appendChild(childEl);
      });

      // Reset drag flag on mouseup
      document.addEventListener('mouseup', () => { inlineDragAllowed = false; });
    }

    branchEl.appendChild(listEl);
    childrenContainer.appendChild(branchEl);

    // Drag/drop onto inline branch list (from main sequence)
    listEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      listEl.classList.add('drag-over');
    });

    listEl.addEventListener('dragleave', (e) => {
      if (!listEl.contains(e.relatedTarget)) {
        listEl.classList.remove('drag-over');
      }
    });

    listEl.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      listEl.classList.remove('drag-over');

      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (data.type === 'main-action' && data.index !== index) {
          const mainActions = state.currentWorkflow.actions;
          const [movedAction] = mainActions.splice(data.index, 1);
          action[branch.key] = action[branch.key] || [];
          action[branch.key].push(movedAction);
          const newIndex = data.index < index ? index - 1 : index;
          updateAction(newIndex, action);
          markDirty();
          renderActionSequence();
          saveCurrentWorkflow();
        }
      } catch (err) {}
    });
  });

  return childrenContainer;
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
 * Get a compact label for an action (used in compact view)
 */
function getCompactLabel(action) {
  switch (action.type) {
    case 'mouse_move':
      if (action.moveMode === 'image' && action.imageId) {
        return `🖼${action.imageId.substring(0, 6)}`;
      }
      if (action.moveMode === 'bounds' && action.bounds) {
        return `□${action.bounds.x},${action.bounds.y}`;
      }
      return action.x !== undefined ? `${action.x},${action.y}` : 'pos';
    case 'mouse_click':
      const btn = (action.button || 'left')[0].toUpperCase();
      return action.clickType === 'double' ? `${btn}x2` : btn;
    case 'keyboard':
      if (action.mode === 'type') {
        const text = action.text || '';
        return text.substring(0, 8) + (text.length > 8 ? '…' : '');
      }
      return action.key || 'key';
    case 'wait':
      if (action.duration) {
        const ms = action.duration.min || action.duration;
        return `${ms}ms`;
      }
      return 'wait';
    case 'conditional':
      return 'if';
    case 'loop':
      return action.infinite ? '×∞' : `×${action.count || 1}`;
    case 'image_detect':
      return 'img';
    case 'pixel_detect':
      return 'px';
    default:
      return action.type;
  }
}

/**
 * Get a summary string for an action
 */
function getActionSummary(action) {
  switch (action.type) {
    case 'mouse_move':
      if (action.moveMode === 'image' && action.imageId) {
        return `Move to image "${action.imageId}"`;
      }
      if (action.moveMode === 'bounds' && action.bounds) {
        const b = action.bounds;
        return `Random in (${b.x}, ${b.y}) ${b.width}×${b.height}`;
      }
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
      if (action.mode === 'hold_and_act') {
        const subCount = action.actions?.length || 0;
        return `Hold ${action.key || 'key'} + ${subCount} action${subCount !== 1 ? 's' : ''}`;
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
      return action.infinite ? 'Repeat forever' : `Repeat ${action.count || 1} times`;
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

  if (editorState.draggedAction.isTemplate) {
    // Insert template actions
    const dropIndex = getDropIndex(e.clientY);
    insertTemplateIntoWorkflow(editorState.draggedAction.templateId, dropIndex);
  } else if (editorState.draggedAction.isNew) {
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
    keyboard: { type, mode: 'type', text: '', actions: [] },
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
function renderConfigFields(action, index, targetConfigBody, saveCallback) {
  const configBody = targetConfigBody || document.getElementById('config-body');
  const save = saveCallback || (() => updateAction(index, action));
  const rerender = () => renderConfigFields(action, index, configBody, save);
  configBody.innerHTML = '';

  // Add name field at the top for all actions
  const nameFieldHtml = `
    <div class="config-field">
      <label>Action Name (optional)</label>
      <input type="text" id="config-action-name" value="${escapeHtml(action.name || '')}" placeholder="Give this action a name...">
      <p class="config-field-hint">A custom name to identify this action</p>
    </div>
    <hr style="border: none; border-top: 1px solid var(--border-color); margin: var(--space-4) 0;">
  `;

  // Name field listener (shared across all types)
  function setupName() {
    const nameInput = document.getElementById('config-action-name');
    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        action.name = e.target.value.trim() || undefined;
        save();
      });
    }
  }

  switch (action.type) {
    case 'mouse_move':
      action.moveMode = action.moveMode || 'point';
      const modeHints = {
        point: 'Move to an exact position',
        bounds: 'Move to a random point within a rectangular area',
        image: 'Find an image on screen and move to a random point within it'
      };
      configBody.innerHTML = nameFieldHtml + `
        <div class="config-field">
          <label>Move Mode</label>
          <div class="toggle-group">
            <button class="toggle-btn ${action.moveMode === 'point' ? 'active' : ''}" data-mode="point">Point</button>
            <button class="toggle-btn ${action.moveMode === 'bounds' ? 'active' : ''}" data-mode="bounds">Bounding Box</button>
            <button class="toggle-btn ${action.moveMode === 'image' ? 'active' : ''}" data-mode="image">Image</button>
          </div>
          <p class="config-field-hint">${modeHints[action.moveMode]}</p>
        </div>
        <div id="point-fields" ${action.moveMode !== 'point' ? 'style="display:none"' : ''}>
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
        </div>
        <div id="bounds-fields" ${action.moveMode !== 'bounds' ? 'style="display:none"' : ''}>
          <div class="config-field">
            <label>Top-Left X</label>
            <input type="number" id="config-bounds-x" value="${action.bounds?.x || 0}">
          </div>
          <div class="config-field">
            <label>Top-Left Y</label>
            <input type="number" id="config-bounds-y" value="${action.bounds?.y || 0}">
          </div>
          <div class="config-field">
            <label>Width</label>
            <input type="number" id="config-bounds-w" min="1" value="${action.bounds?.width || 100}">
          </div>
          <div class="config-field">
            <label>Height</label>
            <input type="number" id="config-bounds-h" min="1" value="${action.bounds?.height || 100}">
          </div>
          <div class="config-field">
            <button class="btn btn-secondary" id="btn-pick-bounds">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="9" y1="21" x2="9" y2="9"/>
              </svg>
              Pick Region from Screen
            </button>
            <p class="config-field-hint">Click and drag to select a rectangular region</p>
          </div>
        </div>
        <div id="image-fields" ${action.moveMode !== 'image' ? 'style="display:none"' : ''}>
          <div class="config-field">
            <label>Image Template</label>
            <select id="config-move-image-id">
              <option value="">Select image...</option>
            </select>
          </div>
          <div class="config-field">
            <button class="btn btn-secondary" id="btn-capture-move-image">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Capture New Image
            </button>
          </div>
          <div class="config-field">
            <label>Match Confidence: <span id="move-conf-value">${Math.round((action.imageConfidence || 0.9) * 100)}%</span></label>
            <input type="range" id="config-move-confidence" min="50" max="100" value="${Math.round((action.imageConfidence || 0.9) * 100)}">
            <p class="config-field-hint">Higher values require closer match</p>
          </div>
          <div class="config-field">
            <label class="checkbox-label">
              <input type="checkbox" id="config-move-search-region-enabled" ${action.searchRegion ? 'checked' : ''}>
              Limit search region
            </label>
            <p class="config-field-hint">Only search a portion of the screen (much faster)</p>
          </div>
          <div id="move-search-region-fields" ${!action.searchRegion ? 'style="display:none"' : ''}>
            <div class="config-field">
              <button class="btn btn-secondary" id="btn-pick-move-search-region">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
                  <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
                </svg>
                Pick Search Region
              </button>
            </div>
            <div class="config-field config-row" id="move-search-region-display" ${!action.searchRegion ? 'style="display:none"' : ''}>
              <div class="config-col">
                <label>X</label>
                <input type="number" id="config-msr-x" value="${action.searchRegion?.x ?? 0}" min="0">
              </div>
              <div class="config-col">
                <label>Y</label>
                <input type="number" id="config-msr-y" value="${action.searchRegion?.y ?? 0}" min="0">
              </div>
              <div class="config-col">
                <label>W</label>
                <input type="number" id="config-msr-w" value="${action.searchRegion?.width ?? 200}" min="1">
              </div>
              <div class="config-col">
                <label>H</label>
                <input type="number" id="config-msr-h" value="${action.searchRegion?.height ?? 200}" min="1">
              </div>
            </div>
          </div>
          <div class="config-field">
            <label class="checkbox-label">
              <input type="checkbox" id="config-move-scale-down" ${action.scaleDown ? 'checked' : ''}>
              Scale down for speed
            </label>
            <p class="config-field-hint">Reduces resolution before matching (faster but slightly less precise)</p>
          </div>
          <div class="config-field">
            <label class="checkbox-label">
              <input type="checkbox" id="config-move-fail-not-found" ${action.failOnNotFound ? 'checked' : ''}>
              Fail if image not found
            </label>
          </div>
        </div>
        <div class="config-field">
          <label>Movement Duration (ms)</label>
          <input type="number" id="config-duration" min="0" max="5000" value="${action.duration ?? ''}" placeholder="Use default">
          <p class="config-field-hint">Override global setting (leave empty for default)</p>
        </div>
      `;

      setupName();

      // Mode toggle
      configBody.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          action.moveMode = btn.dataset.mode;
          save();
          rerender();
        });
      });

      // Point mode fields
      document.getElementById('config-x').addEventListener('change', (e) => {
        action.x = parseInt(e.target.value) || 0;
        save();
      });

      document.getElementById('config-y').addEventListener('change', (e) => {
        action.y = parseInt(e.target.value) || 0;
        save();
      });

      document.getElementById('btn-pick-position').addEventListener('click', async () => {
        await pickPositionFromScreen((pos) => {
          document.getElementById('config-x').value = pos.x;
          document.getElementById('config-y').value = pos.y;
          action.x = pos.x;
          action.y = pos.y;
          save();
        });
      });

      // Bounds mode fields
      document.getElementById('config-bounds-x').addEventListener('change', (e) => {
        action.bounds = action.bounds || { x: 0, y: 0, width: 100, height: 100 };
        action.bounds.x = parseInt(e.target.value) || 0;
        save();
      });

      document.getElementById('config-bounds-y').addEventListener('change', (e) => {
        action.bounds = action.bounds || { x: 0, y: 0, width: 100, height: 100 };
        action.bounds.y = parseInt(e.target.value) || 0;
        save();
      });

      document.getElementById('config-bounds-w').addEventListener('change', (e) => {
        action.bounds = action.bounds || { x: 0, y: 0, width: 100, height: 100 };
        action.bounds.width = Math.max(1, parseInt(e.target.value) || 100);
        save();
      });

      document.getElementById('config-bounds-h').addEventListener('change', (e) => {
        action.bounds = action.bounds || { x: 0, y: 0, width: 100, height: 100 };
        action.bounds.height = Math.max(1, parseInt(e.target.value) || 100);
        save();
      });

      document.getElementById('btn-pick-bounds').addEventListener('click', async () => {
        await pickRegionFromScreen((region) => {
          action.bounds = { x: region.x, y: region.y, width: region.width, height: region.height };
          document.getElementById('config-bounds-x').value = region.x;
          document.getElementById('config-bounds-y').value = region.y;
          document.getElementById('config-bounds-w').value = region.width;
          document.getElementById('config-bounds-h').value = region.height;
          save();
        });
      });

      // Image mode fields
      loadImageOptions('config-move-image-id', action.imageId);

      document.getElementById('config-move-image-id').addEventListener('change', (e) => {
        action.imageId = e.target.value || null;
        save();
      });

      document.getElementById('btn-capture-move-image').addEventListener('click', () => {
        captureImageTemplate((imageId) => {
          action.imageId = imageId;
          loadImageOptions('config-move-image-id', imageId);
          save();
        });
      });

      document.getElementById('config-move-confidence').addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        document.getElementById('move-conf-value').textContent = val + '%';
        action.imageConfidence = val / 100;
        save();
      });

      document.getElementById('config-move-fail-not-found').addEventListener('change', (e) => {
        action.failOnNotFound = e.target.checked;
        save();
      });

      // Mouse move search region
      document.getElementById('config-move-search-region-enabled').addEventListener('change', (e) => {
        const fields = document.getElementById('move-search-region-fields');
        if (e.target.checked) {
          action.searchRegion = action.searchRegion || { x: 0, y: 0, width: 200, height: 200 };
          fields.style.display = '';
          document.getElementById('move-search-region-display').style.display = '';
        } else {
          action.searchRegion = null;
          fields.style.display = 'none';
        }
        save();
      });

      document.getElementById('btn-pick-move-search-region').addEventListener('click', async () => {
        await pickRegionFromScreen((region) => {
          action.searchRegion = { x: region.x, y: region.y, width: region.width, height: region.height };
          document.getElementById('config-msr-x').value = region.x;
          document.getElementById('config-msr-y').value = region.y;
          document.getElementById('config-msr-w').value = region.width;
          document.getElementById('config-msr-h').value = region.height;
          document.getElementById('move-search-region-display').style.display = '';
          save();
        });
      });

      ['config-msr-x', 'config-msr-y', 'config-msr-w', 'config-msr-h'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', (e) => {
          action.searchRegion = action.searchRegion || { x: 0, y: 0, width: 200, height: 200 };
          const key = { 'config-msr-x': 'x', 'config-msr-y': 'y', 'config-msr-w': 'width', 'config-msr-h': 'height' }[id];
          action.searchRegion[key] = Math.max(0, parseInt(e.target.value) || 0);
          save();
        });
      });

      // Mouse move scale down
      document.getElementById('config-move-scale-down').addEventListener('change', (e) => {
        action.scaleDown = e.target.checked;
        save();
      });

      document.getElementById('config-duration').addEventListener('change', (e) => {
        const val = e.target.value.trim();
        action.duration = val === '' ? undefined : parseInt(val);
        save();
      });
      break;

    case 'mouse_click':
      configBody.innerHTML = nameFieldHtml + `
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

      setupName();

      document.getElementById('config-button').addEventListener('change', (e) => {
        action.button = e.target.value;
        save();
      });

      document.getElementById('config-click-type').addEventListener('change', (e) => {
        action.clickType = e.target.value;
        save();
      });

      document.getElementById('config-click-x').addEventListener('change', (e) => {
        action.x = e.target.value ? parseInt(e.target.value) : undefined;
        save();
      });

      document.getElementById('config-click-y').addEventListener('change', (e) => {
        action.y = e.target.value ? parseInt(e.target.value) : undefined;
        save();
      });
      break;

    case 'keyboard':
      action.actions = action.actions || [];
      configBody.innerHTML = nameFieldHtml + `
        <div class="config-field">
          <label>Mode</label>
          <select id="config-kb-mode">
            <option value="type" ${action.mode === 'type' ? 'selected' : ''}>Type Text</option>
            <option value="press" ${action.mode === 'press' ? 'selected' : ''}>Press Key</option>
            <option value="hold_and_act" ${action.mode === 'hold_and_act' ? 'selected' : ''}>Hold Key + Actions</option>
          </select>
        </div>
        <div class="config-field" id="field-text" ${action.mode !== 'type' ? 'style="display:none"' : ''}>
          <label>Text to Type</label>
          <textarea id="config-text" rows="3">${action.text || ''}</textarea>
        </div>
        <div class="config-field" id="field-key" ${(action.mode !== 'press' && action.mode !== 'hold_and_act') ? 'style="display:none"' : ''}>
          <label>Key to ${action.mode === 'hold_and_act' ? 'Hold' : 'Press'}</label>
          <div class="key-recorder" id="key-recorder">
            <div class="key-recorder-display" id="key-recorder-display">
              ${action.key ? `<span class="key-badge">${escapeHtml(action.key)}</span>` : '<span class="key-recorder-placeholder">No key set</span>'}
            </div>
            <button class="btn btn-sm key-recorder-btn" id="key-recorder-btn" type="button">
              <span class="key-recorder-btn-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="3" fill="currentColor"/>
                </svg>
              </span>
              <span class="key-recorder-btn-label">Record Key</span>
            </button>
          </div>
          <input type="text" id="config-key" value="${action.key || ''}" placeholder="Or type manually: shift, ctrl+a" class="key-recorder-manual">
        </div>
        <div id="field-hold-actions" ${action.mode !== 'hold_and_act' ? 'style="display:none"' : ''}>
          <div class="config-section">
            <div class="config-section-header">
              <span>Actions while held: <span id="hold-actions-count">${action.actions.length}</span> actions</span>
              <button class="btn btn-secondary btn-sm" id="btn-edit-hold-actions">Edit</button>
            </div>
            <p class="config-field-hint">These actions run while the key is held down. The key is released after all actions complete.</p>
          </div>
        </div>
      `;

      setupName();

      const updateKbFieldVisibility = (mode) => {
        document.getElementById('field-text').style.display = mode === 'type' ? '' : 'none';
        document.getElementById('field-key').style.display = (mode === 'press' || mode === 'hold_and_act') ? '' : 'none';
        document.getElementById('field-hold-actions').style.display = mode === 'hold_and_act' ? '' : 'none';
        const keyLabel = document.querySelector('#field-key label');
        if (keyLabel) keyLabel.textContent = mode === 'hold_and_act' ? 'Key to Hold' : 'Key or Combo';
      };

      document.getElementById('config-kb-mode').addEventListener('change', (e) => {
        action.mode = e.target.value;
        if (e.target.value === 'hold_and_act' && !action.actions) {
          action.actions = [];
        }
        updateKbFieldVisibility(e.target.value);
        save();
      });

      document.getElementById('config-text').addEventListener('input', (e) => {
        action.text = e.target.value;
        save();
      });

      // Manual key input
      document.getElementById('config-key').addEventListener('change', (e) => {
        action.key = e.target.value;
        updateKeyRecorderDisplay(action.key);
        save();
      });

      // Key recorder
      setupKeyRecorder(action, save);

      document.getElementById('btn-edit-hold-actions')?.addEventListener('click', () => {
        openNestedActionsEditor(action, 'actions', 'Hold Key Actions', index);
      });
      break;

    case 'wait':
      configBody.innerHTML = nameFieldHtml + `
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

      setupName();

      document.getElementById('config-wait-min').addEventListener('change', (e) => {
        action.duration = action.duration || {};
        action.duration.min = parseInt(e.target.value) || 500;
        save();
      });

      document.getElementById('config-wait-max').addEventListener('change', (e) => {
        action.duration = action.duration || {};
        action.duration.max = parseInt(e.target.value) || 1000;
        save();
      });
      break;

    case 'conditional':
      renderConditionalConfig(configBody, action, index, nameFieldHtml, save);
      break;

    case 'loop':
      renderLoopConfig(configBody, action, index, nameFieldHtml, save);
      break;

    case 'image_detect':
      renderImageDetectConfig(configBody, action, index, nameFieldHtml, save);
      break;

    case 'pixel_detect':
      renderPixelDetectConfig(configBody, action, index, nameFieldHtml, save);
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
function renderConditionalConfig(configBody, action, index, nameFieldHtml = '', save) {
  if (!save) save = () => updateAction(index, action);
  action.condition = action.condition || { type: 'image_present' };
  action.thenActions = action.thenActions || [];
  action.elseActions = action.elseActions || [];

  configBody.innerHTML = nameFieldHtml + `
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
        <span>Then (if true): <span id="then-actions-count">${action.thenActions.length}</span> actions</span>
        <button class="btn btn-secondary btn-sm" id="btn-edit-then">Edit</button>
      </div>
    </div>
    <div class="config-section">
      <div class="config-section-header">
        <span>Else (if false): <span id="else-actions-count">${action.elseActions.length}</span> actions</span>
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

  const nameInput = document.getElementById('config-action-name');
  if (nameInput) {
    nameInput.addEventListener('input', (e) => {
      action.name = e.target.value.trim() || undefined;
      save();
    });
  }

  document.getElementById('config-condition-type').addEventListener('change', (e) => {
    action.condition.type = e.target.value;
    const isPixel = e.target.value === 'pixel_match';
    document.getElementById('cond-image-field').style.display = isPixel ? 'none' : '';
    document.getElementById('cond-confidence-field').style.display = isPixel ? 'none' : '';
    document.getElementById('cond-pixel-field').style.display = isPixel ? '' : 'none';
    document.getElementById('cond-tolerance-field').style.display = isPixel ? '' : 'none';
    save();
  });

  document.getElementById('config-condition-image').addEventListener('change', (e) => {
    action.condition.imageId = e.target.value || null;
    save();
  });

  document.getElementById('config-condition-confidence').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('cond-conf-value').textContent = val + '%';
    action.condition.confidence = val / 100;
    save();
  });

  document.getElementById('config-condition-color').addEventListener('change', (e) => {
    action.condition.color = hexToRgb(e.target.value);
    document.getElementById('cond-color-preview').style.background = e.target.value;
    save();
  });

  document.getElementById('config-condition-tolerance').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('cond-tol-value').textContent = val;
    action.condition.tolerance = val;
    save();
  });

  document.getElementById('btn-capture-cond-image').addEventListener('click', () => {
    captureImageTemplate((imageId) => {
      action.condition.imageId = imageId;
      loadImageOptions('config-condition-image', imageId);
      save();
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
    save();
  });
}

/**
 * Render Loop action config
 */
function renderLoopConfig(configBody, action, index, nameFieldHtml = '', save) {
  if (!save) save = () => updateAction(index, action);
  action.actions = action.actions || [];
  action.delay = action.delay || { min: 500, max: 1000 };

  configBody.innerHTML = nameFieldHtml + `
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-loop-infinite" ${action.infinite ? 'checked' : ''}>
        Infinite loop
      </label>
      <p class="config-field-hint">Loop forever until the workflow is stopped</p>
    </div>
    <div class="config-field" id="loop-count-field" ${action.infinite ? 'style="display:none"' : ''}>
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
        <span>Loop Actions: <span id="loop-actions-count">${action.actions.length}</span> actions</span>
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

  const nameInput = document.getElementById('config-action-name');
  if (nameInput) {
    nameInput.addEventListener('input', (e) => {
      action.name = e.target.value.trim() || undefined;
      save();
    });
  }

  document.getElementById('config-loop-infinite').addEventListener('change', (e) => {
    action.infinite = e.target.checked;
    document.getElementById('loop-count-field').style.display = e.target.checked ? 'none' : '';
    save();
  });

  document.getElementById('config-loop-count').addEventListener('change', (e) => {
    action.count = parseInt(e.target.value) || 3;
    save();
  });

  document.getElementById('config-loop-delay-min').addEventListener('change', (e) => {
    action.delay.min = parseInt(e.target.value) || 500;
    save();
  });

  document.getElementById('config-loop-delay-max').addEventListener('change', (e) => {
    action.delay.max = parseInt(e.target.value) || 1000;
    save();
  });

  document.getElementById('btn-edit-loop-actions').addEventListener('click', () => {
    openNestedActionsEditor(action, 'actions', 'Loop Actions', index);
  });

  document.getElementById('config-loop-continue-error').addEventListener('change', (e) => {
    action.continueOnError = e.target.checked;
    save();
  });
}

/**
 * Render Image Detect action config
 */
function renderImageDetectConfig(configBody, action, index, nameFieldHtml = '', save) {
  if (!save) save = () => updateAction(index, action);
  configBody.innerHTML = nameFieldHtml + `
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
        <input type="checkbox" id="config-wait-until-found" ${action.waitUntilFound ? 'checked' : ''}>
        Wait until found
      </label>
      <p class="config-field-hint">Keep checking until the image appears on screen</p>
    </div>
    <div class="config-field" id="poll-interval-field" ${!action.waitUntilFound ? 'style="display:none"' : ''}>
      <label>Check interval (ms)</label>
      <input type="number" id="config-poll-interval" min="100" max="30000" value="${action.pollInterval || 500}" placeholder="500">
      <p class="config-field-hint">How often to re-check for the image</p>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-search-region-enabled" ${action.searchRegion ? 'checked' : ''}>
        Limit search region
      </label>
      <p class="config-field-hint">Only search a portion of the screen (much faster)</p>
    </div>
    <div id="search-region-fields" ${!action.searchRegion ? 'style="display:none"' : ''}>
      <div class="config-field">
        <button class="btn btn-secondary" id="btn-pick-search-region">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
            <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
          </svg>
          Pick Search Region
        </button>
      </div>
      <div class="config-field config-row" id="search-region-display" ${!action.searchRegion ? 'style="display:none"' : ''}>
        <div class="config-col">
          <label>X</label>
          <input type="number" id="config-sr-x" value="${action.searchRegion?.x ?? 0}" min="0">
        </div>
        <div class="config-col">
          <label>Y</label>
          <input type="number" id="config-sr-y" value="${action.searchRegion?.y ?? 0}" min="0">
        </div>
        <div class="config-col">
          <label>W</label>
          <input type="number" id="config-sr-w" value="${action.searchRegion?.width ?? 200}" min="1">
        </div>
        <div class="config-col">
          <label>H</label>
          <input type="number" id="config-sr-h" value="${action.searchRegion?.height ?? 200}" min="1">
        </div>
      </div>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-scale-down" ${action.scaleDown ? 'checked' : ''}>
        Scale down for speed
      </label>
      <p class="config-field-hint">Reduces resolution before matching (faster but slightly less precise)</p>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-fail-not-found" ${action.failOnNotFound ? 'checked' : ''} ${action.waitUntilFound ? 'disabled' : ''}>
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

  const nameInput = document.getElementById('config-action-name');
  if (nameInput) {
    nameInput.addEventListener('input', (e) => {
      action.name = e.target.value.trim() || undefined;
      save();
    });
  }

  document.getElementById('config-image-id').addEventListener('change', (e) => {
    action.imageId = e.target.value || null;
    save();
    updateImagePreview(action.imageId);
  });

  document.getElementById('btn-capture-image').addEventListener('click', () => {
    captureImageTemplate((imageId) => {
      action.imageId = imageId;
      loadImageOptions('config-image-id', imageId);
      save();
      updateImagePreview(imageId);
    });
  });

  document.getElementById('config-confidence').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('conf-value').textContent = val + '%';
    action.confidence = val / 100;
    save();
  });

  document.getElementById('config-wait-until-found').addEventListener('change', (e) => {
    action.waitUntilFound = e.target.checked;
    const pollField = document.getElementById('poll-interval-field');
    const failCheckbox = document.getElementById('config-fail-not-found');
    if (pollField) pollField.style.display = e.target.checked ? '' : 'none';
    if (failCheckbox) failCheckbox.disabled = e.target.checked;
    if (e.target.checked) {
      action.failOnNotFound = false;
      if (failCheckbox) failCheckbox.checked = false;
    }
    save();
  });

  document.getElementById('config-poll-interval').addEventListener('change', (e) => {
    action.pollInterval = Math.max(100, parseInt(e.target.value) || 500);
    save();
  });

  document.getElementById('config-fail-not-found').addEventListener('change', (e) => {
    action.failOnNotFound = e.target.checked;
    save();
  });

  document.getElementById('config-img-continue-error').addEventListener('change', (e) => {
    action.continueOnError = e.target.checked;
    save();
  });

  // Search region
  document.getElementById('config-search-region-enabled').addEventListener('change', (e) => {
    const fields = document.getElementById('search-region-fields');
    if (e.target.checked) {
      action.searchRegion = action.searchRegion || { x: 0, y: 0, width: 200, height: 200 };
      fields.style.display = '';
      document.getElementById('search-region-display').style.display = '';
    } else {
      action.searchRegion = null;
      fields.style.display = 'none';
    }
    save();
  });

  document.getElementById('btn-pick-search-region').addEventListener('click', async () => {
    await pickRegionFromScreen((region) => {
      action.searchRegion = { x: region.x, y: region.y, width: region.width, height: region.height };
      document.getElementById('config-sr-x').value = region.x;
      document.getElementById('config-sr-y').value = region.y;
      document.getElementById('config-sr-w').value = region.width;
      document.getElementById('config-sr-h').value = region.height;
      document.getElementById('search-region-display').style.display = '';
      save();
    });
  });

  ['config-sr-x', 'config-sr-y', 'config-sr-w', 'config-sr-h'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', (e) => {
      action.searchRegion = action.searchRegion || { x: 0, y: 0, width: 200, height: 200 };
      const key = { 'config-sr-x': 'x', 'config-sr-y': 'y', 'config-sr-w': 'width', 'config-sr-h': 'height' }[id];
      action.searchRegion[key] = Math.max(0, parseInt(e.target.value) || 0);
      save();
    });
  });

  // Scale down
  document.getElementById('config-scale-down').addEventListener('change', (e) => {
    action.scaleDown = e.target.checked;
    save();
  });

  // Show preview if image selected
  if (action.imageId) {
    updateImagePreview(action.imageId);
  }
}

/**
 * Render Pixel Detect action config
 */
function renderPixelDetectConfig(configBody, action, index, nameFieldHtml = '', save) {
  if (!save) save = () => updateAction(index, action);
  action.color = action.color || { r: 255, g: 0, b: 0 };

  configBody.innerHTML = nameFieldHtml + `
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

  const nameInput = document.getElementById('config-action-name');
  if (nameInput) {
    nameInput.addEventListener('input', (e) => {
      action.name = e.target.value.trim() || undefined;
      save();
    });
  }

  const updateColorFromHex = (hex) => {
    action.color = hexToRgb(hex);
    document.getElementById('color-preview').style.background = hex;
    document.getElementById('config-pixel-r').value = action.color.r;
    document.getElementById('config-pixel-g').value = action.color.g;
    document.getElementById('config-pixel-b').value = action.color.b;
    save();
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
    save();
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
      save();
    });
  });

  document.getElementById('config-tolerance').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('tol-value').textContent = val;
    action.tolerance = val;
    save();
  });

  document.getElementById('config-pixel-fail-not-found').addEventListener('change', (e) => {
    action.failOnNotFound = e.target.checked;
    save();
  });

  document.getElementById('config-pixel-continue-error').addEventListener('change', (e) => {
    action.continueOnError = e.target.checked;
    save();
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

    // Group by folder
    const uncategorized = images.filter(i => !i.folder);
    const folderMap = {};
    images.forEach(img => {
      if (img.folder) {
        if (!folderMap[img.folder]) folderMap[img.folder] = [];
        folderMap[img.folder].push(img);
      }
    });

    // Render uncategorized first
    uncategorized.forEach(img => {
      const option = document.createElement('option');
      option.value = img.id;
      option.textContent = img.id;
      if (img.id === selectedId) option.selected = true;
      select.appendChild(option);
    });

    // Render each folder as an optgroup
    Object.keys(folderMap).sort().forEach(folder => {
      const group = document.createElement('optgroup');
      group.label = folder;
      folderMap[folder].forEach(img => {
        const option = document.createElement('option');
        option.value = img.id;
        option.textContent = img.id;
        if (img.id === selectedId) option.selected = true;
        group.appendChild(option);
      });
      select.appendChild(group);
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

    // Open region selection overlay (includes preview/confirm/redo loop)
    const result = await window.workflowAPI.captureRegionTemplate();

    // Restore the main window
    await window.workflowAPI.restoreWindow();

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
    // Restore window even on error
    try { await window.workflowAPI.restoreWindow(); } catch (e) { /* ignore */ }
  }
}

/**
 * Open nested actions editor modal
 */
function openNestedActionsEditor(parentAction, actionsKey, title, parentIndex) {
  const nestedActions = parentAction[actionsKey] || [];
  const mainActions = state.currentWorkflow ? state.currentWorkflow.actions : [];
  const templates = editorState.templates || [];

  showModal(
    title,
    `
      <div class="nested-editor">
        <div class="nested-toolbar">
          <button class="btn btn-secondary" id="btn-nested-quick-record" title="Quick Record into this branch">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="3" fill="currentColor"/>
            </svg>
            Quick Record
          </button>
          <span class="nested-drop-hint">Drag actions here from main sequence</span>
        </div>
        <div class="nested-actions-list" id="nested-actions-list" data-parent-index="${parentIndex}" data-actions-key="${actionsKey}">
          ${nestedActions.length === 0 ? '<p class="empty-nested" id="empty-nested-msg">No actions yet. Add actions below or drag from main sequence.</p>' : ''}
          ${nestedActions.map((action, i) => `
            <div class="nested-action-item" data-index="${i}" draggable="true">
              <span class="nested-drag-handle">⋮⋮</span>
              <span class="nested-num">${i + 1}</span>
              <span class="nested-name">${action.name ? escapeHtml(action.name) : (ACTION_TYPES[action.type]?.name || action.type)}</span>
              <span class="nested-summary">${getActionSummary(action)}</span>
              <button class="btn btn-icon btn-sm" data-edit="${i}" title="Edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="btn btn-icon btn-danger btn-sm" data-delete="${i}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          `).join('')}
        </div>
        <div class="nested-add-tabs">
          <div class="nested-tab-bar">
            <button class="nested-tab active" data-tab="new">New Action</button>
            <button class="nested-tab" data-tab="workflow">From Workflow</button>
            <button class="nested-tab" data-tab="templates">Templates</button>
          </div>
          <div class="nested-tab-content" id="nested-tab-new">
            <div class="nested-add-row">
              <select id="nested-action-type">
                ${Object.entries(ACTION_TYPES).map(([type, meta]) => `
                  <option value="${type}">${meta.name}</option>
                `).join('')}
              </select>
              <button class="btn btn-primary" id="btn-add-nested">Add</button>
            </div>
          </div>
          <div class="nested-tab-content hidden" id="nested-tab-workflow">
            ${mainActions.length === 0 ? '<p class="empty-nested">No actions in workflow</p>' : `
              <div class="nested-source-list">
                ${mainActions.map((action, i) => {
                  if (i === parentIndex) return '';
                  return `
                    <div class="nested-source-item" data-workflow-index="${i}">
                      <span class="nested-num">${i + 1}</span>
                      <span class="nested-name">${action.name ? escapeHtml(action.name) : (ACTION_TYPES[action.type]?.name || action.type)}</span>
                      <span class="nested-summary">${getActionSummary(action)}</span>
                      <div class="nested-source-btns">
                        <button class="btn btn-secondary btn-sm" data-copy-index="${i}" title="Copy into this branch">Copy</button>
                        <button class="btn btn-primary btn-sm" data-move-index="${i}" title="Move into this branch (removes from main)">Move</button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
          <div class="nested-tab-content hidden" id="nested-tab-templates">
            ${templates.length === 0 ? '<p class="empty-nested">No saved templates</p>' : `
              <div class="nested-source-list">
                ${templates.map(t => `
                  <div class="nested-source-item" data-template-id="${t.id}">
                    <span class="nested-name">${escapeHtml(t.name)}</span>
                    <span class="nested-summary">${t.actions.length} actions</span>
                    <button class="btn btn-primary btn-sm" data-insert-template="${t.id}">Insert</button>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      </div>
    `,
    [
      { label: 'Done', primary: true, action: 'close', onClick: () => updateNestedActionCounts(parentAction, actionsKey) }
    ]
  );

  // Tab switching
  document.querySelectorAll('.nested-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nested-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.nested-tab-content').forEach(c => c.classList.add('hidden'));
      tab.classList.add('active');
      document.getElementById(`nested-tab-${tab.dataset.tab}`).classList.remove('hidden');
    });
  });

  // Add new action handler
  document.getElementById('btn-add-nested').addEventListener('click', () => {
    const type = document.getElementById('nested-action-type').value;
    const newAction = createDefaultAction(type);
    parentAction[actionsKey] = parentAction[actionsKey] || [];
    parentAction[actionsKey].push(newAction);
    updateAction(parentIndex, parentAction);
    openNestedActionsEditor(parentAction, actionsKey, title, parentIndex);
  });

  // Copy from workflow handlers
  document.querySelectorAll('[data-copy-index]').forEach(btn => {
    btn.addEventListener('click', () => {
      const srcIndex = parseInt(btn.dataset.copyIndex);
      const srcAction = mainActions[srcIndex];
      if (!srcAction) return;
      const copy = JSON.parse(JSON.stringify(srcAction));
      copy.id = generateId();
      parentAction[actionsKey] = parentAction[actionsKey] || [];
      parentAction[actionsKey].push(copy);
      updateAction(parentIndex, parentAction);
      openNestedActionsEditor(parentAction, actionsKey, title, parentIndex);
    });
  });

  // Move from workflow handlers
  document.querySelectorAll('[data-move-index]').forEach(btn => {
    btn.addEventListener('click', () => {
      const srcIndex = parseInt(btn.dataset.moveIndex);
      const [movedAction] = mainActions.splice(srcIndex, 1);
      parentAction[actionsKey] = parentAction[actionsKey] || [];
      parentAction[actionsKey].push(movedAction);
      // Recalculate parentIndex since we removed an item from main
      const newParentIndex = srcIndex < parentIndex ? parentIndex - 1 : parentIndex;
      updateAction(newParentIndex, parentAction);
      renderActionSequence();
      openNestedActionsEditor(parentAction, actionsKey, title, newParentIndex);
    });
  });

  // Insert template handlers
  document.querySelectorAll('[data-insert-template]').forEach(btn => {
    btn.addEventListener('click', () => {
      const templateId = btn.dataset.insertTemplate;
      const template = templates.find(t => t.id === templateId);
      if (!template) return;
      const copiedActions = template.actions.map(a => {
        const copy = JSON.parse(JSON.stringify(a));
        copy.id = generateId();
        return copy;
      });
      parentAction[actionsKey] = parentAction[actionsKey] || [];
      parentAction[actionsKey].push(...copiedActions);
      updateAction(parentIndex, parentAction);
      openNestedActionsEditor(parentAction, actionsKey, title, parentIndex);
    });
  });

  // Quick Record handler
  document.getElementById('btn-nested-quick-record').addEventListener('click', async () => {
    window._nestedQuickRecordTarget = {
      parentAction,
      actionsKey,
      parentIndex,
      title
    };
    
    hideModal();
    
    if (window.quickRecord) {
      window.quickRecord.startForNested(parentAction, actionsKey, parentIndex, title);
    }
  });

  // Scope all queries to the nested actions list
  const nestedList = document.getElementById('nested-actions-list');

  // Edit handlers
  if (nestedList) {
    nestedList.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.edit);
        const nestedAction = parentAction[actionsKey][idx];
        if (nestedAction) {
          openNestedActionConfig(nestedAction, idx, parentAction, actionsKey, title, parentIndex);
        }
      });
    });

    // Delete handlers
    nestedList.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.delete);
        parentAction[actionsKey].splice(idx, 1);
        updateAction(parentIndex, parentAction);
        openNestedActionsEditor(parentAction, actionsKey, title, parentIndex);
      });
    });
  }

  // Setup drag/drop for nested items
  setupNestedDragDrop(parentAction, actionsKey, parentIndex, title);
}

/**
 * Open config editor for a single nested action (uses shared renderConfigFields)
 */
function openNestedActionConfig(action, nestedIndex, parentAction, actionsKey, parentTitle, parentIndex) {
  const meta = ACTION_TYPES[action.type] || { name: 'Action' };

  showModal(
    `Edit ${meta.name} (#${nestedIndex + 1} in ${parentTitle})`,
    `<div id="nested-config-body" class="nested-config-panel"></div>`,
    [
      { label: 'Back', class: 'btn-secondary', onClick: () => {
        updateAction(parentIndex, parentAction);
        setTimeout(() => openNestedActionsEditor(parentAction, actionsKey, parentTitle, parentIndex), 50);
      }, closeOnClick: true },
      { label: 'Done', primary: true, action: 'close', onClick: () => {
        updateAction(parentIndex, parentAction);
        updateNestedActionCounts(parentAction, actionsKey);
      }}
    ]
  );

  const configBody = document.getElementById('nested-config-body');
  if (!configBody) return;

  const save = () => updateAction(parentIndex, parentAction);
  renderConfigFields(action, parentIndex, configBody, save);
}

/**
 * Update the action counts displayed in the config panel for conditionals/loops
 */
function updateNestedActionCounts(parentAction, actionsKey) {
  const count = (parentAction[actionsKey] || []).length;

  // Map of actionsKey → possible element IDs that display the count
  const countElementIds = {
    thenActions: ['then-actions-count'],
    elseActions: ['else-actions-count'],
    actions: ['loop-actions-count', 'hold-actions-count']
  };

  const ids = countElementIds[actionsKey] || [];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) el.textContent = count;
  }
}

/**
 * Setup drag/drop for nested actions list
 */
function setupNestedDragDrop(parentAction, actionsKey, parentIndex, title) {
  const list = document.getElementById('nested-actions-list');
  if (!list) return;

  let draggedIndex = null;
  let dragAllowed = false;

  // Reset drag flag on any mouseup
  document.addEventListener('mouseup', () => { dragAllowed = false; }, { once: false });

  // Make items draggable for reordering - only from drag handle
  list.querySelectorAll('.nested-action-item').forEach(item => {
    // Track mousedown on drag handle to allow drag
    const handle = item.querySelector('.nested-drag-handle');
    if (handle) {
      handle.addEventListener('mousedown', () => { dragAllowed = true; });
    }

    item.addEventListener('dragstart', (e) => {
      // Only allow drag if initiated from the handle
      if (!dragAllowed) {
        e.preventDefault();
        return;
      }
      dragAllowed = false;
      draggedIndex = parseInt(item.dataset.index);
      item.classList.add('dragging');
      e.dataTransfer.setData('text/plain', JSON.stringify({
        type: 'nested-action',
        index: draggedIndex,
        parentIndex,
        actionsKey
      }));
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      draggedIndex = null;
      dragAllowed = false;
      list.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      const targetIndex = parseInt(item.dataset.index);
      if (draggedIndex !== null && targetIndex !== draggedIndex) {
        item.classList.add('drag-over');
      }
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      
      const targetIndex = parseInt(item.dataset.index);
      
      // Check if dropping from main sequence
      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (data.type === 'main-action') {
          // Moving from main sequence to nested
          const mainActions = state.currentWorkflow.actions;
          const [movedAction] = mainActions.splice(data.index, 1);
          parentAction[actionsKey] = parentAction[actionsKey] || [];
          parentAction[actionsKey].splice(targetIndex, 0, movedAction);
          updateAction(parentIndex, parentAction);
          renderActionSequence();
          openNestedActionsEditor(parentAction, actionsKey, title, parentIndex);
          return;
        }
      } catch (err) {}
      
      // Reordering within nested list
      if (draggedIndex !== null && draggedIndex !== targetIndex) {
        const actions = parentAction[actionsKey];
        const [moved] = actions.splice(draggedIndex, 1);
        actions.splice(targetIndex, 0, moved);
        updateAction(parentIndex, parentAction);
        openNestedActionsEditor(parentAction, actionsKey, title, parentIndex);
      }
    });
  });

  // Allow dropping on the list itself (for empty list or end of list)
  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    list.classList.add('drag-over');
  });

  list.addEventListener('dragleave', (e) => {
    if (!list.contains(e.relatedTarget)) {
      list.classList.remove('drag-over');
    }
  });

  list.addEventListener('drop', (e) => {
    e.preventDefault();
    list.classList.remove('drag-over');
    
    // Check if dropping from main sequence
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.type === 'main-action') {
        const mainActions = state.currentWorkflow.actions;
        const [movedAction] = mainActions.splice(data.index, 1);
        parentAction[actionsKey] = parentAction[actionsKey] || [];
        parentAction[actionsKey].push(movedAction);
        updateAction(parentIndex, parentAction);
        renderActionSequence();
        openNestedActionsEditor(parentAction, actionsKey, title, parentIndex);
      }
    } catch (err) {}
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
 * Pick a rectangular region from screen using overlay
 */
async function pickRegionFromScreen(callback) {
  try {
    const region = await window.workflowAPI.selectScreenRegion();

    if (!region) {
      showToast('info', 'Cancelled', 'Region selection cancelled');
      return;
    }

    showToast('success', 'Region Captured', `(${region.x}, ${region.y}) ${region.width}×${region.height}`);

    if (callback) {
      callback(region);
    }
  } catch (error) {
    console.error('Region capture failed:', error);
    showToast('error', 'Error', 'Failed to capture region');
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

// ==================== TEMPLATES ====================

/**
 * Load all templates
 */
async function loadTemplates() {
  try {
    editorState.templates = await window.workflowAPI.getTemplates();
    renderTemplateList();
  } catch (error) {
    console.error('Failed to load templates:', error);
  }
}

/**
 * Render the template list in the sidebar
 */
function renderTemplateList() {
  if (!templateList) return;

  const emptyEl = document.getElementById('empty-templates');

  if (editorState.templates.length === 0) {
    templateList.innerHTML = '';
    if (emptyEl) {
      emptyEl.style.display = '';
      templateList.appendChild(emptyEl);
    }
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  templateList.innerHTML = editorState.templates.map(template => `
    <div class="template-item" data-template-id="${template.id}" draggable="true">
      <div class="template-item-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <path d="M3 9h18"/>
          <path d="M9 21V9"/>
        </svg>
      </div>
      <div class="template-item-info">
        <div class="template-item-name">${escapeHtml(template.name)}</div>
        <div class="template-item-meta">${template.actions.length} actions</div>
      </div>
      <div class="template-item-actions">
        <button class="btn btn-icon btn-sm" data-action="rename" title="Rename">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="btn btn-icon btn-danger btn-sm" data-action="delete" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

  // Add event listeners
  templateList.querySelectorAll('.template-item').forEach(item => {
    const templateId = item.dataset.templateId;

    // Double click to insert
    item.addEventListener('dblclick', () => {
      insertTemplateIntoWorkflow(templateId);
    });

    // Drag to insert
    item.addEventListener('dragstart', (e) => {
      editorState.draggedAction = { templateId, isTemplate: true };
      e.dataTransfer.effectAllowed = 'copy';
      item.classList.add('dragging');
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      editorState.draggedAction = null;
    });

    // Rename button
    item.querySelector('[data-action="rename"]').addEventListener('click', (e) => {
      e.stopPropagation();
      openRenameTemplateModal(templateId);
    });

    // Delete button
    item.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTemplate(templateId);
    });
  });
}

/**
 * Open modal to save selected actions as template
 */
function openSaveAsTemplateModal() {
  if (!state.currentWorkflow || !state.currentWorkflow.actions || state.currentWorkflow.actions.length === 0) {
    showToast('warning', 'No Actions', 'Add some actions to the workflow first');
    return;
  }

  const actions = state.currentWorkflow.actions;

  showModal(
    'Save as Template',
    `
      <div class="config-field">
        <label>Template Name</label>
        <input type="text" id="template-name" placeholder="My Template" value="">
      </div>
      <div class="config-field">
        <label>Description (optional)</label>
        <textarea id="template-description" rows="2" placeholder="What does this template do?"></textarea>
      </div>
      <div class="config-field">
        <label>Select Actions to Include</label>
        <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: var(--space-2);">
          ${actions.map((action, i) => `
            <label class="checkbox-label" style="padding: var(--space-1) 0;">
              <input type="checkbox" class="template-action-checkbox" data-index="${i}" checked>
              <span>${i + 1}. ${action.name ? escapeHtml(action.name) + ' - ' : ''}${ACTION_TYPES[action.type]?.name || action.type}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `,
    [
      { label: 'Cancel', class: 'btn-secondary', action: 'close' },
      { label: 'Save Template', primary: true, onClick: saveAsTemplate }
    ]
  );

  document.getElementById('template-name').focus();
}

/**
 * Save selected actions as a new template
 */
async function saveAsTemplate() {
  const name = document.getElementById('template-name').value.trim();
  const description = document.getElementById('template-description').value.trim();

  if (!name) {
    showToast('error', 'Error', 'Please enter a template name');
    return;
  }

  const checkboxes = document.querySelectorAll('.template-action-checkbox:checked');
  const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));

  if (selectedIndices.length === 0) {
    showToast('error', 'Error', 'Please select at least one action');
    return;
  }

  // Deep copy selected actions with new IDs
  const selectedActions = selectedIndices.map(i => {
    const action = JSON.parse(JSON.stringify(state.currentWorkflow.actions[i]));
    action.id = generateId(); // Generate new ID for the copy
    return action;
  });

  try {
    const template = await window.workflowAPI.createTemplate({
      name,
      description,
      actions: selectedActions
    });

    editorState.templates.push(template);
    renderTemplateList();
    closeModal();
    showToast('success', 'Template Saved', `"${name}" saved with ${selectedActions.length} actions`);
  } catch (error) {
    console.error('Failed to save template:', error);
    showToast('error', 'Error', 'Failed to save template');
  }
}

/**
 * Insert a template's actions into the current workflow (as copies)
 */
async function insertTemplateIntoWorkflow(templateId, insertIndex = -1) {
  if (!state.currentWorkflow) {
    showToast('warning', 'No Workflow', 'Open a workflow first');
    return;
  }

  const template = editorState.templates.find(t => t.id === templateId);
  if (!template) {
    showToast('error', 'Error', 'Template not found');
    return;
  }

  // Deep copy actions with new IDs
  const copiedActions = template.actions.map(action => {
    const copy = JSON.parse(JSON.stringify(action));
    copy.id = generateId();
    return copy;
  });

  if (insertIndex === -1 || insertIndex >= state.currentWorkflow.actions.length) {
    state.currentWorkflow.actions.push(...copiedActions);
  } else {
    state.currentWorkflow.actions.splice(insertIndex, 0, ...copiedActions);
  }

  markDirty();
  renderActionSequence();
  saveCurrentWorkflow();
  showToast('success', 'Template Inserted', `Added ${copiedActions.length} actions from "${template.name}"`);
}

/**
 * Open modal to rename a template
 */
function openRenameTemplateModal(templateId) {
  const template = editorState.templates.find(t => t.id === templateId);
  if (!template) return;

  showModal(
    'Rename Template',
    `
      <div class="config-field">
        <label>Template Name</label>
        <input type="text" id="rename-template-name" value="${escapeHtml(template.name)}">
      </div>
    `,
    [
      { label: 'Cancel', class: 'btn-secondary', action: 'close' },
      { label: 'Save', primary: true, onClick: () => renameTemplate(templateId) }
    ]
  );

  const input = document.getElementById('rename-template-name');
  input.focus();
  input.select();
}

/**
 * Rename a template
 */
async function renameTemplate(templateId) {
  const name = document.getElementById('rename-template-name').value.trim();

  if (!name) {
    showToast('error', 'Error', 'Please enter a name');
    return;
  }

  try {
    const updated = await window.workflowAPI.updateTemplate(templateId, { name });
    const index = editorState.templates.findIndex(t => t.id === templateId);
    if (index !== -1) {
      editorState.templates[index] = updated;
    }
    renderTemplateList();
    closeModal();
    showToast('success', 'Renamed', `Template renamed to "${name}"`);
  } catch (error) {
    console.error('Failed to rename template:', error);
    showToast('error', 'Error', 'Failed to rename template');
  }
}

/**
 * Delete a template
 */
async function deleteTemplate(templateId) {
  const template = editorState.templates.find(t => t.id === templateId);
  if (!template) return;

  showModal(
    'Delete Template',
    `<p>Are you sure you want to delete "${escapeHtml(template.name)}"?</p>
     <p style="color: var(--text-secondary); font-size: var(--text-sm);">This action cannot be undone.</p>`,
    [
      { label: 'Cancel', class: 'btn-secondary', action: 'close' },
      { label: 'Delete', class: 'btn-danger', onClick: async () => {
        try {
          await window.workflowAPI.deleteTemplate(templateId);
          editorState.templates = editorState.templates.filter(t => t.id !== templateId);
          renderTemplateList();
          closeModal();
          showToast('success', 'Deleted', 'Template deleted');
        } catch (error) {
          console.error('Failed to delete template:', error);
          showToast('error', 'Error', 'Failed to delete template');
        }
      }}
    ]
  );
}

/**
 * Setup the key recorder widget for keyboard action config.
 * Listens for real keydown events and builds a combo string (e.g. "ctrl+shift+a").
 */
function setupKeyRecorder(action, save) {
  const recorder = document.getElementById('key-recorder');
  const btn = document.getElementById('key-recorder-btn');
  const display = document.getElementById('key-recorder-display');
  const manualInput = document.getElementById('config-key');
  if (!recorder || !btn) return;

  let isRecording = false;
  let heldKeys = new Set();
  let keydownHandler = null;
  let keyupHandler = null;

  const KEY_DISPLAY_MAP = {
    'Control': 'ctrl',
    'Shift': 'shift',
    'Alt': 'alt',
    'Meta': 'cmd',
    'Enter': 'enter',
    'Backspace': 'backspace',
    'Delete': 'delete',
    'Escape': 'escape',
    'Tab': 'tab',
    'ArrowUp': 'up',
    'ArrowDown': 'down',
    'ArrowLeft': 'left',
    'ArrowRight': 'right',
    'CapsLock': 'capslock',
    ' ': 'space',
    'Home': 'home',
    'End': 'end',
    'PageUp': 'pageup',
    'PageDown': 'pagedown',
    'Insert': 'insert'
  };

  function normalizeKey(e) {
    if (KEY_DISPLAY_MAP[e.key]) return KEY_DISPLAY_MAP[e.key];
    if (e.key.length === 1) return e.key.toLowerCase();
    if (e.key.startsWith('F') && !isNaN(e.key.slice(1))) return e.key.toLowerCase();
    return e.key.toLowerCase();
  }

  function buildCombo() {
    const order = ['ctrl', 'alt', 'shift', 'cmd'];
    const modifiers = [];
    const others = [];
    for (const k of heldKeys) {
      if (order.includes(k)) modifiers.push(k);
      else others.push(k);
    }
    modifiers.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return [...modifiers, ...others].join('+');
  }

  function startRecording() {
    isRecording = true;
    heldKeys.clear();
    recorder.classList.add('recording');
    btn.querySelector('.key-recorder-btn-label').textContent = 'Press a key...';
    display.innerHTML = '<span class="key-recorder-listening">Listening<span class="key-recorder-dots"><span>.</span><span>.</span><span>.</span></span></span>';

    keydownHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const key = normalizeKey(e);
      if (key === 'escape') {
        stopRecording(false);
        return;
      }
      heldKeys.add(key);
      // Live preview of held keys
      const combo = buildCombo();
      display.innerHTML = combo.split('+').map(k =>
        `<span class="key-badge key-badge-live">${escapeHtml(k)}</span>`
      ).join('<span class="key-badge-separator">+</span>');
    };

    keyupHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      // On first key release, finalize the combo
      if (heldKeys.size > 0) {
        const combo = buildCombo();
        action.key = combo;
        manualInput.value = combo;
        save();
        stopRecording(true);
      }
    };

    document.addEventListener('keydown', keydownHandler, true);
    document.addEventListener('keyup', keyupHandler, true);
  }

  function stopRecording(success) {
    isRecording = false;
    recorder.classList.remove('recording');
    btn.querySelector('.key-recorder-btn-label').textContent = 'Record Key';

    if (keydownHandler) document.removeEventListener('keydown', keydownHandler, true);
    if (keyupHandler) document.removeEventListener('keyup', keyupHandler, true);
    keydownHandler = null;
    keyupHandler = null;

    if (success) {
      updateKeyRecorderDisplay(action.key);
      // Brief success flash
      recorder.classList.add('recorded');
      setTimeout(() => recorder.classList.remove('recorded'), 600);
    } else {
      updateKeyRecorderDisplay(action.key);
    }
    heldKeys.clear();
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (isRecording) {
      stopRecording(false);
    } else {
      startRecording();
    }
  });
}

/**
 * Update the key recorder display with key badges
 */
function updateKeyRecorderDisplay(key) {
  const display = document.getElementById('key-recorder-display');
  if (!display) return;

  if (!key) {
    display.innerHTML = '<span class="key-recorder-placeholder">No key set</span>';
    return;
  }

  display.innerHTML = key.split('+').map(k =>
    `<span class="key-badge">${escapeHtml(k.trim())}</span>`
  ).join('<span class="key-badge-separator">+</span>');
}

/**
 * Helper: Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
