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

/**
 * Setup the hotkey recorder for the add form.
 * Records key combos and converts to Electron accelerator format.
 */
function setupHotkeyRecorder(onUpdate) {
  const recorder = document.getElementById('hotkey-recorder');
  const btn = document.getElementById('hotkey-recorder-btn');
  const display = document.getElementById('hotkey-recorder-display');
  if (!recorder || !btn) return;

  let isRecording = false;
  let heldKeys = new Set();
  let keydownHandler = null;
  let keyupHandler = null;

  // Map browser key names to Electron accelerator names
  const ACCELERATOR_MAP = {
    'Control': 'CommandOrControl',
    'Shift': 'Shift',
    'Alt': 'Alt',
    'Meta': 'Super',
    'Enter': 'Enter',
    'Backspace': 'Backspace',
    'Delete': 'Delete',
    'Tab': 'Tab',
    'ArrowUp': 'Up',
    'ArrowDown': 'Down',
    'ArrowLeft': 'Left',
    'ArrowRight': 'Right',
    'Home': 'Home',
    'End': 'End',
    'PageUp': 'PageUp',
    'PageDown': 'PageDown',
    'Insert': 'Insert',
    ' ': 'Space',
    'Escape': 'Escape'
  };

  // Display-friendly names
  const DISPLAY_MAP = {
    'CommandOrControl': 'Ctrl',
    'Super': 'Win',
    'Space': 'Space'
  };

  function toAccelerator(e) {
    if (ACCELERATOR_MAP[e.key]) return ACCELERATOR_MAP[e.key];
    if (e.key.length === 1) return e.key.toUpperCase();
    if (e.key.startsWith('F') && !isNaN(e.key.slice(1))) return e.key;
    return e.key;
  }

  function toDisplay(accel) {
    return DISPLAY_MAP[accel] || accel;
  }

  function isModifier(accel) {
    return ['CommandOrControl', 'Shift', 'Alt', 'Super'].includes(accel);
  }

  function buildAccelerator() {
    const order = ['CommandOrControl', 'Alt', 'Shift', 'Super'];
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
    btn.querySelector('.hotkey-recorder-btn-label').textContent = 'Press keys...';
    display.innerHTML = '<span class="key-recorder-listening">Listening<span class="key-recorder-dots"><span>.</span><span>.</span><span>.</span></span></span>';

    keydownHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const key = toAccelerator(e);
      if (key === 'Escape') {
        stopRecording(false);
        return;
      }
      heldKeys.add(key);
      // Live preview
      const accel = buildAccelerator();
      display.innerHTML = accel.split('+').map(k =>
        `<span class="key-badge key-badge-live">${escapeHtml(toDisplay(k))}</span>`
      ).join('<span class="key-badge-separator">+</span>');
    };

    keyupHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (heldKeys.size > 0) {
        const accel = buildAccelerator();
        // Validate: must have at least one modifier + one non-modifier
        const hasModifier = [...heldKeys].some(k => isModifier(k));
        const hasKey = [...heldKeys].some(k => !isModifier(k));

        if (hasModifier && hasKey) {
          pendingAccelerator = accel;
          stopRecording(true);
        } else if (!hasModifier) {
          // Show error
          display.innerHTML = '<span style="color: var(--color-danger-400); font-size: var(--text-sm);">Must include Ctrl, Alt, or Shift</span>';
          heldKeys.clear();
          setTimeout(() => {
            if (isRecording) {
              display.innerHTML = '<span class="key-recorder-listening">Listening<span class="key-recorder-dots"><span>.</span><span>.</span><span>.</span></span></span>';
            }
          }, 1500);
          return;
        } else {
          // Only modifiers, keep listening
          heldKeys.clear();
          display.innerHTML = '<span class="key-recorder-listening">Now press a key...<span class="key-recorder-dots"><span>.</span><span>.</span><span>.</span></span></span>';
          return;
        }
      }
    };

    document.addEventListener('keydown', keydownHandler, true);
    document.addEventListener('keyup', keyupHandler, true);
  }

  function stopRecording(success) {
    isRecording = false;
    recorder.classList.remove('recording');
    btn.querySelector('.hotkey-recorder-btn-label').textContent = 'Record Hotkey';

    if (keydownHandler) document.removeEventListener('keydown', keydownHandler, true);
    if (keyupHandler) document.removeEventListener('keyup', keyupHandler, true);
    keydownHandler = null;
    keyupHandler = null;

    if (success && pendingAccelerator) {
      display.innerHTML = pendingAccelerator.split('+').map(k =>
        `<span class="key-badge">${escapeHtml(toDisplay(k))}</span>`
      ).join('<span class="key-badge-separator">+</span>');
      recorder.classList.add('recorded');
      setTimeout(() => recorder.classList.remove('recorded'), 600);
    } else if (!pendingAccelerator) {
      display.innerHTML = '<span class="key-recorder-placeholder">No hotkey set</span>';
    }
    heldKeys.clear();
    if (onUpdate) onUpdate();
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
