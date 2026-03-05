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

