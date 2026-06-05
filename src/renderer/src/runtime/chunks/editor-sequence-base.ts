/**
 * Load a workflow into the editor
 */
function loadWorkflowIntoEditor(workflow) {
  normalizeWorkflowVariables(workflow);
  state.currentWorkflow = workflow;
  editorState.selectedActionIndex = -1;
  editorState.isDirty = false;

  // Set form values
  workflowNameInput.value = workflow.name || 'Untitled Workflow';
  loopInfiniteInput.checked = !!workflow.infiniteLoop;
  loopCountInput.value = workflow.loopCount || 1;
  loopCountInput.disabled = !!workflow.infiniteLoop;
  setDurationRangeMs('loop-delay-min', 'loop-delay-max', workflow.loopDelay?.min ?? 500, workflow.loopDelay?.max ?? 1000);

  updateVariablesBadge();

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
        <p>Drag an action from the left to start building</p>
        <span class="empty-sequence-hint">or double-click any action · then press the green Run button</span>
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

