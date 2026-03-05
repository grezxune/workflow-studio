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
