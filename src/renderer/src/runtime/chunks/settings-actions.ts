/**
 * Browse for workflows directory
 */
async function browseDirectory() {
  try {
    const defaultPath = workflowsDirInput.value || await window.workflowAPI.getWorkflowsDir();
    const selectedDir = await window.workflowAPI.selectDirectory({
      title: 'Select Workflows Directory',
      defaultPath
    });

    if (selectedDir) {
      workflowsDirInput.value = selectedDir;
      await saveSettings({ workflowsDir: selectedDir });
      showToast('success', 'Saved', 'Workflows directory updated');

      // Reload workflows from new directory
      await loadWorkflows();
    }
  } catch (error) {
    console.error('Failed to select directory:', error);
    showToast('error', 'Error', 'Failed to select directory');
  }
}

/**
 * Change panic hotkey
 */
async function changePanicHotkey() {
  showModal(
    'Change Panic Hotkey',
    `
      <p style="margin-bottom: var(--space-4);">Press the key or key combination you want to use as the panic hotkey.</p>
      <div class="config-field">
        <input type="text" id="new-hotkey-input" placeholder="Press a key..." readonly style="text-align: center; font-size: var(--text-lg);">
      </div>
      <p class="config-field-hint">Common options: F7, Escape, Ctrl+Shift+Q</p>
    `,
    [
      { label: 'Cancel', class: 'btn-secondary' },
      {
        label: 'Save',
        class: 'btn-primary',
        onClick: async () => {
          const newHotkey = document.getElementById('new-hotkey-input').value;
          if (newHotkey) {
            try {
              await window.workflowAPI.setPanicHotkey(newHotkey);
              await saveSettings({ panicHotkey: newHotkey });
              panicHotkeyInput.value = newHotkey;
              showToast('success', 'Saved', 'Panic hotkey updated');
            } catch (error) {
              showToast('error', 'Error', 'Failed to set hotkey');
            }
          }
        }
      }
    ]
  );

  // Setup key capture
  const input = document.getElementById('new-hotkey-input');
  input.focus();

  input.addEventListener('keydown', (e) => {
    e.preventDefault();

    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Cmd');

    // Get the key name
    let key = e.key;
    if (key === ' ') key = 'Space';
    if (key === 'Control' || key === 'Alt' || key === 'Shift' || key === 'Meta') {
      // Don't add modifier-only keys
      input.value = parts.join('+') || '';
      return;
    }

    // Capitalize single letters
    if (key.length === 1) {
      key = key.toUpperCase();
    }

    parts.push(key);
    input.value = parts.join('+');
  });
}

/**
 * Change pause hotkey
 */
async function changePauseHotkey() {
  showModal(
    'Change Pause / Resume Hotkey',
    `
      <p style="margin-bottom: var(--space-4);">Press the key or key combination you want to use to pause and resume workflows.</p>
      <div class="config-field">
        <input type="text" id="new-pause-hotkey-input" placeholder="Press a key..." readonly style="text-align: center; font-size: var(--text-lg);">
      </div>
      <p class="config-field-hint">Common options: F6, Pause, Ctrl+Shift+P</p>
    `,
    [
      { label: 'Cancel', class: 'btn-secondary' },
      {
        label: 'Save',
        class: 'btn-primary',
        onClick: async () => {
          const newHotkey = document.getElementById('new-pause-hotkey-input').value;
          if (newHotkey) {
            try {
              await window.workflowAPI.setPauseHotkey(newHotkey);
              await saveSettings({ pauseHotkey: newHotkey });
              pauseHotkeyInput.value = newHotkey;
              showToast('success', 'Saved', 'Pause hotkey updated');
            } catch (error) {
              showToast('error', 'Error', 'Failed to set hotkey');
            }
          }
        }
      }
    ]
  );

  // Setup key capture
  const input = document.getElementById('new-pause-hotkey-input');
  input.focus();

  input.addEventListener('keydown', (e) => {
    e.preventDefault();

    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Cmd');

    let key = e.key;
    if (key === ' ') key = 'Space';
    if (key === 'Control' || key === 'Alt' || key === 'Shift' || key === 'Meta') {
      input.value = parts.join('+') || '';
      return;
    }

    if (key.length === 1) {
      key = key.toUpperCase();
    }

    parts.push(key);
    input.value = parts.join('+');
  });
}

/**
 * Save settings to storage
 */
async function saveSettings(updates) {
  try {
    state.settings = await window.workflowAPI.updateSettings(updates);
    window.dispatchEvent(new CustomEvent('settings:updated', { detail: { settings: state.settings } }));
  } catch (error) {
    console.error('Failed to save settings:', error);
    showToast('error', 'Error', 'Failed to save settings');
  }
}

/**
 * Manually check for updates
 */
async function checkForUpdates() {
  const btn = document.getElementById('btn-check-updates');
  const label = document.getElementById('check-updates-label');
  const hint = document.getElementById('update-status-hint');
  if (!btn || !label) return;

  let finished = false;
  let timeoutId = null;
  const unsubscribeFns = [];

  // Set loading state
  btn.disabled = true;
  btn.classList.add('checking');
  label.textContent = 'Checking...';
  if (hint) hint.textContent = 'Contacting update server...';

  function cleanup() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    while (unsubscribeFns.length) {
      const unsubscribe = unsubscribeFns.pop();
      try {
        unsubscribe?.();
      } catch (err) {
        console.warn('Failed to remove update listener:', err);
      }
    }
  }

  function finish(callback) {
    if (finished) return;
    finished = true;
    cleanup();
    callback();
  }

  // Listen for result
  const onAvailable = (info) => {
    finish(() => {
      label.textContent = 'Update Available!';
      if (hint) hint.textContent = `Version ${info?.version || 'new'} is available - downloading now`;
      btn.classList.remove('checking');
      btn.classList.add('update-found');
    });
  };

  const onNotAvailable = () => {
    finish(() => {
      label.textContent = 'Up to Date';
      if (hint) hint.textContent = `You're on the latest version (v${window.platform?.appVersion || '?'})`;
      btn.classList.remove('checking');
      btn.classList.add('up-to-date');
      // Reset after a few seconds
      setTimeout(() => {
        label.textContent = 'Check for Updates';
        btn.disabled = false;
        btn.classList.remove('up-to-date');
        if (hint) hint.textContent = 'Updates are checked automatically every 30 minutes';
      }, 4000);
    });
  };

  const onError = (err) => {
    finish(() => {
      label.textContent = 'Check Failed';
      if (hint) hint.textContent = err?.message || 'Could not reach update server';
      btn.classList.remove('checking');
      btn.classList.add('check-failed');
      setTimeout(() => {
        label.textContent = 'Check for Updates';
        btn.disabled = false;
        btn.classList.remove('check-failed');
        if (hint) hint.textContent = 'Updates are checked automatically every 30 minutes';
      }, 4000);
    });
  };

  function subscribe(register, callback) {
    if (typeof register !== 'function') return;
    const unsubscribe = register(callback);
    if (typeof unsubscribe === 'function') {
      unsubscribeFns.push(unsubscribe);
    }
  }

  // Register one-shot listeners
  subscribe(window.workflowAPI.onUpdateAvailable, onAvailable);
  subscribe(window.workflowAPI.onUpdateNotAvailable, onNotAvailable);
  subscribe(window.workflowAPI.onUpdateError, onError);

  // Fallback timeout in case the updater never emits a terminal event.
  timeoutId = setTimeout(() => {
    onError({ message: 'Timed out waiting for update server' });
  }, 15000);

  try {
    const result = await window.workflowAPI.checkForUpdates();
    if (result?.success === false) {
      onError({ message: result.error || 'Could not reach update server' });
    }
  } catch (err) {
    onError(err);
  }
}
