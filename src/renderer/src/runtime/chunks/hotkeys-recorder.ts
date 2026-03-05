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
