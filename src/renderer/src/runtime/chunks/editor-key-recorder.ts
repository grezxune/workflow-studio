/**
 * Setup the key recorder widget for keyboard action config.
 * Listens for real keydown events and builds a combo string (e.g. "ctrl+shift+a").
 */
function setupKeyRecorder(action, save) {
  const recorder = document.getElementById('key-recorder');
  const btn = document.getElementById('key-recorder-btn');
  const display = document.getElementById('key-recorder-display');
  const manualInput = document.getElementById('config-key');
  if (!recorder || !btn) return;

  let isRecording = false;
  let heldKeys = new Set();
  let keydownHandler = null;
  let keyupHandler = null;

  const KEY_DISPLAY_MAP = {
    'Control': 'ctrl',
    'Shift': 'shift',
    'Alt': 'alt',
    'Meta': 'cmd',
    'Enter': 'enter',
    'Backspace': 'backspace',
    'Delete': 'delete',
    'Escape': 'escape',
    'Tab': 'tab',
    'ArrowUp': 'up',
    'ArrowDown': 'down',
    'ArrowLeft': 'left',
    'ArrowRight': 'right',
    'CapsLock': 'capslock',
    ' ': 'space',
    'Home': 'home',
    'End': 'end',
    'PageUp': 'pageup',
    'PageDown': 'pagedown',
    'Insert': 'insert'
  };

  function normalizeKey(e) {
    if (KEY_DISPLAY_MAP[e.key]) return KEY_DISPLAY_MAP[e.key];
    if (e.key.length === 1) return e.key.toLowerCase();
    if (e.key.startsWith('F') && !isNaN(e.key.slice(1))) return e.key.toLowerCase();
    return e.key.toLowerCase();
  }

  function buildCombo() {
    const order = ['ctrl', 'alt', 'shift', 'cmd'];
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
    btn.querySelector('.key-recorder-btn-label').textContent = 'Press a key...';
    display.innerHTML = '<span class="key-recorder-listening">Listening<span class="key-recorder-dots"><span>.</span><span>.</span><span>.</span></span></span>';

    keydownHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const key = normalizeKey(e);
      if (key === 'escape') {
        stopRecording(false);
        return;
      }
      heldKeys.add(key);
      // Live preview of held keys
      const combo = buildCombo();
      display.innerHTML = combo.split('+').map(k =>
        `<span class="key-badge key-badge-live">${escapeHtml(k)}</span>`
      ).join('<span class="key-badge-separator">+</span>');
    };

    keyupHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      // On first key release, finalize the combo
      if (heldKeys.size > 0) {
        const combo = buildCombo();
        action.key = combo;
        manualInput.value = combo;
        save();
        stopRecording(true);
      }
    };

    document.addEventListener('keydown', keydownHandler, true);
    document.addEventListener('keyup', keyupHandler, true);
  }

  function stopRecording(success) {
    isRecording = false;
    recorder.classList.remove('recording');
    btn.querySelector('.key-recorder-btn-label').textContent = 'Record Key';

    if (keydownHandler) document.removeEventListener('keydown', keydownHandler, true);
    if (keyupHandler) document.removeEventListener('keyup', keyupHandler, true);
    keydownHandler = null;
    keyupHandler = null;

    if (success) {
      updateKeyRecorderDisplay(action.key);
      // Brief success flash
      recorder.classList.add('recorded');
      setTimeout(() => recorder.classList.remove('recorded'), 600);
    } else {
      updateKeyRecorderDisplay(action.key);
    }
    heldKeys.clear();
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

/**
 * Update the key recorder display with key badges
 */
function updateKeyRecorderDisplay(key) {
  const display = document.getElementById('key-recorder-display');
  if (!display) return;

  if (!key) {
    display.innerHTML = '<span class="key-recorder-placeholder">No key set</span>';
    return;
  }

  display.innerHTML = key.split('+').map(k =>
    `<span class="key-badge">${escapeHtml(k.trim())}</span>`
  ).join('<span class="key-badge-separator">+</span>');
}

/**
 * Helper: Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
