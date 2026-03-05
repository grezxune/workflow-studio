/**
 * Render config fields for an action
 */
async function renderConfigFields(action, index, targetConfigBody, saveCallback) {
  const configBody = targetConfigBody || document.getElementById('config-body');
  const save = saveCallback || (() => updateAction(index, action));
  const rerender = () => renderConfigFields(action, index, configBody, save);
  configBody.innerHTML = '';

  // Add name field at the top for all actions
  const nameFieldHtml = `
    <div class="config-field">
      <label>Action Name (optional)</label>
      <input type="text" id="config-action-name" value="${escapeHtml(action.name || '')}" placeholder="Give this action a name...">
      <p class="config-field-hint">A custom name to identify this action</p>
    </div>
    <hr style="border: none; border-top: 1px solid var(--border-color); margin: var(--space-4) 0;">
  `;

  // Name field listener (shared across all types)
  function setupName() {
    const nameInput = document.getElementById('config-action-name');
    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        action.name = e.target.value.trim() || undefined;
        save();
      });
    }
  }

  switch (action.type) {
    case 'mouse_move':
      action.moveMode = action.moveMode || 'point';
      const modeHints = {
        point: 'Move to an exact position',
        bounds: 'Move to a random point within a rectangular area',
        image: 'Find an image on screen and move to a random point within it'
      };
      configBody.innerHTML = nameFieldHtml + `
        <div class="config-field">
          <label>Move Mode</label>
          <div class="toggle-group">
            <button class="toggle-btn ${action.moveMode === 'point' ? 'active' : ''}" data-mode="point">Point</button>
            <button class="toggle-btn ${action.moveMode === 'bounds' ? 'active' : ''}" data-mode="bounds">Bounding Box</button>
            <button class="toggle-btn ${action.moveMode === 'image' ? 'active' : ''}" data-mode="image">Image</button>
          </div>
          <p class="config-field-hint">${modeHints[action.moveMode]}</p>
        </div>
        <div id="point-fields" ${action.moveMode !== 'point' ? 'style="display:none"' : ''}>
          <div class="config-field">
            <label>X Position</label>
            <input type="number" id="config-x" value="${action.x || 0}">
          </div>
          <div class="config-field">
            <label>Y Position</label>
            <input type="number" id="config-y" value="${action.y || 0}">
          </div>
          <div class="config-field">
            <button class="btn btn-secondary" id="btn-pick-position">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                <circle cx="12" cy="12" r="10"/>
                <line x1="22" y1="12" x2="18" y2="12"/>
                <line x1="6" y1="12" x2="2" y2="12"/>
                <line x1="12" y1="6" x2="12" y2="2"/>
                <line x1="12" y1="22" x2="12" y2="18"/>
              </svg>
              Pick from Screen
            </button>
            <p class="config-field-hint">Click to select position with your mouse</p>
          </div>
        </div>
        <div id="bounds-fields" ${action.moveMode !== 'bounds' ? 'style="display:none"' : ''}>
          <div class="config-field">
            <label>Top-Left X</label>
            <input type="number" id="config-bounds-x" value="${action.bounds?.x || 0}">
          </div>
          <div class="config-field">
            <label>Top-Left Y</label>
            <input type="number" id="config-bounds-y" value="${action.bounds?.y || 0}">
          </div>
          <div class="config-field">
            <label>Width</label>
            <input type="number" id="config-bounds-w" min="1" value="${action.bounds?.width || 100}">
          </div>
          <div class="config-field">
            <label>Height</label>
            <input type="number" id="config-bounds-h" min="1" value="${action.bounds?.height || 100}">
          </div>
          <div class="config-field">
            <button class="btn btn-secondary" id="btn-pick-bounds">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="9" y1="21" x2="9" y2="9"/>
              </svg>
              Pick Region from Screen
            </button>
            <p class="config-field-hint">Click and drag to select a rectangular region</p>
          </div>
        </div>
        <div id="image-fields" ${action.moveMode !== 'image' ? 'style="display:none"' : ''}>
          <div class="config-field">
            <label>Image Template</label>
            <div id="config-move-image-id"></div>
          </div>
          <div class="config-field">
            <button class="btn btn-secondary" id="btn-capture-move-image">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Capture New Image
            </button>
          </div>
          <div class="config-field">
            <label>Match Confidence: <span id="move-conf-value">${Math.round((action.imageConfidence || 0.9) * 100)}%</span></label>
            <input type="range" id="config-move-confidence" min="50" max="100" value="${Math.round((action.imageConfidence || 0.9) * 100)}">
            <p class="config-field-hint">Higher values require closer match</p>
          </div>
          <div class="config-field">
            <label class="checkbox-label">
              <input type="checkbox" id="config-move-search-region-enabled" ${action.searchRegion ? 'checked' : ''}>
              Limit search region
            </label>
            <p class="config-field-hint">Only search a portion of the screen (much faster)</p>
          </div>
          <div id="move-search-region-fields" ${!action.searchRegion ? 'style="display:none"' : ''}>
            <div class="config-field">
              <button class="btn btn-secondary" id="btn-pick-move-search-region">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
                  <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
                </svg>
                Pick Search Region
              </button>
            </div>
            <div class="config-field config-row" id="move-search-region-display" ${!action.searchRegion ? 'style="display:none"' : ''}>
              <div class="config-col">
                <label>X</label>
                <input type="number" id="config-msr-x" value="${action.searchRegion?.x ?? 0}" min="0">
              </div>
              <div class="config-col">
                <label>Y</label>
                <input type="number" id="config-msr-y" value="${action.searchRegion?.y ?? 0}" min="0">
              </div>
              <div class="config-col">
                <label>W</label>
                <input type="number" id="config-msr-w" value="${action.searchRegion?.width ?? 200}" min="1">
              </div>
              <div class="config-col">
                <label>H</label>
                <input type="number" id="config-msr-h" value="${action.searchRegion?.height ?? 200}" min="1">
              </div>
            </div>
          </div>
          <div class="config-field">
            <label class="checkbox-label">
              <input type="checkbox" id="config-move-scale-down" ${action.scaleDown ? 'checked' : ''}>
              Scale down for speed
            </label>
            <p class="config-field-hint">Reduces resolution before matching (faster but slightly less precise)</p>
          </div>
          <div class="config-field">
            <label class="checkbox-label">
              <input type="checkbox" id="config-move-fail-not-found" ${action.failOnNotFound ? 'checked' : ''}>
              Fail if image not found
            </label>
          </div>
        </div>
        <div class="config-field">
          <label>Movement Duration (ms)</label>
          <input type="number" id="config-duration" min="0" max="5000" value="${action.duration ?? ''}" placeholder="Use default">
          <p class="config-field-hint">Override global setting (leave empty for default)</p>
        </div>
      `;

      setupName();

      // Mode toggle
      configBody.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          action.moveMode = btn.dataset.mode;
          save();
          rerender();
        });
      });

      // Point mode fields
      document.getElementById('config-x').addEventListener('change', (e) => {
        action.x = parseInt(e.target.value) || 0;
        save();
      });

      document.getElementById('config-y').addEventListener('change', (e) => {
        action.y = parseInt(e.target.value) || 0;
        save();
      });

      document.getElementById('btn-pick-position').addEventListener('click', async () => {
        await pickPositionFromScreen((pos) => {
          document.getElementById('config-x').value = pos.x;
          document.getElementById('config-y').value = pos.y;
          action.x = pos.x;
          action.y = pos.y;
          save();
        });
      });

      // Bounds mode fields
      document.getElementById('config-bounds-x').addEventListener('change', (e) => {
        action.bounds = action.bounds || { x: 0, y: 0, width: 100, height: 100 };
        action.bounds.x = parseInt(e.target.value) || 0;
        save();
      });

      document.getElementById('config-bounds-y').addEventListener('change', (e) => {
        action.bounds = action.bounds || { x: 0, y: 0, width: 100, height: 100 };
        action.bounds.y = parseInt(e.target.value) || 0;
        save();
      });

      document.getElementById('config-bounds-w').addEventListener('change', (e) => {
        action.bounds = action.bounds || { x: 0, y: 0, width: 100, height: 100 };
        action.bounds.width = Math.max(1, parseInt(e.target.value) || 100);
        save();
      });

      document.getElementById('config-bounds-h').addEventListener('change', (e) => {
        action.bounds = action.bounds || { x: 0, y: 0, width: 100, height: 100 };
        action.bounds.height = Math.max(1, parseInt(e.target.value) || 100);
        save();
      });

      document.getElementById('btn-pick-bounds').addEventListener('click', async () => {
        await pickRegionFromScreen((region) => {
          action.bounds = { x: region.x, y: region.y, width: region.width, height: region.height };
          document.getElementById('config-bounds-x').value = region.x;
          document.getElementById('config-bounds-y').value = region.y;
          document.getElementById('config-bounds-w').value = region.width;
          document.getElementById('config-bounds-h').value = region.height;
          save();
        });
      });

      // Image mode fields
      const moveImagePicker = await loadImageOptions('config-move-image-id', action.imageId, (val) => {
        action.imageId = val;
        save();
      });

      document.getElementById('btn-capture-move-image').addEventListener('click', () => {
        captureImageTemplate((imageId) => {
          action.imageId = imageId;
          if (moveImagePicker) { moveImagePicker.setValue(imageId); moveImagePicker.refresh(); }
          save();
        });
      });

      document.getElementById('config-move-confidence').addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        document.getElementById('move-conf-value').textContent = val + '%';
        action.imageConfidence = val / 100;
        save();
      });

      document.getElementById('config-move-fail-not-found').addEventListener('change', (e) => {
        action.failOnNotFound = e.target.checked;
        save();
      });

      // Mouse move search region
      document.getElementById('config-move-search-region-enabled').addEventListener('change', (e) => {
        const fields = document.getElementById('move-search-region-fields');
        if (e.target.checked) {
          action.searchRegion = action.searchRegion || { x: 0, y: 0, width: 200, height: 200 };
          fields.style.display = '';
          document.getElementById('move-search-region-display').style.display = '';
        } else {
          action.searchRegion = null;
          fields.style.display = 'none';
        }
        save();
      });

      document.getElementById('btn-pick-move-search-region').addEventListener('click', async () => {
        await pickRegionFromScreen((region) => {
          action.searchRegion = { x: region.x, y: region.y, width: region.width, height: region.height };
          document.getElementById('config-msr-x').value = region.x;
          document.getElementById('config-msr-y').value = region.y;
          document.getElementById('config-msr-w').value = region.width;
          document.getElementById('config-msr-h').value = region.height;
          document.getElementById('move-search-region-display').style.display = '';
          save();
        });
      });

      ['config-msr-x', 'config-msr-y', 'config-msr-w', 'config-msr-h'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', (e) => {
          action.searchRegion = action.searchRegion || { x: 0, y: 0, width: 200, height: 200 };
          const key = { 'config-msr-x': 'x', 'config-msr-y': 'y', 'config-msr-w': 'width', 'config-msr-h': 'height' }[id];
          action.searchRegion[key] = Math.max(0, parseInt(e.target.value) || 0);
          save();
        });
      });

      // Mouse move scale down
      document.getElementById('config-move-scale-down').addEventListener('change', (e) => {
        action.scaleDown = e.target.checked;
        save();
      });

      document.getElementById('config-duration').addEventListener('change', (e) => {
        const val = e.target.value.trim();
        action.duration = val === '' ? undefined : parseInt(val);
        save();
      });
      break;

    case 'mouse_click':
      configBody.innerHTML = nameFieldHtml + `
        <div class="config-field">
          <label>Button</label>
          <select id="config-button">
            <option value="left" ${action.button === 'left' ? 'selected' : ''}>Left</option>
            <option value="right" ${action.button === 'right' ? 'selected' : ''}>Right</option>
            <option value="middle" ${action.button === 'middle' ? 'selected' : ''}>Middle</option>
          </select>
        </div>
        <div class="config-field">
          <label>Click Type</label>
          <select id="config-click-type">
            <option value="single" ${action.clickType === 'single' ? 'selected' : ''}>Single Click</option>
            <option value="double" ${action.clickType === 'double' ? 'selected' : ''}>Double Click</option>
          </select>
        </div>
        <div class="config-field">
          <label>Position (optional)</label>
          <div class="input-group">
            <input type="number" id="config-click-x" placeholder="X" value="${action.x ?? ''}">
            <input type="number" id="config-click-y" placeholder="Y" value="${action.y ?? ''}">
          </div>
          <p class="config-field-hint">Leave empty to click at current position</p>
        </div>
        <div class="config-field">
          <label class="checkbox-label">
            <input type="checkbox" id="config-click-jitter" ${action.jitter !== false ? 'checked' : ''}>
            Click jitter
          </label>
          <p class="config-field-hint">Adds a small random offset to the click position for human-like imprecision</p>
        </div>
      `;

      setupName();

      document.getElementById('config-click-jitter').addEventListener('change', (e) => {
        action.jitter = e.target.checked;
        save();
      });

      document.getElementById('config-button').addEventListener('change', (e) => {
        action.button = e.target.value;
        save();
      });

      document.getElementById('config-click-type').addEventListener('change', (e) => {
        action.clickType = e.target.value;
        save();
      });

      document.getElementById('config-click-x').addEventListener('change', (e) => {
        action.x = e.target.value ? parseInt(e.target.value) : undefined;
        save();
      });

      document.getElementById('config-click-y').addEventListener('change', (e) => {
        action.y = e.target.value ? parseInt(e.target.value) : undefined;
        save();
      });
      break;

    case 'keyboard':
      action.actions = action.actions || [];
      configBody.innerHTML = nameFieldHtml + `
        <div class="config-field">
          <label>Mode</label>
          <select id="config-kb-mode">
            <option value="type" ${action.mode === 'type' ? 'selected' : ''}>Type Text</option>
            <option value="press" ${action.mode === 'press' ? 'selected' : ''}>Press Key</option>
            <option value="hold_and_act" ${action.mode === 'hold_and_act' ? 'selected' : ''}>Hold Key + Actions</option>
          </select>
        </div>
        <div class="config-field" id="field-text" ${action.mode !== 'type' ? 'style="display:none"' : ''}>
          <label>Text to Type</label>
          <textarea id="config-text" rows="3">${action.text || ''}</textarea>
        </div>
        <div class="config-field" id="field-key" ${(action.mode !== 'press' && action.mode !== 'hold_and_act') ? 'style="display:none"' : ''}>
          <label>Key to ${action.mode === 'hold_and_act' ? 'Hold' : 'Press'}</label>
          <div class="key-recorder" id="key-recorder">
            <div class="key-recorder-display" id="key-recorder-display">
              ${action.key ? `<span class="key-badge">${escapeHtml(action.key)}</span>` : '<span class="key-recorder-placeholder">No key set</span>'}
            </div>
            <button class="btn btn-sm key-recorder-btn" id="key-recorder-btn" type="button">
              <span class="key-recorder-btn-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="3" fill="currentColor"/>
                </svg>
              </span>
              <span class="key-recorder-btn-label">Record Key</span>
            </button>
          </div>
          <input type="text" id="config-key" value="${action.key || ''}" placeholder="Or type manually: shift, ctrl+a" class="key-recorder-manual">
        </div>
        <div id="field-hold-actions" ${action.mode !== 'hold_and_act' ? 'style="display:none"' : ''}>
          <div class="config-section">
            <div class="config-section-header">
              <span>Actions while held: <span id="hold-actions-count">${action.actions.length}</span> actions</span>
              <button class="btn btn-secondary btn-sm" id="btn-edit-hold-actions">Edit</button>
            </div>
            <p class="config-field-hint">These actions run while the key is held down. The key is released after all actions complete.</p>
          </div>
        </div>
      `;

      setupName();

      const updateKbFieldVisibility = (mode) => {
        document.getElementById('field-text').style.display = mode === 'type' ? '' : 'none';
        document.getElementById('field-key').style.display = (mode === 'press' || mode === 'hold_and_act') ? '' : 'none';
        document.getElementById('field-hold-actions').style.display = mode === 'hold_and_act' ? '' : 'none';
        const keyLabel = document.querySelector('#field-key label');
        if (keyLabel) keyLabel.textContent = mode === 'hold_and_act' ? 'Key to Hold' : 'Key or Combo';
      };

      document.getElementById('config-kb-mode').addEventListener('change', (e) => {
        action.mode = e.target.value;
        if (e.target.value === 'hold_and_act' && !action.actions) {
          action.actions = [];
        }
        updateKbFieldVisibility(e.target.value);
        save();
      });

      document.getElementById('config-text').addEventListener('input', (e) => {
        action.text = e.target.value;
        save();
      });

      // Manual key input
      document.getElementById('config-key').addEventListener('change', (e) => {
        action.key = e.target.value;
        updateKeyRecorderDisplay(action.key);
        save();
      });

      // Key recorder
      setupKeyRecorder(action, save);

      document.getElementById('btn-edit-hold-actions')?.addEventListener('click', () => {
        openNestedActionsEditor(action, 'actions', 'Hold Key Actions', index);
      });
      break;

    case 'wait':
      configBody.innerHTML = nameFieldHtml + `
        <div class="config-field">
          <label>Duration (milliseconds)</label>
          <div class="range-inputs">
            <input type="number" id="config-wait-min" min="0" max="60000" value="${action.duration?.min || 500}">
            <span>to</span>
            <input type="number" id="config-wait-max" min="0" max="60000" value="${action.duration?.max || 1000}">
          </div>
          <p class="config-field-hint">Random delay between min and max for natural timing</p>
        </div>
      `;

      setupName();

      document.getElementById('config-wait-min').addEventListener('change', (e) => {
        action.duration = action.duration || {};
        action.duration.min = parseInt(e.target.value) || 500;
        save();
      });

      document.getElementById('config-wait-max').addEventListener('change', (e) => {
        action.duration = action.duration || {};
        action.duration.max = parseInt(e.target.value) || 1000;
        save();
      });
      break;

    case 'conditional':
      renderConditionalConfig(configBody, action, index, nameFieldHtml, save);
      break;

    case 'loop':
      renderLoopConfig(configBody, action, index, nameFieldHtml, save);
      break;

    case 'image_detect':
      renderImageDetectConfig(configBody, action, index, nameFieldHtml, save);
      break;

    case 'pixel_detect':
      renderPixelDetectConfig(configBody, action, index, nameFieldHtml, save);
      break;

    default:
      configBody.innerHTML = '<p style="color: var(--text-secondary);">Unknown action type.</p>';
  }
}

/**
 * Update an action and save
 */
function updateAction(index, action) {
  if (!state.currentWorkflow) return;

  state.currentWorkflow.actions[index] = action;
  markDirty();
  renderActionSequence();
  saveCurrentWorkflow();
}

/**
 * Render Conditional action config
 */
async function renderConditionalConfig(configBody, action, index, nameFieldHtml = '', save) {
  if (!save) save = () => updateAction(index, action);
  action.condition = action.condition || { type: 'image_present' };
  action.thenActions = action.thenActions || [];
  action.elseActions = action.elseActions || [];

  configBody.innerHTML = nameFieldHtml + `
    <div class="config-field">
      <label>Condition Type</label>
      <select id="config-condition-type">
        <option value="image_present" ${action.condition.type === 'image_present' ? 'selected' : ''}>Image Present</option>
        <option value="image_absent" ${action.condition.type === 'image_absent' ? 'selected' : ''}>Image Absent</option>
        <option value="pixel_match" ${action.condition.type === 'pixel_match' ? 'selected' : ''}>Pixel Color Match</option>
      </select>
    </div>
    <div class="config-field" id="cond-image-field" ${action.condition.type === 'pixel_match' ? 'style="display:none"' : ''}>
      <label>Image Template</label>
      <div id="config-condition-image"></div>
      <button class="btn btn-secondary btn-sm" id="btn-capture-cond-image" style="margin-top:8px">
        Capture New Image
      </button>
    </div>
    <div class="config-field" id="cond-confidence-field" ${action.condition.type === 'pixel_match' ? 'style="display:none"' : ''}>
      <label>Match Confidence: <span id="cond-conf-value">${Math.round((action.condition.confidence || 0.9) * 100)}%</span></label>
      <input type="range" id="config-condition-confidence" min="50" max="100" value="${Math.round((action.condition.confidence || 0.9) * 100)}">
    </div>
    <div class="config-field" id="cond-pixel-field" ${action.condition.type !== 'pixel_match' ? 'style="display:none"' : ''}>
      <label>Pixel Color</label>
      <div class="color-picker-row">
        <input type="color" id="config-condition-color" value="${rgbToHex(action.condition.color)}">
        <span id="cond-color-preview" style="display:inline-block;width:24px;height:24px;border-radius:4px;background:${rgbToHex(action.condition.color)};border:1px solid var(--border)"></span>
      </div>
    </div>
    <div class="config-field" id="cond-tolerance-field" ${action.condition.type !== 'pixel_match' ? 'style="display:none"' : ''}>
      <label>Color Tolerance: <span id="cond-tol-value">${action.condition.tolerance || 10}</span></label>
      <input type="range" id="config-condition-tolerance" min="0" max="50" value="${action.condition.tolerance || 10}">
    </div>
    <div class="config-section">
      <div class="config-section-header">
        <span>Then (if true): <span id="then-actions-count">${action.thenActions.length}</span> actions</span>
        <button class="btn btn-secondary btn-sm" id="btn-edit-then">Edit</button>
      </div>
    </div>
    <div class="config-section">
      <div class="config-section-header">
        <span>Else (if false): <span id="else-actions-count">${action.elseActions.length}</span> actions</span>
        <button class="btn btn-secondary btn-sm" id="btn-edit-else">Edit</button>
      </div>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-continue-error" ${action.continueOnError ? 'checked' : ''}>
        Continue on error
      </label>
    </div>
  `;

  // Load images for dropdown
  const condImagePicker = await loadImageOptions('config-condition-image', action.condition.imageId, (val) => {
    action.condition.imageId = val;
    save();
  });

  const nameInput = document.getElementById('config-action-name');
  if (nameInput) {
    nameInput.addEventListener('input', (e) => {
      action.name = e.target.value.trim() || undefined;
      save();
    });
  }

  document.getElementById('config-condition-type').addEventListener('change', (e) => {
    action.condition.type = e.target.value;
    const isPixel = e.target.value === 'pixel_match';
    document.getElementById('cond-image-field').style.display = isPixel ? 'none' : '';
    document.getElementById('cond-confidence-field').style.display = isPixel ? 'none' : '';
    document.getElementById('cond-pixel-field').style.display = isPixel ? '' : 'none';
    document.getElementById('cond-tolerance-field').style.display = isPixel ? '' : 'none';
    save();
  });

  document.getElementById('config-condition-confidence').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('cond-conf-value').textContent = val + '%';
    action.condition.confidence = val / 100;
    save();
  });

  document.getElementById('config-condition-color').addEventListener('change', (e) => {
    action.condition.color = hexToRgb(e.target.value);
    document.getElementById('cond-color-preview').style.background = e.target.value;
    save();
  });

  document.getElementById('config-condition-tolerance').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('cond-tol-value').textContent = val;
    action.condition.tolerance = val;
    save();
  });

  document.getElementById('btn-capture-cond-image').addEventListener('click', () => {
    captureImageTemplate((imageId) => {
      action.condition.imageId = imageId;
      if (condImagePicker) { condImagePicker.setValue(imageId); condImagePicker.refresh(); }
      save();
    });
  });

  document.getElementById('btn-edit-then').addEventListener('click', () => {
    openNestedActionsEditor(action, 'thenActions', 'Then Actions', index);
  });

  document.getElementById('btn-edit-else').addEventListener('click', () => {
    openNestedActionsEditor(action, 'elseActions', 'Else Actions', index);
  });

  document.getElementById('config-continue-error').addEventListener('change', (e) => {
    action.continueOnError = e.target.checked;
    save();
  });
}

/**
 * Render Loop action config
 */
function renderLoopConfig(configBody, action, index, nameFieldHtml = '', save) {
  if (!save) save = () => updateAction(index, action);
  action.actions = action.actions || [];
  action.delay = action.delay || { min: 500, max: 1000 };

  configBody.innerHTML = nameFieldHtml + `
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-loop-infinite" ${action.infinite ? 'checked' : ''}>
        Infinite loop
      </label>
      <p class="config-field-hint">Loop forever until the workflow is stopped</p>
    </div>
    <div class="config-field" id="loop-count-field" ${action.infinite ? 'style="display:none"' : ''}>
      <label>Number of Iterations</label>
      <input type="number" id="config-loop-count" min="1" max="10000" value="${action.count || 3}">
    </div>
    <div class="config-field">
      <label>Delay Between Iterations (ms)</label>
      <div class="range-inputs">
        <input type="number" id="config-loop-delay-min" min="0" max="60000" value="${action.delay.min || 500}">
        <span>to</span>
        <input type="number" id="config-loop-delay-max" min="0" max="60000" value="${action.delay.max || 1000}">
      </div>
    </div>
    <div class="config-section">
      <div class="config-section-header">
        <span>Loop Actions: <span id="loop-actions-count">${action.actions.length}</span> actions</span>
        <button class="btn btn-secondary btn-sm" id="btn-edit-loop-actions">Edit</button>
      </div>
      <p class="config-field-hint">These actions will repeat for each iteration</p>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-loop-continue-error" ${action.continueOnError ? 'checked' : ''}>
        Continue on error
      </label>
    </div>
  `;

  const nameInput = document.getElementById('config-action-name');
  if (nameInput) {
    nameInput.addEventListener('input', (e) => {
      action.name = e.target.value.trim() || undefined;
      save();
    });
  }

  document.getElementById('config-loop-infinite').addEventListener('change', (e) => {
    action.infinite = e.target.checked;
    document.getElementById('loop-count-field').style.display = e.target.checked ? 'none' : '';
    save();
  });

  document.getElementById('config-loop-count').addEventListener('change', (e) => {
    action.count = parseInt(e.target.value) || 3;
    save();
  });

  document.getElementById('config-loop-delay-min').addEventListener('change', (e) => {
    action.delay.min = parseInt(e.target.value) || 500;
    save();
  });

  document.getElementById('config-loop-delay-max').addEventListener('change', (e) => {
    action.delay.max = parseInt(e.target.value) || 1000;
    save();
  });

  document.getElementById('btn-edit-loop-actions').addEventListener('click', () => {
    openNestedActionsEditor(action, 'actions', 'Loop Actions', index);
  });

  document.getElementById('config-loop-continue-error').addEventListener('change', (e) => {
    action.continueOnError = e.target.checked;
    save();
  });
}

/**
 * Render Image Detect action config
 */
async function renderImageDetectConfig(configBody, action, index, nameFieldHtml = '', save) {
  if (!save) save = () => updateAction(index, action);
  configBody.innerHTML = nameFieldHtml + `
    <div class="config-field">
      <label>Image Template</label>
      <div id="config-image-id"></div>
    </div>
    <div class="config-field">
      <button class="btn btn-secondary" id="btn-capture-image">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        Capture New Image
      </button>
    </div>
    <div class="config-field" id="image-preview-container" style="display:none">
      <label>Preview</label>
      <img id="image-preview" style="max-width:100%;max-height:150px;border-radius:4px;border:1px solid var(--border)">
    </div>
    <div class="config-field">
      <label>Match Confidence: <span id="conf-value">${Math.round((action.confidence || 0.9) * 100)}%</span></label>
      <input type="range" id="config-confidence" min="50" max="100" value="${Math.round((action.confidence || 0.9) * 100)}">
      <p class="config-field-hint">Higher values require closer match</p>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-wait-until-found" ${action.waitUntilFound ? 'checked' : ''}>
        Wait until found
      </label>
      <p class="config-field-hint">Keep checking until the image appears on screen</p>
    </div>
    <div class="config-field" id="poll-interval-field" ${!action.waitUntilFound ? 'style="display:none"' : ''}>
      <label>Check interval (ms)</label>
      <input type="number" id="config-poll-interval" min="100" max="30000" value="${action.pollInterval || 500}" placeholder="500">
      <p class="config-field-hint">How often to re-check for the image</p>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-search-region-enabled" ${action.searchRegion ? 'checked' : ''}>
        Limit search region
      </label>
      <p class="config-field-hint">Only search a portion of the screen (much faster)</p>
    </div>
    <div id="search-region-fields" ${!action.searchRegion ? 'style="display:none"' : ''}>
      <div class="config-field">
        <button class="btn btn-secondary" id="btn-pick-search-region">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
            <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
          </svg>
          Pick Search Region
        </button>
      </div>
      <div class="config-field config-row" id="search-region-display" ${!action.searchRegion ? 'style="display:none"' : ''}>
        <div class="config-col">
          <label>X</label>
          <input type="number" id="config-sr-x" value="${action.searchRegion?.x ?? 0}" min="0">
        </div>
        <div class="config-col">
          <label>Y</label>
          <input type="number" id="config-sr-y" value="${action.searchRegion?.y ?? 0}" min="0">
        </div>
        <div class="config-col">
          <label>W</label>
          <input type="number" id="config-sr-w" value="${action.searchRegion?.width ?? 200}" min="1">
        </div>
        <div class="config-col">
          <label>H</label>
          <input type="number" id="config-sr-h" value="${action.searchRegion?.height ?? 200}" min="1">
        </div>
      </div>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-scale-down" ${action.scaleDown ? 'checked' : ''}>
        Scale down for speed
      </label>
      <p class="config-field-hint">Reduces resolution before matching (faster but slightly less precise)</p>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-fail-not-found" ${action.failOnNotFound ? 'checked' : ''} ${action.waitUntilFound ? 'disabled' : ''}>
        Fail if not found
      </label>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-img-continue-error" ${action.continueOnError ? 'checked' : ''}>
        Continue on error
      </label>
    </div>
  `;

  // Load images for dropdown
  const detectImagePicker = await loadImageOptions('config-image-id', action.imageId, (val) => {
    action.imageId = val;
    save();
    updateImagePreview(val);
  });

  const nameInput = document.getElementById('config-action-name');
  if (nameInput) {
    nameInput.addEventListener('input', (e) => {
      action.name = e.target.value.trim() || undefined;
      save();
    });
  }

  document.getElementById('btn-capture-image').addEventListener('click', () => {
    captureImageTemplate((imageId) => {
      action.imageId = imageId;
      if (detectImagePicker) { detectImagePicker.setValue(imageId); detectImagePicker.refresh(); }
      save();
      updateImagePreview(imageId);
    });
  });

  document.getElementById('config-confidence').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('conf-value').textContent = val + '%';
    action.confidence = val / 100;
    save();
  });

  document.getElementById('config-wait-until-found').addEventListener('change', (e) => {
    action.waitUntilFound = e.target.checked;
    const pollField = document.getElementById('poll-interval-field');
    const failCheckbox = document.getElementById('config-fail-not-found');
    if (pollField) pollField.style.display = e.target.checked ? '' : 'none';
    if (failCheckbox) failCheckbox.disabled = e.target.checked;
    if (e.target.checked) {
      action.failOnNotFound = false;
      if (failCheckbox) failCheckbox.checked = false;
    }
    save();
  });

  document.getElementById('config-poll-interval').addEventListener('change', (e) => {
    action.pollInterval = Math.max(100, parseInt(e.target.value) || 500);
    save();
  });

  document.getElementById('config-fail-not-found').addEventListener('change', (e) => {
    action.failOnNotFound = e.target.checked;
    save();
  });

  document.getElementById('config-img-continue-error').addEventListener('change', (e) => {
    action.continueOnError = e.target.checked;
    save();
  });

  // Search region
  document.getElementById('config-search-region-enabled').addEventListener('change', (e) => {
    const fields = document.getElementById('search-region-fields');
    if (e.target.checked) {
      action.searchRegion = action.searchRegion || { x: 0, y: 0, width: 200, height: 200 };
      fields.style.display = '';
      document.getElementById('search-region-display').style.display = '';
    } else {
      action.searchRegion = null;
      fields.style.display = 'none';
    }
    save();
  });

  document.getElementById('btn-pick-search-region').addEventListener('click', async () => {
    await pickRegionFromScreen((region) => {
      action.searchRegion = { x: region.x, y: region.y, width: region.width, height: region.height };
      document.getElementById('config-sr-x').value = region.x;
      document.getElementById('config-sr-y').value = region.y;
      document.getElementById('config-sr-w').value = region.width;
      document.getElementById('config-sr-h').value = region.height;
      document.getElementById('search-region-display').style.display = '';
      save();
    });
  });

  ['config-sr-x', 'config-sr-y', 'config-sr-w', 'config-sr-h'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', (e) => {
      action.searchRegion = action.searchRegion || { x: 0, y: 0, width: 200, height: 200 };
      const key = { 'config-sr-x': 'x', 'config-sr-y': 'y', 'config-sr-w': 'width', 'config-sr-h': 'height' }[id];
      action.searchRegion[key] = Math.max(0, parseInt(e.target.value) || 0);
      save();
    });
  });

  // Scale down
  document.getElementById('config-scale-down').addEventListener('change', (e) => {
    action.scaleDown = e.target.checked;
    save();
  });

  // Show preview if image selected
  if (action.imageId) {
    updateImagePreview(action.imageId);
  }
}

/**
 * Render Pixel Detect action config
 */
function renderPixelDetectConfig(configBody, action, index, nameFieldHtml = '', save) {
  if (!save) save = () => updateAction(index, action);
  action.color = action.color || { r: 255, g: 0, b: 0 };

  configBody.innerHTML = nameFieldHtml + `
    <div class="config-field">
      <label>Target Color</label>
      <div class="color-picker-row">
        <input type="color" id="config-pixel-color" value="${rgbToHex(action.color)}">
        <span id="color-preview" style="display:inline-block;width:32px;height:32px;border-radius:4px;background:${rgbToHex(action.color)};border:1px solid var(--border)"></span>
        <button class="btn btn-secondary btn-sm" id="btn-pick-color">Pick from Screen</button>
      </div>
    </div>
    <div class="config-field">
      <label>RGB Values</label>
      <div class="rgb-inputs">
        <div>
          <span>R</span>
          <input type="number" id="config-pixel-r" min="0" max="255" value="${action.color.r}">
        </div>
        <div>
          <span>G</span>
          <input type="number" id="config-pixel-g" min="0" max="255" value="${action.color.g}">
        </div>
        <div>
          <span>B</span>
          <input type="number" id="config-pixel-b" min="0" max="255" value="${action.color.b}">
        </div>
      </div>
    </div>
    <div class="config-field">
      <label>Color Tolerance: <span id="tol-value">${action.tolerance || 10}</span></label>
      <input type="range" id="config-tolerance" min="0" max="50" value="${action.tolerance || 10}">
      <p class="config-field-hint">How much variation to allow (0 = exact match)</p>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-pixel-fail-not-found" ${action.failOnNotFound ? 'checked' : ''}>
        Fail if not found
      </label>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-pixel-continue-error" ${action.continueOnError ? 'checked' : ''}>
        Continue on error
      </label>
    </div>
  `;

  const nameInput = document.getElementById('config-action-name');
  if (nameInput) {
    nameInput.addEventListener('input', (e) => {
      action.name = e.target.value.trim() || undefined;
      save();
    });
  }

  const updateColorFromHex = (hex) => {
    action.color = hexToRgb(hex);
    document.getElementById('color-preview').style.background = hex;
    document.getElementById('config-pixel-r').value = action.color.r;
    document.getElementById('config-pixel-g').value = action.color.g;
    document.getElementById('config-pixel-b').value = action.color.b;
    save();
  };

  const updateColorFromRgb = () => {
    action.color = {
      r: parseInt(document.getElementById('config-pixel-r').value) || 0,
      g: parseInt(document.getElementById('config-pixel-g').value) || 0,
      b: parseInt(document.getElementById('config-pixel-b').value) || 0
    };
    const hex = rgbToHex(action.color);
    document.getElementById('config-pixel-color').value = hex;
    document.getElementById('color-preview').style.background = hex;
    save();
  };

  document.getElementById('config-pixel-color').addEventListener('change', (e) => {
    updateColorFromHex(e.target.value);
  });

  ['config-pixel-r', 'config-pixel-g', 'config-pixel-b'].forEach(id => {
    document.getElementById(id).addEventListener('change', updateColorFromRgb);
  });

  document.getElementById('btn-pick-color').addEventListener('click', async () => {
    await pickColorFromScreen((color) => {
      action.color = color;
      const hex = rgbToHex(color);
      document.getElementById('config-pixel-color').value = hex;
      document.getElementById('color-preview').style.background = hex;
      document.getElementById('config-pixel-r').value = color.r;
      document.getElementById('config-pixel-g').value = color.g;
      document.getElementById('config-pixel-b').value = color.b;
      save();
    });
  });

  document.getElementById('config-tolerance').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('tol-value').textContent = val;
    action.tolerance = val;
    save();
  });

  document.getElementById('config-pixel-fail-not-found').addEventListener('change', (e) => {
    action.failOnNotFound = e.target.checked;
    save();
  });

  document.getElementById('config-pixel-continue-error').addEventListener('change', (e) => {
    action.continueOnError = e.target.checked;
    save();
  });
}

/**
 * Helper: Convert RGB to hex
 */
function rgbToHex(color) {
  if (!color) return '#ff0000';
  const r = (color.r || 0).toString(16).padStart(2, '0');
  const g = (color.g || 0).toString(16).padStart(2, '0');
  const b = (color.b || 0).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

/**
 * Helper: Convert hex to RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 0, b: 0 };
}

