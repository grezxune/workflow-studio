/**
 * Workflow Studio - Settings View
 *
 * Handles application settings and preferences
 */

// DOM references
let workflowsDirInput = null;
let panicHotkeyInput = null;
let pauseHotkeyInput = null;
let clickJitterCheckbox = null;
let jitterRadiusSlider = null;
let jitterRadiusValue = null;
let overshootCheckbox = null;
let typingSpeedMinInput = null;
let typingSpeedMaxInput = null;
let mouseMoveDurationInput = null;

/**
 * Initialize settings view
 */
function initSettingsView() {
  // Cache DOM elements
  workflowsDirInput = document.getElementById('workflows-dir');
  panicHotkeyInput = document.getElementById('panic-hotkey');
  pauseHotkeyInput = document.getElementById('pause-hotkey');
  clickJitterCheckbox = document.getElementById('click-jitter-enabled');
  jitterRadiusSlider = document.getElementById('jitter-radius');
  jitterRadiusValue = document.getElementById('jitter-radius-value');
  overshootCheckbox = document.getElementById('overshoot-enabled');
  typingSpeedMinInput = document.getElementById('typing-speed-min');
  typingSpeedMaxInput = document.getElementById('typing-speed-max');
  mouseMoveDurationInput = document.getElementById('mouse-move-duration');

  // Setup event listeners
  setupSettingsEvents();

  // Load current settings into UI
  loadSettingsIntoUI();

  // Display app version
  const versionEl = document.getElementById('about-version');
  if (versionEl && window.platform?.appVersion) {
    versionEl.textContent = `v${window.platform.appVersion}`;
  }
}

/**
 * Setup settings event listeners
 */
function setupSettingsEvents() {
  // Browse directory
  document.getElementById('btn-browse-dir').addEventListener('click', browseDirectory);

  // Panic hotkey
  document.getElementById('btn-set-hotkey').addEventListener('click', changePanicHotkey);

  // Pause hotkey
  document.getElementById('btn-set-pause-hotkey')?.addEventListener('click', changePauseHotkey);

  // Clear history
  document.getElementById('btn-clear-history')?.addEventListener('click', clearExecutionHistory);

  // Capture template
  document.getElementById('btn-capture-template')?.addEventListener('click', captureNewTemplate);

  // Check for updates
  document.getElementById('btn-check-updates')?.addEventListener('click', checkForUpdates);

  // Click jitter
  clickJitterCheckbox.addEventListener('change', async () => {
    state.settings.clickJitter = state.settings.clickJitter || {};
    state.settings.clickJitter.enabled = clickJitterCheckbox.checked;
    await saveSettings({ clickJitter: state.settings.clickJitter });
  });

  // Jitter radius
  jitterRadiusSlider.addEventListener('input', () => {
    jitterRadiusValue.textContent = jitterRadiusSlider.value;
  });

  jitterRadiusSlider.addEventListener('change', async () => {
    state.settings.clickJitter = state.settings.clickJitter || {};
    state.settings.clickJitter.radius = parseInt(jitterRadiusSlider.value);
    await saveSettings({ clickJitter: state.settings.clickJitter });
  });

  // Overshoot
  overshootCheckbox.addEventListener('change', async () => {
    state.settings.overshoot = state.settings.overshoot || {};
    state.settings.overshoot.enabled = overshootCheckbox.checked;
    await saveSettings({ overshoot: state.settings.overshoot });
  });

  // Typing speed
  typingSpeedMinInput.addEventListener('change', async () => {
    state.settings.typingSpeed = state.settings.typingSpeed || {};
    state.settings.typingSpeed.min = parseInt(typingSpeedMinInput.value) || 50;
    await saveSettings({ typingSpeed: state.settings.typingSpeed });
  });

  typingSpeedMaxInput.addEventListener('change', async () => {
    state.settings.typingSpeed = state.settings.typingSpeed || {};
    state.settings.typingSpeed.max = parseInt(typingSpeedMaxInput.value) || 150;
    await saveSettings({ typingSpeed: state.settings.typingSpeed });
  });

  // Mouse movement duration
  mouseMoveDurationInput.addEventListener('change', async () => {
    state.settings.mouseMoveDuration = parseInt(mouseMoveDurationInput.value) || 250;
    await saveSettings({ mouseMoveDuration: state.settings.mouseMoveDuration });
  });
}

/**
 * Load current settings into the UI
 */
async function loadSettingsIntoUI() {
  // Reload settings
  state.settings = await window.workflowAPI.getSettings();

  // Workflows directory
  const workflowsDir = await window.workflowAPI.getWorkflowsDir();
  workflowsDirInput.value = workflowsDir || '';

  // Panic hotkey
  panicHotkeyInput.value = state.settings.panicHotkey || 'F7';

  // Pause hotkey
  pauseHotkeyInput.value = state.settings.pauseHotkey || 'F6';

  // Click jitter
  const jitter = state.settings.clickJitter || {};
  clickJitterCheckbox.checked = jitter.enabled !== false;
  jitterRadiusSlider.value = jitter.radius || 3;
  jitterRadiusValue.textContent = jitterRadiusSlider.value;

  // Overshoot
  const overshoot = state.settings.overshoot || {};
  overshootCheckbox.checked = overshoot.enabled !== false;

  // Typing speed
  const typing = state.settings.typingSpeed || {};
  typingSpeedMinInput.value = typing.min || 50;
  typingSpeedMaxInput.value = typing.max || 150;

  // Mouse movement duration
  mouseMoveDurationInput.value = state.settings.mouseMoveDuration ?? 250;

  // Load image gallery
  loadImageGallery();
}

/**
 * Browse for workflows directory
 */
async function browseDirectory() {
  try {
    const selectedDir = await window.workflowAPI.selectDirectory({
      title: 'Select Workflows Directory',
      defaultPath: workflowsDirInput.value
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
  } catch (error) {
    console.error('Failed to save settings:', error);
    showToast('error', 'Error', 'Failed to save settings');
  }
}

/**
 * Load and render image gallery
 */
async function loadImageGallery() {
  const gallery = document.getElementById('image-gallery');
  if (!gallery) return;

  try {
    const images = await window.workflowAPI.getImages();

    if (!images || images.length === 0) {
      gallery.innerHTML = '';
      return;
    }

    gallery.innerHTML = images.map(img => `
      <div class="image-gallery-item" data-id="${img.id}">
        <div style="width:100%;height:100%;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:32px;height:32px;color:var(--text-tertiary)">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        <span class="image-name">${img.id}</span>
        <button class="delete-image" data-delete="${img.id}" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `).join('');

    // Add delete handlers
    gallery.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const imageId = btn.dataset.delete;
        try {
          await window.workflowAPI.deleteImage(imageId);
          loadImageGallery();
          showToast('success', 'Deleted', 'Image template deleted');
        } catch (error) {
          showToast('error', 'Error', 'Failed to delete image');
        }
      });
    });
  } catch (error) {
    console.error('Failed to load images:', error);
    gallery.innerHTML = '<p style="color: var(--text-tertiary);">Failed to load images</p>';
  }
}

/**
 * Capture a new image template with region selection
 */
async function captureNewTemplate() {
  try {
    // Minimize the main window first
    await window.workflowAPI.minimizeWindow();

    // Small delay to ensure window is minimized
    await new Promise(r => setTimeout(r, 300));

    // Open region selection overlay
    const result = await window.workflowAPI.captureRegionTemplate();

    if (result.cancelled) {
      showToast('info', 'Cancelled', 'Region capture cancelled');
      return;
    }

    if (!result.success) {
      showToast('error', 'Error', result.error || 'Failed to capture region');
      return;
    }

    showToast('success', 'Captured', `Image template saved as ${result.imageId}`);
    loadImageGallery();
  } catch (error) {
    console.error('Capture failed:', error);
    showToast('error', 'Error', 'Failed to capture image');
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

  // Set loading state
  btn.disabled = true;
  btn.classList.add('checking');
  label.textContent = 'Checking...';
  if (hint) hint.textContent = 'Contacting update server...';

  // Listen for result
  const onAvailable = (info) => {
    label.textContent = 'Update Available!';
    if (hint) hint.textContent = `Version ${info?.version || 'new'} is available — downloading now`;
    btn.classList.remove('checking');
    btn.classList.add('update-found');
    cleanup();
  };

  const onNotAvailable = () => {
    label.textContent = 'Up to Date';
    if (hint) hint.textContent = `You're on the latest version (v${window.platform?.appVersion || '?'})`;
    btn.classList.remove('checking');
    btn.classList.add('up-to-date');
    cleanup();
    // Reset after a few seconds
    setTimeout(() => {
      label.textContent = 'Check for Updates';
      btn.disabled = false;
      btn.classList.remove('up-to-date');
      if (hint) hint.textContent = 'Updates are checked automatically every 30 minutes';
    }, 4000);
  };

  const onError = (err) => {
    label.textContent = 'Check Failed';
    if (hint) hint.textContent = err?.message || 'Could not reach update server';
    btn.classList.remove('checking');
    btn.classList.add('check-failed');
    cleanup();
    setTimeout(() => {
      label.textContent = 'Check for Updates';
      btn.disabled = false;
      btn.classList.remove('check-failed');
      if (hint) hint.textContent = 'Updates are checked automatically every 30 minutes';
    }, 4000);
  };

  function cleanup() {
    window.workflowAPI.onUpdateAvailable?.removeListener?.(onAvailable);
    window.workflowAPI.onUpdateNotAvailable?.removeListener?.(onNotAvailable);
    window.workflowAPI.onUpdateError?.removeListener?.(onError);
  }

  // Register one-shot listeners
  if (window.workflowAPI.onUpdateAvailable) window.workflowAPI.onUpdateAvailable(onAvailable);
  if (window.workflowAPI.onUpdateNotAvailable) window.workflowAPI.onUpdateNotAvailable(onNotAvailable);
  if (window.workflowAPI.onUpdateError) window.workflowAPI.onUpdateError(onError);

  try {
    await window.workflowAPI.checkForUpdates();
  } catch (err) {
    onError(err);
  }

  // Fallback timeout in case no event fires
  setTimeout(() => {
    if (btn.classList.contains('checking')) {
      onError({ message: 'Timed out waiting for update server' });
    }
  }, 15000);
}
