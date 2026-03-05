/**
 * Workflow Studio - Hotkeys View
 *
 * Manages global hotkey bindings for launching workflows from any application.
 */

let hotkeyBindings = [];
let pendingAccelerator = null;

/**
 * Initialize hotkeys view
 */
function initHotkeysView() {
  setupHotkeyEvents();
  loadHotkeys();

  // Listen for hotkey triggered events
  window.workflowAPI.onHotkeyTriggered((data) => {
    if (data.ignored) {
      if (data.reason === 'already_running') {
        showToast('warning', 'Hotkey Ignored', 'A workflow is already running');
      } else if (data.reason === 'not_found') {
        showToast('error', 'Workflow Not Found', `"${data.workflowName}" no longer exists`);
      }
    } else {
      showToast('info', 'Hotkey Triggered', `Running "${data.workflowName}"`);
    }
  });
}

/**
 * Load hotkey bindings and render
 */
async function loadHotkeys() {
  try {
    hotkeyBindings = await window.workflowAPI.getHotkeys();
    renderHotkeyList();
    populateWorkflowSelect();
  } catch (error) {
    console.error('[Hotkeys] Failed to load:', error);
  }
}

/**
 * Populate the workflow dropdown (excluding workflows that already have hotkeys)
 */
function populateWorkflowSelect() {
  const select = document.getElementById('hotkey-workflow-select');
  if (!select) return;

  const assignedIds = new Set(hotkeyBindings.map(b => b.workflowId));

  select.innerHTML = '<option value="">Select a workflow...</option>';
  (state.workflows || []).forEach(w => {
    if (!assignedIds.has(w.id)) {
      const opt = document.createElement('option');
      opt.value = w.id;
      opt.textContent = w.name || 'Untitled';
      select.appendChild(opt);
    }
  });
}

/**
 * Render the list of hotkey bindings
 */
function renderHotkeyList() {
  const list = document.getElementById('hotkeys-list');
  const empty = document.getElementById('hotkeys-empty');
  if (!list || !empty) return;

  if (hotkeyBindings.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  list.innerHTML = hotkeyBindings.map(binding => `
    <div class="hotkey-binding-card" data-workflow-id="${binding.workflowId}">
      <div class="hotkey-binding-keys">
        ${formatAcceleratorBadges(binding.accelerator)}
      </div>
      <div class="hotkey-binding-info">
        <div class="hotkey-binding-workflow">${escapeHtml(binding.workflowName || 'Unknown Workflow')}</div>
        <div class="hotkey-binding-hint">Press from any app to run this workflow</div>
      </div>
      <div class="hotkey-binding-actions">
        <button class="btn btn-sm btn-secondary hotkey-test-btn" data-workflow-id="${binding.workflowId}" title="Test run this workflow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </button>
        <button class="btn btn-sm btn-danger hotkey-remove-btn" data-workflow-id="${binding.workflowId}" title="Remove hotkey">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

  // Wire up remove buttons
  list.querySelectorAll('.hotkey-remove-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const workflowId = btn.dataset.workflowId;
      await window.workflowAPI.removeHotkey(workflowId);
      showToast('success', 'Removed', 'Hotkey removed');
      loadHotkeys();
    });
  });

  // Wire up test buttons
  list.querySelectorAll('.hotkey-test-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const workflowId = btn.dataset.workflowId;
      const workflow = state.workflows.find(w => w.id === workflowId);
      if (workflow) {
        try {
          await window.workflowAPI.executeWorkflow(workflow, {});
        } catch (err) {
          showToast('error', 'Error', err.message);
        }
      }
    });
  });
}

/**
 * Format an Electron accelerator string into key badges
 */
function formatAcceleratorBadges(accelerator) {
  if (!accelerator) return '<span class="key-recorder-placeholder">None</span>';
  return accelerator.split('+').map(k =>
    `<span class="key-badge">${escapeHtml(k.trim())}</span>`
  ).join('<span class="key-badge-separator">+</span>');
}

/**
 * Setup event listeners for the hotkeys view
 */
function setupHotkeyEvents() {
  const addBtn = document.getElementById('btn-add-hotkey');
  const select = document.getElementById('hotkey-workflow-select');

  if (!addBtn || !select) return;

  // Update add button state
  function updateAddBtnState() {
    addBtn.disabled = !select.value || !pendingAccelerator;
  }

  select.addEventListener('change', updateAddBtnState);

  // Add hotkey
  addBtn.addEventListener('click', async () => {
    const workflowId = select.value;
    const workflow = state.workflows.find(w => w.id === workflowId);
    if (!workflowId || !pendingAccelerator || !workflow) return;

    addBtn.disabled = true;

    try {
      await window.workflowAPI.setHotkey(pendingAccelerator, workflowId, workflow.name);
      showToast('success', 'Hotkey Added', `${pendingAccelerator} → ${workflow.name}`);

      // Reset form
      pendingAccelerator = null;
      select.value = '';
      document.getElementById('hotkey-recorder-display').innerHTML =
        '<span class="key-recorder-placeholder">No hotkey set</span>';
      document.getElementById('hotkey-recorder').classList.remove('recorded');

      loadHotkeys();
    } catch (error) {
      showToast('error', 'Error', error.message || 'Failed to add hotkey');
      addBtn.disabled = false;
    }
  });

  // Setup the hotkey recorder
  setupHotkeyRecorder(updateAddBtnState);
}

