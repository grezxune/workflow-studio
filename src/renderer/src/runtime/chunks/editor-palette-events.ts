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

  // Infinite loop toggle for main workflow thread
  loopInfiniteInput.addEventListener('change', () => {
    if (state.currentWorkflow) {
      state.currentWorkflow.infiniteLoop = loopInfiniteInput.checked;
      loopCountInput.disabled = loopInfiniteInput.checked;
      markDirty();
      saveCurrentWorkflow();
    }
  });

  // Loop settings
  [loopCountInput, loopDelayMinInput, loopDelayMaxInput].forEach(input => {
    input.addEventListener('change', () => {
      if (state.currentWorkflow) {
        state.currentWorkflow.loopCount = parseInt(loopCountInput.value) || 1;
        state.currentWorkflow.loopDelay = {
          min: readDurationMs('loop-delay-min') ?? 500,
          max: readDurationMs('loop-delay-max') ?? 1000
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
  document.getElementById('btn-save-workflow').addEventListener('click', manualSaveWorkflow);

  // Ctrl+S to save
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      manualSaveWorkflow();
    }
  });

  // Config panel close
  document.getElementById('btn-close-config').addEventListener('click', closeConfigPanel);

  // Save as template button
  document.getElementById('btn-save-as-template').addEventListener('click', openSaveAsTemplateModal);
  workflowVariablesBtn?.addEventListener('click', openWorkflowVariablesModal);
}

