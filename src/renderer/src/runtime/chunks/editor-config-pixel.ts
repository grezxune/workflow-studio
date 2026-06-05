/* Editor config — pixel-detect action + color helpers (ported from WIP). Shares the editor global scope. */

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
    ${renderVariableAssignmentField(action, 'When color is found')}
  `;

  const nameInput = document.getElementById('config-action-name');
  if (nameInput) {
    nameInput.addEventListener('input', (e) => {
      action.name = e.target.value.trim() || undefined;
      save();
    });
  }
  bindVariableAssignmentField(action, save);

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

/**
 * Create a searchable image picker with folder hierarchy inside a container element.
 * Returns a controller: { onChange(cb), setValue(id), getValue(), destroy() }
 */
