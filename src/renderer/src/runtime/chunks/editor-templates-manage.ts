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

