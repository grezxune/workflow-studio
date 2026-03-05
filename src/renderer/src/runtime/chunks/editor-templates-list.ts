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

