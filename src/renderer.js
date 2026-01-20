// DOM Elements
const tabBtns = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
const scriptsList = document.getElementById('scripts-list');
const hotkeysList = document.getElementById('hotkeys-list');
const outputLog = document.getElementById('output-log');
const refreshBtn = document.getElementById('refresh-scripts');
const openFolderBtn = document.getElementById('open-folder');
const addHotkeyBtn = document.getElementById('add-hotkey');
const hotkeyModal = document.getElementById('hotkey-modal');
const modalTitle = document.getElementById('modal-title');
const hotkeyRecorder = document.getElementById('hotkey-recorder');
const recordedKeysEl = document.getElementById('recorded-keys');
const hotkeyTextInput = document.getElementById('hotkey-text');
const pressEnterCheckbox = document.getElementById('press-enter');
const saveHotkeyBtn = document.getElementById('save-hotkey');
const cancelHotkeyBtn = document.getElementById('cancel-hotkey');
const modalCloseBtn = document.querySelector('#hotkey-modal .modal-close');

// Settings DOM Elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsCloseBtn = document.getElementById('settings-close');
const scriptsDirInput = document.getElementById('scripts-dir');
const browseDirBtn = document.getElementById('browse-dir');
const saveSettingsBtn = document.getElementById('save-settings');
const cancelSettingsBtn = document.getElementById('cancel-settings');
const cmdPythonInput = document.getElementById('cmd-python');
const cmdJsInput = document.getElementById('cmd-js');
const cmdLuaInput = document.getElementById('cmd-lua');

// State
let currentHotkeyId = null;
let recordedKeys = [];
let isRecording = false;

// Tab Switching
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.dataset.tab;

    tabBtns.forEach(b => b.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById(`${tabName}-panel`).classList.add('active');
  });
});

// Scripts Management
async function loadScripts() {
  const scripts = await window.api.getScripts();

  if (scripts.length === 0) {
    scriptsList.innerHTML = `
      <div class="empty-state">
        <p>No scripts found</p>
        <p class="hint">Add .py, .js, or .lua files to the scripts folder</p>
      </div>
    `;
    return;
  }

  scriptsList.innerHTML = scripts.map(script => `
    <div class="script-item" data-name="${script.name}">
      <div class="script-icon ${script.type}">${script.type.toUpperCase()}</div>
      <div class="script-info">
        <div class="script-name">${script.name}</div>
        <div class="script-status">
          <span class="status-dot ${script.running ? 'running' : ''}"></span>
          ${script.running ? 'Running' : 'Stopped'}
        </div>
      </div>
      <div class="script-actions">
        ${script.running
          ? `<button class="btn btn-danger btn-sm" onclick="stopScript('${script.name}')">Stop</button>`
          : `<button class="btn btn-success btn-sm" onclick="startScript('${script.name}')">Start</button>`
        }
      </div>
    </div>
  `).join('');
}

window.startScript = async function(name) {
  const result = await window.api.startScript(name);
  if (result.success) {
    addOutputLine(`Started: ${name}`, 'info');
    loadScripts();
  } else {
    addOutputLine(`Error starting ${name}: ${result.error}`, 'error');
  }
};

window.stopScript = async function(name) {
  const result = await window.api.stopScript(name);
  if (result.success) {
    addOutputLine(`Stopped: ${name}`, 'info');
    loadScripts();
  } else {
    addOutputLine(`Error stopping ${name}: ${result.error}`, 'error');
  }
};

function addOutputLine(text, type = '') {
  const line = document.createElement('div');
  line.className = `output-line ${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  outputLog.appendChild(line);
  outputLog.scrollTop = outputLog.scrollHeight;
}

// Script output listeners
window.api.onScriptOutput(({ script, data }) => {
  addOutputLine(`[${script}] ${data.trim()}`);
});

window.api.onScriptError(({ script, data }) => {
  addOutputLine(`[${script}] ${data.trim()}`, 'error');
});

window.api.onScriptStopped(({ script, code }) => {
  addOutputLine(`[${script}] Process exited with code ${code}`, 'info');
  loadScripts();
});

// Hotkeys Management
async function loadHotkeys() {
  const hotkeys = await window.api.getHotkeys();

  if (hotkeys.length === 0) {
    hotkeysList.innerHTML = `
      <div class="empty-state">
        <p>No hotkeys configured</p>
        <p class="hint">Click "Add Hotkey" to create one</p>
      </div>
    `;
    return;
  }

  hotkeysList.innerHTML = hotkeys.map(hk => `
    <div class="hotkey-item" data-id="${hk.id}">
      <div class="hotkey-keys">
        ${hk.keys.map(k => `<span class="key-badge">${formatKeyName(k)}</span>`).join('')}
      </div>
      <div class="hotkey-details">
        <div class="hotkey-text">${escapeHtml(hk.text)}</div>
        <div class="hotkey-meta">${hk.pressEnter ? 'Press Enter after typing' : 'No Enter after typing'}</div>
      </div>
      <div class="hotkey-actions">
        <button class="btn btn-secondary btn-sm" onclick="editHotkey('${hk.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteHotkey('${hk.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function formatKeyName(key) {
  const map = {
    'Control': 'Ctrl',
    'Meta': 'Win',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    ' ': 'Space'
  };
  return map[key] || key;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Modal Functions
function openModal(isEdit = false) {
  hotkeyModal.classList.add('active');
  modalTitle.textContent = isEdit ? 'Edit Hotkey' : 'Add Hotkey';
  if (!isEdit) {
    currentHotkeyId = null;
    recordedKeys = [];
    hotkeyTextInput.value = '';
    pressEnterCheckbox.checked = false;
    updateRecordedKeysDisplay();
  }
}

function closeModal() {
  hotkeyModal.classList.remove('active');
  isRecording = false;
  hotkeyRecorder.classList.remove('recording');
}

window.editHotkey = async function(id) {
  const hotkeys = await window.api.getHotkeys();
  const hotkey = hotkeys.find(h => h.id === id);

  if (hotkey) {
    currentHotkeyId = id;
    recordedKeys = [...hotkey.keys];
    hotkeyTextInput.value = hotkey.text;
    pressEnterCheckbox.checked = hotkey.pressEnter;
    updateRecordedKeysDisplay();
    openModal(true);
  }
};

window.deleteHotkey = async function(id) {
  if (confirm('Delete this hotkey?')) {
    await window.api.deleteHotkey(id);
    loadHotkeys();
  }
};

// Hotkey Recording
hotkeyRecorder.addEventListener('click', () => {
  if (!isRecording) {
    startRecording();
  }
});

hotkeyRecorder.addEventListener('keydown', (e) => {
  if (!isRecording) return;

  e.preventDefault();
  e.stopPropagation();

  if (e.key === 'Escape') {
    stopRecording();
    return;
  }

  const key = normalizeKey(e);

  if (!recordedKeys.includes(key)) {
    recordedKeys.push(key);
    updateRecordedKeysDisplay();
  }
});

hotkeyRecorder.addEventListener('keyup', (e) => {
  if (isRecording && recordedKeys.length > 0) {
    // Stop recording on key release if we have keys
    const modifiers = ['Control', 'Alt', 'Shift', 'Meta'];
    const hasNonModifier = recordedKeys.some(k => !modifiers.includes(k));

    if (hasNonModifier) {
      stopRecording();
    }
  }
});

function normalizeKey(e) {
  if (e.key === 'Control') return 'Control';
  if (e.key === 'Alt') return 'Alt';
  if (e.key === 'Shift') return 'Shift';
  if (e.key === 'Meta') return 'Meta';

  // For letter keys, use uppercase
  if (e.key.length === 1) {
    return e.key.toUpperCase();
  }

  return e.key;
}

function startRecording() {
  isRecording = true;
  recordedKeys = [];
  hotkeyRecorder.classList.add('recording');
  hotkeyRecorder.querySelector('.recorder-text').textContent = 'Recording... Press your keys';
  updateRecordedKeysDisplay();
}

function stopRecording() {
  isRecording = false;
  hotkeyRecorder.classList.remove('recording');
  hotkeyRecorder.querySelector('.recorder-text').textContent = 'Click to record hotkey';
}

function updateRecordedKeysDisplay() {
  if (recordedKeys.length === 0) {
    recordedKeysEl.innerHTML = '';
    return;
  }

  recordedKeysEl.innerHTML = recordedKeys
    .map(k => `<span class="key-badge">${formatKeyName(k)}</span>`)
    .join('');
}

// Save Hotkey
saveHotkeyBtn.addEventListener('click', async () => {
  if (recordedKeys.length === 0) {
    return;
  }

  const text = hotkeyTextInput.value.trim();
  if (!text) {
    return;
  }

  const hotkeyConfig = {
    id: currentHotkeyId || `hk_${Date.now()}`,
    keys: recordedKeys,
    text: text,
    pressEnter: pressEnterCheckbox.checked
  };

  const result = await window.api.saveHotkey(hotkeyConfig);

  if (result.success) {
    closeModal();
    loadHotkeys();
  }
});

// Event Listeners
refreshBtn.addEventListener('click', loadScripts);
openFolderBtn.addEventListener('click', () => window.api.openScriptsFolder());
addHotkeyBtn.addEventListener('click', () => openModal(false));
cancelHotkeyBtn.addEventListener('click', closeModal);
modalCloseBtn.addEventListener('click', closeModal);

hotkeyModal.addEventListener('click', (e) => {
  if (e.target === hotkeyModal) {
    closeModal();
  }
});

// Settings Functions
function openSettingsModal() {
  settingsModal.classList.add('active');
  loadSettings();
}

function closeSettingsModal() {
  settingsModal.classList.remove('active');
}

async function loadSettings() {
  const settings = await window.api.getSettings();
  scriptsDirInput.value = settings.scriptsDir || '';
  cmdPythonInput.value = settings.commands?.py || '';
  cmdJsInput.value = settings.commands?.js || '';
  cmdLuaInput.value = settings.commands?.lua || '';
}

settingsBtn.addEventListener('click', openSettingsModal);
settingsCloseBtn.addEventListener('click', closeSettingsModal);
cancelSettingsBtn.addEventListener('click', closeSettingsModal);

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    closeSettingsModal();
  }
});

browseDirBtn.addEventListener('click', async () => {
  const result = await window.api.browseDirectory();
  if (result) {
    scriptsDirInput.value = result;
  }
});

saveSettingsBtn.addEventListener('click', async () => {
  const scriptsDir = scriptsDirInput.value.trim();
  const commands = {
    py: cmdPythonInput.value.trim(),
    js: cmdJsInput.value.trim(),
    lua: cmdLuaInput.value.trim()
  };

  const result = await window.api.saveSettings({ scriptsDir, commands });

  if (result.success) {
    closeSettingsModal();
    loadScripts();
    addOutputLine('Settings saved. Scripts reloaded.', 'info');
  } else {
    addOutputLine(`Error saving settings: ${result.error}`, 'error');
  }
});

// Initial Load
loadScripts();
loadHotkeys();

// Auto-refresh scripts every 5 seconds
setInterval(loadScripts, 5000);
