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
  isAIGenerating: false,
  templates: [],
  selectedActionIndices: [], // For multi-select when saving templates
  compactView: false
};

// DOM references
let actionList = null;
let actionSequence = null;
let workflowNameInput = null;
let loopCountInput = null;
let loopInfiniteInput = null;
let loopDelayMinInput = null;
let loopDelayMaxInput = null;
let configPanel = null;
let templateList = null;
let toggleViewBtn = null;
let toggleAIBtn = null;
let aiComposer = null;
let aiGameSelect = null;
let aiModelSelect = null;
let aiApplyModeSelect = null;
let aiPromptInput = null;
let aiGenerateBtn = null;
let aiComposerMeta = null;
let aiContextPill = null;

/**
 * Initialize editor view
 */
function initEditorView() {
  actionList = document.getElementById('action-list');
  actionSequence = document.getElementById('action-sequence');
  workflowNameInput = document.getElementById('workflow-name');
  loopCountInput = document.getElementById('loop-count');
  loopInfiniteInput = document.getElementById('loop-infinite');
  loopDelayMinInput = document.getElementById('loop-delay-min');
  loopDelayMaxInput = document.getElementById('loop-delay-max');
  configPanel = document.getElementById('config-panel');
  templateList = document.getElementById('template-list');
  toggleViewBtn = document.getElementById('btn-toggle-view');
  toggleAIBtn = document.getElementById('btn-toggle-ai');
  aiComposer = document.getElementById('ai-composer');
  aiGameSelect = document.getElementById('ai-game-select');
  aiModelSelect = document.getElementById('ai-model-select');
  aiApplyModeSelect = document.getElementById('ai-apply-mode');
  aiPromptInput = document.getElementById('ai-prompt-input');
  aiGenerateBtn = document.getElementById('btn-ai-generate');
  aiComposerMeta = document.getElementById('ai-composer-meta');
  aiContextPill = document.getElementById('ai-context-pill');

  // Populate action palette
  populateActionPalette();

  // Setup event listeners
  setupEditorEvents();

  // Setup view toggle
  setupViewToggle();

  // Setup preview overlay
  setupPreviewOverlay();

  // Setup AI composer
  initAIComposer();

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
 * Initialize AI composer controls in editor.
 */
async function initAIComposer() {
  if (!aiGenerateBtn || !aiGameSelect || !aiModelSelect) return;

  initAIComposerVisibility();
  syncAIComposerFromSettings();
  await loadAISupportedGames();

  aiGameSelect.addEventListener('change', updateAIContextPill);
  aiGenerateBtn.addEventListener('click', handleAIGenerateWorkflow);
  toggleAIBtn?.addEventListener('click', () => toggleAIComposerVisibility());
  aiPromptInput?.addEventListener('keydown', async (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      await handleAIGenerateWorkflow();
    }
  });

  window.addEventListener('settings:updated', () => {
    syncAIComposerFromSettings();
  });
}

function initAIComposerVisibility() {
  const storedValue = safeGetLocalStorage('editor.aiComposerCollapsed');
  const shouldCollapse = storedValue === null ? true : storedValue === 'true';
  toggleAIComposerVisibility(!shouldCollapse, false);
}

function toggleAIComposerVisibility(forceExpanded, persist = true) {
  if (!aiComposer) return;
  const expanded = typeof forceExpanded === 'boolean'
    ? forceExpanded
    : aiComposer.classList.contains('collapsed');

  aiComposer.classList.toggle('collapsed', !expanded);
  if (toggleAIBtn) {
    toggleAIBtn.classList.toggle('active', expanded);
    toggleAIBtn.setAttribute('aria-expanded', String(expanded));
    toggleAIBtn.title = expanded ? 'Hide AI Draft Panel' : 'Show AI Draft Panel';
  }

  if (persist) {
    safeSetLocalStorage('editor.aiComposerCollapsed', String(!expanded));
  }
}

async function loadAISupportedGames() {
  try {
    const supported = await window.workflowAPI.getAISupportedGames();
    if (!Array.isArray(supported) || supported.length === 0) {
      updateAIContextPill();
      return;
    }

    const existing = new Set(Array.from(aiGameSelect.options).map((option) => option.value));
    supported.forEach((game) => {
      if (!game?.id || !game?.name || existing.has(game.id)) return;
      const option = document.createElement('option');
      option.value = game.id;
      option.textContent = game.name;
      aiGameSelect.appendChild(option);
    });
  } catch (error) {
    console.warn('Failed to load AI supported games:', error);
  } finally {
    updateAIContextPill();
  }
}

function syncAIComposerFromSettings() {
  const preferredModel = state.settings?.ai?.preferredModel || 'codex-5.3';
  if (aiModelSelect) {
    aiModelSelect.value = preferredModel;
  }
}

function updateAIContextPill() {
  if (!aiContextPill || !aiGameSelect) return;
  const selectedText = aiGameSelect.options[aiGameSelect.selectedIndex]?.textContent || 'Generic context';
  aiContextPill.textContent = selectedText;
}

function safeGetLocalStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLocalStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage persistence errors (private mode, disabled storage, etc.)
  }
}

function setAIGeneratingState(isGenerating, message) {
  editorState.isAIGenerating = isGenerating;
  if (aiGenerateBtn) {
    if (!aiGenerateBtn.dataset.defaultHtml) {
      aiGenerateBtn.dataset.defaultHtml = aiGenerateBtn.innerHTML;
    }
    aiGenerateBtn.disabled = isGenerating;
    aiGenerateBtn.innerHTML = isGenerating
      ? 'Generating...'
      : aiGenerateBtn.dataset.defaultHtml;
  }
  if (aiComposerMeta) {
    aiComposerMeta.textContent = message || '';
  }
}

async function handleAIGenerateWorkflow() {
  if (editorState.isAIGenerating) return;
  if (!state.currentWorkflow) {
    showToast('warning', 'No Workflow', 'Create or open a workflow first.');
    return;
  }

  const prompt = aiPromptInput?.value?.trim() || '';
  if (!prompt) {
    showToast('warning', 'Prompt Required', 'Describe the workflow you want to generate.');
    return;
  }

  setAIGeneratingState(true, 'Generating...');
  let result;
  try {
    result = await window.workflowAPI.generateWorkflowWithAI({
      prompt,
      gameId: aiGameSelect?.value || 'generic',
      preferredModel: aiModelSelect?.value || state.settings?.ai?.preferredModel || 'codex-5.3',
      applyMode: aiApplyModeSelect?.value || 'replace',
      currentWorkflow: state.currentWorkflow
    });
  } catch (error) {
    console.error('[AI] Generation IPC failed:', error);
    showToast('error', 'AI Error', error.message || 'Failed to contact AI service.');
    setAIGeneratingState(false);
    return;
  }

  setAIGeneratingState(false);

  if (!result || !result.success) {
    showToast('error', 'AI Error', result?.error || 'No response from AI service.');
    return;
  }

  if (result.data?.action === 'clarify') {
    const clarifyingText = result.data.clarification || 'Please provide more detail.';
    showModal('AI Needs Clarification', `<p>${escapeHtml(clarifyingText)}</p>`, [
      { label: 'Close', class: 'btn-secondary' }
    ]);
    return;
  }

  applyAIGeneratedWorkflow(result.data, result.meta);
}

function applyAIGeneratedWorkflow(payload, meta = {}) {
  const workflowPatch = payload?.workflow || {};
  const actions = Array.isArray(workflowPatch.actions) ? workflowPatch.actions : [];
  if (!actions.length) {
    showToast('warning', 'No Actions', 'AI response did not include any actions.');
    return;
  }

  const actionMode = aiApplyModeSelect?.value || 'replace';
  if (actionMode === 'append') {
    state.currentWorkflow.actions = [...(state.currentWorkflow.actions || []), ...actions];
  } else {
    state.currentWorkflow.actions = actions;
  }

  if (workflowPatch.name) {
    state.currentWorkflow.name = workflowPatch.name;
    workflowNameInput.value = workflowPatch.name;
  }
  if (workflowPatch.description) {
    state.currentWorkflow.description = workflowPatch.description;
  }
  if (typeof workflowPatch.infiniteLoop === 'boolean') {
    state.currentWorkflow.infiniteLoop = workflowPatch.infiniteLoop;
    loopInfiniteInput.checked = workflowPatch.infiniteLoop;
    loopCountInput.disabled = workflowPatch.infiniteLoop;
  }
  if (workflowPatch.loopCount) {
    state.currentWorkflow.loopCount = workflowPatch.loopCount;
    loopCountInput.value = workflowPatch.loopCount;
  }
  if (workflowPatch.loopDelay) {
    state.currentWorkflow.loopDelay = workflowPatch.loopDelay;
    loopDelayMinInput.value = workflowPatch.loopDelay.min;
    loopDelayMaxInput.value = workflowPatch.loopDelay.max;
  }

  markDirty();
  renderActionSequence();
  saveCurrentWorkflow();

  const modelLabel = meta?.model ? `Model: ${meta.model}` : 'AI draft generated';
  const summary = payload?.explanation || `${actions.length} action${actions.length !== 1 ? 's' : ''} generated`;
  showToast('success', 'AI Draft Applied', `${summary} · ${modelLabel}`);
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
  loopInfiniteInput.checked = !!workflow.infiniteLoop;
  loopCountInput.value = workflow.loopCount || 1;
  loopCountInput.disabled = !!workflow.infiniteLoop;
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
 *
 * **Nested Container Pattern**: Any action type that can contain sub-actions (loops,
 * conditionals, keyboard hold_and_act, and any future container action types) renders
 * its children inline in the workflow view. This is recursive — a loop inside a loop
 * inside a conditional will render all levels inline with proper indentation and full
 * drag/drop support at every depth. This is the standard, expected way to visualise
 * and interact with nested actions throughout Workflow Studio.
 *
 * Supports: drag/drop reorder within branch, drag from main sequence, drag new actions
 * from the palette, move-out to parent, edit, delete — all at arbitrary nesting depth.
 *
 * @param {Object}  action   - The parent action that owns the branches.
 * @param {number}  index    - Index of the parent action in the top-level actions array.
 * @param {Array}   branches - Array of { key, label, actions } branch descriptors.
 * @param {number}  [depth=0] - Current nesting depth (drives indentation).
 */
function renderInlineChildren(action, index, branches, depth) {
  if (typeof depth !== 'number') depth = 0;
  const childrenContainer = document.createElement('div');
  childrenContainer.className = 'inline-children';
  childrenContainer.dataset.depth = depth;

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
            <button class="btn btn-icon btn-sm inline-child-moveout" title="Move out to parent">
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
            // Reorder within same branch
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
            // Move from main sequence into this branch at position ci
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
              return;
            }
          } catch (err) {}

          // New action from palette
          if (editorState.draggedAction?.isNew) {
            const newAction = createDefaultAction(editorState.draggedAction.type);
            action[branch.key] = action[branch.key] || [];
            action[branch.key].splice(ci, 0, newAction);
            updateAction(index, action);
            markDirty();
            renderActionSequence();
            saveCurrentWorkflow();
          }
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

        // Recursive: if this child action itself has branches, render them nested
        const childBranches = getInlineBranches(childAction);
        if (childBranches.length > 0) {
          const nestedContainer = renderInlineChildren(childAction, index, childBranches, depth + 1);
          listEl.appendChild(nestedContainer);
        }
      });

      // Reset drag flag on mouseup
      document.addEventListener('mouseup', () => { inlineDragAllowed = false; });
    }

    branchEl.appendChild(listEl);
    childrenContainer.appendChild(branchEl);

    // Drag/drop onto inline branch list (from main sequence or palette)
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
          return;
        }
      } catch (err) {}

      // New action from palette dropped onto the branch list
      if (editorState.draggedAction?.isNew) {
        const newAction = createDefaultAction(editorState.draggedAction.type);
        action[branch.key] = action[branch.key] || [];
        action[branch.key].push(newAction);
        updateAction(index, action);
        markDirty();
        renderActionSequence();
        saveCurrentWorkflow();
      }
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

