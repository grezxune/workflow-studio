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
let aiOpenRouterKeyInput = null;
let aiPreferredModelSelect = null;

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
  aiOpenRouterKeyInput = document.getElementById('ai-openrouter-key');
  aiPreferredModelSelect = document.getElementById('ai-preferred-model');

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

  // OpenRouter API key
  aiOpenRouterKeyInput?.addEventListener('change', async () => {
    state.settings.ai = state.settings.ai || {};
    state.settings.ai.openRouterApiKey = aiOpenRouterKeyInput.value.trim();
    await saveSettings({ ai: state.settings.ai });
  });

  // Preferred AI model
  aiPreferredModelSelect?.addEventListener('change', async () => {
    state.settings.ai = state.settings.ai || {};
    state.settings.ai.preferredModel = aiPreferredModelSelect.value || 'codex-5.3';
    await saveSettings({ ai: state.settings.ai });
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
  
  // AI assistant settings
  const ai = state.settings.ai || {};
  aiOpenRouterKeyInput.value = ai.openRouterApiKey || '';
  aiPreferredModelSelect.value = ai.preferredModel || 'codex-5.3';

  // Load image gallery
  loadImageGallery();
}

/**
