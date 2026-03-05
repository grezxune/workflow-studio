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
