/* Editor config — image-detect action (ported from WIP). Shares the editor global scope. */

async function renderImageDetectConfig(configBody, action, index, nameFieldHtml = '', save) {
  if (!save) save = () => updateAction(index, action);
  action.detectMode = action.detectMode || 'present';
  action.soundId = action.soundId || 'none';
  action.soundVolume = action.soundVolume || 100;
  action.soundRepeatCount = action.soundRepeatCount || 1;
  action.speechText = action.speechText || '';
  const selectedSoundMeta = getSoundMeta(action.soundId);
  const isSpeechSound = action.soundId === 'tts';
  const isCustomSound = selectedSoundMeta?.type === 'custom';
  const isAbsent = action.detectMode === 'absent';
  const detectLabel = isAbsent ? 'missing' : 'found';
  const modeHints = {
    present: 'Succeeds when the image appears on screen',
    absent: 'Succeeds when the image is NOT on screen (detect when something disappears)'
  };
  configBody.innerHTML = nameFieldHtml + `
    <div class="config-field">
      <label>Detection Mode</label>
      <div class="segmented-control">
        <button class="segment ${!isAbsent ? 'active' : ''}" data-detect-mode="present">Find Image</button>
        <button class="segment ${isAbsent ? 'active' : ''}" data-detect-mode="absent">Find Missing Image</button>
      </div>
      <p class="config-field-hint">${modeHints[action.detectMode]}</p>
    </div>
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
      <label>Sound When ${isAbsent ? 'Image Missing' : 'Image Found'}</label>
      <div class="input-group">
        <select id="config-image-found-sound">
          ${renderSoundOptions(action.soundId)}
        </select>
        <button class="btn btn-secondary" id="btn-test-image-sound" ${action.soundId === 'none' ? 'disabled' : ''}>
          Test
        </button>
        <button class="btn btn-secondary" id="btn-import-custom-sound">Import</button>
        <button class="btn btn-danger" id="btn-delete-custom-sound" ${isCustomSound ? '' : 'disabled'}>Delete</button>
      </div>
      <p class="config-field-hint">Choose a built-in alert, import your own audio file, or speak custom text aloud.</p>
    </div>
    <div class="config-field" id="speech-text-field" ${isSpeechSound ? '' : 'style="display:none"'}>
      <label>Speech Text</label>
      <textarea id="config-speech-text" rows="3" placeholder="Boss spawned. Check the screen now.">${escapeHtml(action.speechText)}</textarea>
      <p class="config-field-hint">This text will be spoken aloud when the image is ${detectLabel}.</p>
    </div>
    <div class="config-field">
      <label>Sound Volume: <span id="sound-volume-value">${action.soundVolume}%</span></label>
      <input type="range" id="config-image-sound-volume" min="25" max="500" value="${action.soundVolume}">
      <p class="config-field-hint">100% is normal volume. Higher values push the alert much harder.</p>
    </div>
    <div class="config-field">
      <label>Repeat Sound</label>
      <input type="number" id="config-image-sound-repeat-count" min="1" max="10" value="${action.soundRepeatCount}">
      <p class="config-field-hint">How many times the sound should play when this image is ${detectLabel}.</p>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-wait-until-found" ${action.waitUntilFound ? 'checked' : ''}>
        Wait until ${isAbsent ? 'missing' : 'found'}
      </label>
      <p class="config-field-hint">${isAbsent ? 'Keep checking until the image disappears from screen' : 'Keep checking until the image appears on screen'}</p>
    </div>
    <div class="config-field" id="poll-interval-field" ${!action.waitUntilFound ? 'style="display:none"' : ''}>
      <label>Check interval</label>
      ${durationFieldHTML({ id: 'config-poll-interval', valueMs: action.pollInterval || 500, placeholder: '500' })}
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
        Fail if ${isAbsent ? 'still present' : 'not found'}
      </label>
      <p class="config-field-hint">${isAbsent ? 'Stop the workflow if the image is still on screen' : 'Stop the workflow if the image cannot be found'}</p>
    </div>
    <div class="config-field">
      <label class="checkbox-label">
        <input type="checkbox" id="config-img-continue-error" ${action.continueOnError ? 'checked' : ''}>
        Continue on error
      </label>
    </div>
    ${renderVariableAssignmentField(action, isAbsent ? 'When image is missing' : 'When image is found')}
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
  bindVariableAssignmentField(action, save);

  // Detection mode toggle (present vs absent)
  configBody.querySelectorAll('[data-detect-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      action.detectMode = btn.dataset.detectMode;
      save();
      renderImageDetectConfig(configBody, action, index, nameFieldHtml, save);
    });
  });

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

  document.getElementById('config-image-found-sound').addEventListener('change', (e) => {
    action.soundId = e.target.value;
    const soundMeta = getSoundMeta(action.soundId);
    const speechField = document.getElementById('speech-text-field');
    document.getElementById('btn-test-image-sound').disabled = e.target.value === 'none';
    document.getElementById('btn-delete-custom-sound').disabled = soundMeta?.type !== 'custom';
    if (speechField) speechField.style.display = action.soundId === 'tts' ? '' : 'none';
    save();
  });

  document.getElementById('config-speech-text')?.addEventListener('input', (e) => {
    action.speechText = e.target.value;
    save();
  });

  document.getElementById('config-image-sound-volume').addEventListener('input', (e) => {
    const value = Math.max(25, Math.min(500, parseInt(e.target.value) || 100));
    action.soundVolume = value;
    document.getElementById('sound-volume-value').textContent = `${value}%`;
    save();
  });

  document.getElementById('config-image-sound-repeat-count').addEventListener('change', (e) => {
    const value = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
    action.soundRepeatCount = value;
    e.target.value = value;
    save();
  });

  document.getElementById('btn-test-image-sound').addEventListener('click', async () => {
    if (!action.soundId || action.soundId === 'none') return;
    if (typeof window.playWorkflowSound === 'function') {
      window.playWorkflowSound({
        soundId: action.soundId,
        volume: action.soundVolume || 100,
        repeatCount: action.soundRepeatCount || 1,
        speechText: action.speechText || ''
      });
    }
  });

  document.getElementById('btn-import-custom-sound').addEventListener('click', async () => {
    try {
      const imported = await window.workflowAPI.importCustomSound?.();
      if (!imported?.id) return;
      await loadSystemSounds();
      action.soundId = imported.id;
      save();
      renderConfigFields(action, index, configBody, save);
      showToast('success', 'Custom Sound Imported', `"${imported.label}" is ready to use.`);
    } catch (error) {
      console.error('Failed to import custom sound:', error);
      showToast('error', 'Error', error.message || 'Failed to import custom sound');
    }
  });

  document.getElementById('btn-delete-custom-sound').addEventListener('click', async () => {
    if (getSoundMeta(action.soundId)?.type !== 'custom') return;
    try {
      await window.workflowAPI.deleteCustomSound?.(action.soundId);
      action.soundId = 'none';
      save();
      await loadSystemSounds();
      renderConfigFields(action, index, configBody, save);
      showToast('success', 'Deleted', 'Custom sound removed');
    } catch (error) {
      console.error('Failed to delete custom sound:', error);
      showToast('error', 'Error', error.message || 'Failed to delete custom sound');
    }
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

  document.getElementById('config-poll-interval').addEventListener('change', () => {
    action.pollInterval = Math.max(100, readDurationMs('config-poll-interval') ?? 500);
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
