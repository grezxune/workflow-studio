/*
 * Editor — workflow variables, system sounds, and conditional-branch helpers.
 * Ported from the pre-React editor monolith; shares the editor's global scope.
 */

function normalizeWorkflowVariables(workflow) {
  if (!workflow) return;

  const variables = Array.isArray(workflow.variables) ? workflow.variables : [];
  workflow.variables = variables.map((variable, index) => ({
    id: variable?.id || generateId(),
    name: variable?.name || `Variable ${index + 1}`,
    color: normalizeVariableColor(variable?.color),
    indicatorTarget: normalizeIndicatorTarget(variable?.indicatorTarget),
    value: false
  }));
}

function normalizeVariableColor(color) {
  return /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#f59e0b';
}

function normalizeIndicatorTarget(target) {
  return ['overlay', 'floating-bar', 'both'].includes(target) ? target : 'both';
}

function ensureWorkflowVariables() {
  if (!state.currentWorkflow) return [];
  normalizeWorkflowVariables(state.currentWorkflow);
  return state.currentWorkflow.variables;
}

/**
 * Open the Workflow Variables modal. Variables are an optional, advanced feature,
 * so they live behind this modal instead of permanently occupying the editor canvas.
 */
function openWorkflowVariablesModal() {
  if (!state.currentWorkflow) {
    showToast('warning', 'No Workflow', 'Open or create a workflow first.');
    return;
  }

  showModal('Workflow Variables', `
    <div class="variables-modal">
      <p class="variables-modal-intro">
        Variables act like status flags. An action such as <strong>Wait</strong>, <strong>Find Image</strong>, or
        <strong>Find Pixel</strong> can switch a variable on, which flashes the run screen in your chosen color until
        you reset it — perfect for noticing that something happened while you were away from the keyboard.
      </p>
      <div class="workflow-variables-list" id="variables-modal-list"></div>
      <button class="btn btn-secondary variables-modal-add" id="btn-add-variable-modal" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add Variable
      </button>
    </div>
  `, [
    { label: 'Done', class: 'btn-primary' }
  ]);

  renderWorkflowVariablesInto(document.getElementById('variables-modal-list'));
  document.getElementById('btn-add-variable-modal')?.addEventListener('click', addWorkflowVariable);
}

/**
 * Update the toolbar Variables button badge to reflect the current variable count.
 */
function updateVariablesBadge() {
  if (!workflowVariablesBadge) return;
  const count = state.currentWorkflow?.variables?.length || 0;
  workflowVariablesBadge.textContent = String(count);
  workflowVariablesBadge.classList.toggle('hidden', count === 0);
  workflowVariablesBtn?.classList.toggle('has-variables', count > 0);
}

/**
 * Refresh every Variables UI surface after a change (toolbar badge + open modal list).
 */
function refreshWorkflowVariablesUI() {
  updateVariablesBadge();
  const modalList = document.getElementById('variables-modal-list');
  if (modalList) renderWorkflowVariablesInto(modalList);
}

/**
 * Render the editable variable rows into the given container (the modal body).
 */
function renderWorkflowVariablesInto(container) {
  if (!container) return;

  const variables = ensureWorkflowVariables();
  if (!state.currentWorkflow || variables.length === 0) {
    container.innerHTML = `
      <div class="workflow-variable-empty">
        No variables yet. Add one, then actions like Wait, Find Image, or Find Pixel can switch it on and flash the run screen until you reset it.
      </div>
    `;
    return;
  }

  container.innerHTML = variables.map((variable) => `
    <div class="workflow-variable-row" data-variable-id="${escapeHtml(variable.id)}">
      <div class="config-field">
        <label>Name</label>
        <input type="text" data-field="name" value="${escapeHtml(variable.name)}" placeholder="Boss spawned">
      </div>
      <div class="config-field">
        <label>Flash Color</label>
        <div class="workflow-variable-color">
          <input type="color" data-field="color" value="${escapeHtml(variable.color)}">
          <span class="workflow-variable-preview" style="color:${escapeHtml(variable.color)}; background:${escapeHtml(variable.color)}"></span>
        </div>
      </div>
      <div class="config-field">
        <label>Flash In</label>
        <select data-field="indicatorTarget">
          <option value="overlay" ${variable.indicatorTarget === 'overlay' ? 'selected' : ''}>Active Modal</option>
          <option value="floating-bar" ${variable.indicatorTarget === 'floating-bar' ? 'selected' : ''}>Minimized Overlay</option>
          <option value="both" ${variable.indicatorTarget === 'both' ? 'selected' : ''}>Both</option>
        </select>
      </div>
      <button class="btn btn-danger btn-sm" data-action="delete-variable">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
        Delete
      </button>
    </div>
  `).join('');

  container.querySelectorAll('.workflow-variable-row').forEach((row) => {
    const variableId = row.dataset.variableId;

    row.querySelectorAll('[data-field]').forEach((field) => {
      const fieldName = field.dataset.field;

      if (fieldName === 'name') {
        field.addEventListener('input', () => {
          updateWorkflowVariable(variableId, fieldName, field.value, { rerender: false });
        });
        field.addEventListener('blur', () => {
          updateWorkflowVariable(variableId, fieldName, field.value, { rerender: true });
        });
        return;
      }

      field.addEventListener('input', () => {
        updateWorkflowVariable(variableId, fieldName, field.value, { rerender: fieldName === 'color' });
      });
      field.addEventListener('change', () => {
        updateWorkflowVariable(variableId, fieldName, field.value, { rerender: true });
      });
    });

    row.querySelector('[data-action="delete-variable"]')?.addEventListener('click', () => {
      deleteWorkflowVariable(variableId);
    });
  });
}

function addWorkflowVariable() {
  if (!state.currentWorkflow) return;

  const variables = ensureWorkflowVariables();
  variables.push({
    id: generateId(),
    name: `Variable ${variables.length + 1}`,
    color: '#f59e0b',
    indicatorTarget: 'both',
    value: false
  });

  markDirty();
  refreshWorkflowVariablesUI();
  renderActionSequence();
  rerenderSelectedActionConfig();
  saveCurrentWorkflow();
}

function updateWorkflowVariable(variableId, field, rawValue, options = {}) {
  const variable = ensureWorkflowVariables().find((item) => item.id === variableId);
  if (!variable) return;
  const shouldRerender = options.rerender !== false;

  if (field === 'name') {
    variable.name = rawValue.trim() || 'Variable';
  } else if (field === 'color') {
    variable.color = normalizeVariableColor(rawValue);
  } else if (field === 'indicatorTarget') {
    variable.indicatorTarget = normalizeIndicatorTarget(rawValue);
  }

  markDirty();
  if (shouldRerender) {
    refreshWorkflowVariablesUI();
    renderActionSequence();
    rerenderSelectedActionConfig();
  }
  saveCurrentWorkflow();
}

function deleteWorkflowVariable(variableId) {
  if (!state.currentWorkflow) return;

  state.currentWorkflow.variables = ensureWorkflowVariables().filter((item) => item.id !== variableId);
  clearVariableAssignments(variableId, state.currentWorkflow.actions || []);
  markDirty();
  refreshWorkflowVariablesUI();
  renderActionSequence();
  rerenderSelectedActionConfig();
  saveCurrentWorkflow();
}

function clearVariableAssignments(variableId, actions) {
  actions.forEach((action) => {
    if (action.setVariableId === variableId) {
      delete action.setVariableId;
    }

    if (Array.isArray(action.actions)) clearVariableAssignments(variableId, action.actions);
    if (Array.isArray(action.thenActions)) clearVariableAssignments(variableId, action.thenActions);
    if (Array.isArray(action.elseActions)) clearVariableAssignments(variableId, action.elseActions);
  });
}

function rerenderSelectedActionConfig() {
  const currentAction = state.currentWorkflow?.actions?.[editorState.selectedActionIndex];
  if (!currentAction || configPanel?.classList.contains('hidden')) return;
  renderConfigFields(currentAction, editorState.selectedActionIndex);
}

function getActionVariableSuffix(action) {
  if (!action?.setVariableId || !state.currentWorkflow?.variables?.length) {
    return '';
  }

  const variable = state.currentWorkflow.variables.find((item) => item.id === action.setVariableId);
  return variable ? ` -> set ${variable.name}` : '';
}

async function loadSystemSounds() {
  try {
    const sounds = await window.workflowAPI.getSystemSounds();
    if (Array.isArray(sounds) && sounds.length > 0) {
      editorState.systemSounds = sounds;
    }
  } catch (error) {
    console.warn('Failed to load system sounds:', error);
  }

  const currentAction = state.currentWorkflow?.actions?.[editorState.selectedActionIndex];
  if (currentAction?.type === 'image_detect' && !configPanel.classList.contains('hidden')) {
    renderConfigFields(currentAction, editorState.selectedActionIndex);
  }
}

function renderSoundOptions(selectedId) {
  return editorState.systemSounds.map((sound) => `
    <option value="${escapeHtml(sound.id)}" data-sound-type="${escapeHtml(sound.type || 'builtin')}" ${sound.id === (selectedId || 'none') ? 'selected' : ''}>
      ${escapeHtml(sound.label)}
    </option>
  `).join('');
}

function getSoundMeta(soundId) {
  return editorState.systemSounds.find((sound) => sound.id === soundId) || null;
}

function renderVariableAssignmentField(action, triggerLabel) {
  const variables = ensureWorkflowVariables();
  const options = ['<option value="">Do not set a variable</option>']
    .concat(variables.map((variable) => `
      <option value="${escapeHtml(variable.id)}" ${action.setVariableId === variable.id ? 'selected' : ''}>
        ${escapeHtml(variable.name)}
      </option>
    `))
    .join('');

  return `
    <div class="config-field">
      <label>${triggerLabel}</label>
      <select id="config-set-variable-id" ${variables.length === 0 ? 'disabled' : ''}>
        ${options}
      </select>
      <p class="config-field-hint">
        ${variables.length === 0
          ? 'Create a workflow variable above first, then return here to link this action.'
          : 'When this action succeeds, the selected variable will turn on until you reset it from the overlay or minimized bar.'}
      </p>
    </div>
  `;
}

function bindVariableAssignmentField(action, save) {
  const select = document.getElementById('config-set-variable-id');
  if (!select) return;

  select.addEventListener('change', (e) => {
    action.setVariableId = e.target.value || undefined;
    save();
  });
}

/**
 * Update an action and save

function normalizeConditionalBranchCondition(condition) {
  const normalized = condition && typeof condition === 'object'
    ? { ...condition }
    : { type: 'image_present' };

  if (!['image_present', 'image_absent', 'pixel_match'].includes(normalized.type)) {
    normalized.type = 'image_present';
  }

  if (!normalized.color) {
    normalized.color = { r: 255, g: 0, b: 0 };
  }
  if (!Number.isFinite(normalized.tolerance)) {
    normalized.tolerance = 10;
  }
  if (!Number.isFinite(normalized.confidence)) {
    normalized.confidence = 0.9;
  }

  return normalized;
}

function renderConditionalConditionFields(prefix, label, condition) {
  const isPixel = condition.type === 'pixel_match';
  const confidence = Math.round((condition.confidence || 0.9) * 100);
  const tolerance = condition.tolerance || 10;
  const colorHex = rgbToHex(condition.color);

  return `
    <div class="config-field">
      <label>${label}</label>
      <select id="${prefix}-type">
        <option value="image_present" ${condition.type === 'image_present' ? 'selected' : ''}>Image Present</option>
        <option value="image_absent" ${condition.type === 'image_absent' ? 'selected' : ''}>Image Absent</option>
        <option value="pixel_match" ${condition.type === 'pixel_match' ? 'selected' : ''}>Pixel Color Match</option>
      </select>
    </div>
    <div class="config-field" id="${prefix}-image-field" ${isPixel ? 'style="display:none"' : ''}>
      <label>Image Template</label>
      <div id="${prefix}-image"></div>
      <button class="btn btn-secondary btn-sm" id="${prefix}-capture-image" style="margin-top:8px">
        Capture New Image
      </button>
    </div>
    <div class="config-field" id="${prefix}-confidence-field" ${isPixel ? 'style="display:none"' : ''}>
      <label>Match Confidence: <span id="${prefix}-conf-value">${confidence}%</span></label>
      <input type="range" id="${prefix}-confidence" min="50" max="100" value="${confidence}">
    </div>
    <div class="config-field" id="${prefix}-pixel-field" ${!isPixel ? 'style="display:none"' : ''}>
      <label>Pixel Color</label>
      <div class="color-picker-row">
        <input type="color" id="${prefix}-color" value="${colorHex}">
        <span id="${prefix}-color-preview" style="display:inline-block;width:24px;height:24px;border-radius:4px;background:${colorHex};border:1px solid var(--border)"></span>
      </div>
    </div>
    <div class="config-field" id="${prefix}-tolerance-field" ${!isPixel ? 'style="display:none"' : ''}>
      <label>Color Tolerance: <span id="${prefix}-tol-value">${tolerance}</span></label>
      <input type="range" id="${prefix}-tolerance" min="0" max="50" value="${tolerance}">
    </div>
  `;
}

function setConditionalConditionFieldVisibility(prefix, type) {
  const isPixel = type === 'pixel_match';
  document.getElementById(`${prefix}-image-field`).style.display = isPixel ? 'none' : '';
  document.getElementById(`${prefix}-confidence-field`).style.display = isPixel ? 'none' : '';
  document.getElementById(`${prefix}-pixel-field`).style.display = isPixel ? '' : 'none';
  document.getElementById(`${prefix}-tolerance-field`).style.display = isPixel ? '' : 'none';
}

async function bindConditionalConditionEditor(prefix, condition, save) {
  const imagePicker = await loadImageOptions(`${prefix}-image`, condition.imageId, (val) => {
    condition.imageId = val;
    save();
  });

  document.getElementById(`${prefix}-type`).addEventListener('change', (e) => {
    condition.type = e.target.value;
    setConditionalConditionFieldVisibility(prefix, e.target.value);
    save();
  });

  document.getElementById(`${prefix}-confidence`).addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById(`${prefix}-conf-value`).textContent = `${val}%`;
    condition.confidence = val / 100;
    save();
  });

  document.getElementById(`${prefix}-color`).addEventListener('change', (e) => {
    condition.color = hexToRgb(e.target.value);
    document.getElementById(`${prefix}-color-preview`).style.background = e.target.value;
    save();
  });

  document.getElementById(`${prefix}-tolerance`).addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById(`${prefix}-tol-value`).textContent = val;
    condition.tolerance = val;
    save();
  });

  document.getElementById(`${prefix}-capture-image`).addEventListener('click', () => {
    captureImageTemplate((imageId) => {
      condition.imageId = imageId;
      if (imagePicker) {
        imagePicker.setValue(imageId);
        imagePicker.refresh();
      }
      save();
    });
  });

  return imagePicker;
}
