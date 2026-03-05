/**
 * Create a searchable image picker with folder hierarchy inside a container element.
 * Returns a controller: { onChange(cb), setValue(id), getValue(), destroy() }
 */
async function loadImageOptions(containerId, selectedId, onChangeCb) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  let images = [];
  try {
    images = await window.workflowAPI.getImages() || [];
  } catch (e) {
    console.error('Failed to load images:', e);
  }

  let currentValue = selectedId || null;
  let isOpen = false;
  let _onChange = onChangeCb || null;

  const chevronSvg = `<svg class="picker-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
  const folderSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;

  function getDisplayLabel(id) {
    if (!id) return null;
    const img = images.find(i => i.id === id);
    if (!img) return id;
    return img.folder ? `${img.folder} / ${img.id}` : img.id;
  }

  // Build the picker DOM
  container.innerHTML = '';
  container.classList.add('image-picker');

  const trigger = document.createElement('div');
  trigger.className = 'image-picker-trigger';
  trigger.innerHTML = currentValue
    ? `<span class="picker-value">${escapeHtml(getDisplayLabel(currentValue))}</span>${chevronSvg}`
    : `<span class="picker-value picker-placeholder">Select image...</span>${chevronSvg}`;
  container.appendChild(trigger);

  const dropdown = document.createElement('div');
  dropdown.className = 'image-picker-dropdown';
  dropdown.style.display = 'none';
  container.appendChild(dropdown);

  function renderDropdown(filter = '') {
    const q = filter.toLowerCase();

    // Group images
    const uncategorized = images.filter(i => !i.folder);
    const folderMap = {};
    images.forEach(img => {
      if (img.folder) {
        if (!folderMap[img.folder]) folderMap[img.folder] = [];
        folderMap[img.folder].push(img);
      }
    });

    let html = `<div class="image-picker-search"><input type="text" placeholder="Search images..." value="${escapeHtml(filter)}"></div><div class="image-picker-results">`;

    let hasResults = false;

    // Uncategorized images
    const filteredUncat = uncategorized.filter(img =>
      !q || img.id.toLowerCase().includes(q)
    );
    if (filteredUncat.length > 0) {
      filteredUncat.forEach(img => {
        hasResults = true;
        const sel = img.id === currentValue ? ' selected' : '';
        const thumb = img.path ? `<img class="picker-item-thumb" src="file://${img.path.replace(/\\/g, '/')}?t=${Date.now()}" alt="">` : '';
        html += `<div class="image-picker-item${sel}" data-value="${escapeHtml(img.id)}">${thumb}<span class="picker-item-name">${escapeHtml(img.id)}</span></div>`;
      });
    }

    // Folders
    Object.keys(folderMap).sort().forEach(folder => {
      const folderMatches = folder.toLowerCase().includes(q);
      const filteredImgs = folderMap[folder].filter(img =>
        !q || folderMatches || img.id.toLowerCase().includes(q)
      );
      if (filteredImgs.length > 0) {
        hasResults = true;
        html += `<div class="image-picker-folder">${folderSvg} ${escapeHtml(folder)}</div>`;
        filteredImgs.forEach(img => {
          const sel = img.id === currentValue ? ' selected' : '';
          const thumb = img.path ? `<img class="picker-item-thumb" src="file://${img.path.replace(/\\/g, '/')}?t=${Date.now()}" alt="">` : '';
          html += `<div class="image-picker-item in-folder${sel}" data-value="${escapeHtml(img.id)}">${thumb}<span class="picker-item-name">${escapeHtml(img.id)}</span></div>`;
        });
      }
    });

    if (!hasResults) {
      html += `<div class="image-picker-empty">${q ? 'No images match "' + escapeHtml(filter) + '"' : 'No image templates'}</div>`;
    }

    html += '</div>';
    dropdown.innerHTML = html;

    // Wire search input
    const searchInput = dropdown.querySelector('.image-picker-search input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        renderDropdown(e.target.value);
      });
      // Prevent trigger close when clicking in search
      searchInput.addEventListener('mousedown', (e) => e.stopPropagation());
      // Keep focus
      setTimeout(() => searchInput.focus(), 0);
      // Place cursor at end
      searchInput.selectionStart = searchInput.selectionEnd = searchInput.value.length;
    }

    // Wire item clicks
    dropdown.querySelectorAll('.image-picker-item').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const val = el.dataset.value;
        selectValue(val);
        closeDropdown();
      });
    });
  }

  function selectValue(val) {
    currentValue = val || null;
    trigger.innerHTML = currentValue
      ? `<span class="picker-value">${escapeHtml(getDisplayLabel(currentValue))}</span>${chevronSvg}`
      : `<span class="picker-value picker-placeholder">Select image...</span>${chevronSvg}`;
    if (_onChange) _onChange(currentValue);
  }

  function openDropdown() {
    if (isOpen) return;
    isOpen = true;
    trigger.classList.add('open');
    dropdown.style.display = '';
    renderDropdown('');
  }

  function closeDropdown() {
    if (!isOpen) return;
    isOpen = false;
    trigger.classList.remove('open');
    dropdown.style.display = 'none';
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isOpen) closeDropdown();
    else openDropdown();
  });

  // Close on outside click
  function handleOutsideClick(e) {
    if (!container.contains(e.target)) closeDropdown();
  }
  document.addEventListener('mousedown', handleOutsideClick);

  const controller = {
    onChange(cb) { _onChange = cb; },
    setValue(id) { selectValue(id); },
    getValue() { return currentValue; },
    async refresh() {
      try { images = await window.workflowAPI.getImages() || []; } catch (e) {}
      if (isOpen) renderDropdown('');
      // Update trigger label
      trigger.innerHTML = currentValue
        ? `<span class="picker-value">${escapeHtml(getDisplayLabel(currentValue))}</span>${chevronSvg}`
        : `<span class="picker-value picker-placeholder">Select image...</span>${chevronSvg}`;
    },
    destroy() {
      document.removeEventListener('mousedown', handleOutsideClick);
    }
  };

  return controller;
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

