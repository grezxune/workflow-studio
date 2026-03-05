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

