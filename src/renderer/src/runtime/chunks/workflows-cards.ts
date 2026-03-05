/**
 * Create a workflow card element
 */
function createWorkflowCard(workflow) {
  const card = document.createElement('div');
  card.className = 'card card-clickable workflow-card';
  card.dataset.id = workflow.id;

  const actionCount = workflow.actions?.length || 0;
  const loopCount = workflow.loopCount || 1;
  const hotkey = getWorkflowHotkey(workflow.id);

  card.innerHTML = `
    <div class="workflow-card-header">
      <h3 class="workflow-card-title">
        ${escapeHtml(workflow.name)}
        ${hotkey ? `<span class="hotkey-badge">${hotkey}</span>` : ''}
      </h3>
      <div class="workflow-card-actions">
        <button class="btn btn-icon" data-action="play" title="Run">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </button>
        <button class="btn btn-icon" data-action="hotkey" title="Assign Hotkey">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="M6 8h.01M10 8h.01M14 8h.01"/>
          </svg>
        </button>
        <button class="btn btn-icon" data-action="export" title="Export">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        <button class="btn btn-icon" data-action="duplicate" title="Duplicate">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
        <button class="btn btn-icon btn-danger" data-action="delete" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
    ${workflow.description ? `<p class="workflow-card-description">${escapeHtml(workflow.description)}</p>` : ''}
    <div class="workflow-card-meta">
      <span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        ${actionCount} action${actionCount !== 1 ? 's' : ''}
      </span>
      <span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"/>
          <polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
        ${loopCount} loop${loopCount !== 1 ? 's' : ''}
      </span>
      <span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        ${formatDate(workflow.updatedAt)}
      </span>
    </div>
  `;

  // Card click - open in editor
  card.addEventListener('click', (e) => {
    // Ignore if clicking action buttons
    if (e.target.closest('[data-action]')) return;
    openWorkflowInEditor(workflow.id);
  });

  // Action buttons
  card.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;

      switch (action) {
        case 'play':
          runWorkflow(workflow.id);
          break;
        case 'duplicate':
          duplicateWorkflow(workflow.id);
          break;
        case 'delete':
          confirmDeleteWorkflow(workflow);
          break;
        case 'export':
          exportWorkflow(workflow.id);
          break;
        case 'hotkey':
          showHotkeyModal(workflow);
          break;
      }
    });
  });

  return card;
}

