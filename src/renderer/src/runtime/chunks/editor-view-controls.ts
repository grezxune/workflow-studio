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
