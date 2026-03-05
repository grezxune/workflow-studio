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

