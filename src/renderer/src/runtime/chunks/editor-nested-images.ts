/**
 * Create a searchable image picker with folder hierarchy inside a container element.
 * Returns a controller: { onChange(cb), setValue(id), getValue(), destroy() }
 */
async function loadImageOptions(containerId, selectedId, onChangeCb) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  let images = [];
  try {
    images = await window.workflowAPI.getImages() || [];
  } catch (e) {
    console.error('Failed to load images:', e);
  }

  let currentValue = selectedId || null;
  let isOpen = false;
  let _onChange = onChangeCb || null;

  const chevronSvg = `<svg class="picker-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
  const folderSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;

  function getDisplayLabel(id) {
    if (!id) return null;
    const img = images.find(i => i.id === id);
    if (!img) return id;
    return img.folder ? `${img.folder} / ${img.id}` : img.id;
  }

  // Build the picker DOM
  container.innerHTML = '';
  container.classList.add('image-picker');

  const trigger = document.createElement('div');
  trigger.className = 'image-picker-trigger';
  trigger.innerHTML = currentValue
    ? `<span class="picker-value">${escapeHtml(getDisplayLabel(currentValue))}</span>${chevronSvg}`
    : `<span class="picker-value picker-placeholder">Select image...</span>${chevronSvg}`;
  container.appendChild(trigger);

  const dropdown = document.createElement('div');
  dropdown.className = 'image-picker-dropdown';
  dropdown.style.display = 'none';
  container.appendChild(dropdown);

  function renderDropdown(filter = '') {
    const q = filter.toLowerCase();

    // Group images
    const uncategorized = images.filter(i => !i.folder);
    const folderMap = {};
    images.forEach(img => {
      if (img.folder) {
        if (!folderMap[img.folder]) folderMap[img.folder] = [];
        folderMap[img.folder].push(img);
      }
    });

    let html = `<div class="image-picker-search"><input type="text" placeholder="Search images..." value="${escapeHtml(filter)}"></div><div class="image-picker-results">`;

    let hasResults = false;

    // Uncategorized images
    const filteredUncat = uncategorized.filter(img =>
      !q || img.id.toLowerCase().includes(q)
    );
    if (filteredUncat.length > 0) {
      filteredUncat.forEach(img => {
        hasResults = true;
        const sel = img.id === currentValue ? ' selected' : '';
        const thumb = img.path ? `<img class="picker-item-thumb" src="file://${img.path.replace(/\\/g, '/')}?t=${Date.now()}" alt="">` : '';
        html += `<div class="image-picker-item${sel}" data-value="${escapeHtml(img.id)}">${thumb}<span class="picker-item-name">${escapeHtml(img.id)}</span></div>`;
      });
    }

    // Folders
    Object.keys(folderMap).sort().forEach(folder => {
      const folderMatches = folder.toLowerCase().includes(q);
      const filteredImgs = folderMap[folder].filter(img =>
        !q || folderMatches || img.id.toLowerCase().includes(q)
      );
      if (filteredImgs.length > 0) {
        hasResults = true;
        html += `<div class="image-picker-folder">${folderSvg} ${escapeHtml(folder)}</div>`;
        filteredImgs.forEach(img => {
          const sel = img.id === currentValue ? ' selected' : '';
          const thumb = img.path ? `<img class="picker-item-thumb" src="file://${img.path.replace(/\\/g, '/')}?t=${Date.now()}" alt="">` : '';
          html += `<div class="image-picker-item in-folder${sel}" data-value="${escapeHtml(img.id)}">${thumb}<span class="picker-item-name">${escapeHtml(img.id)}</span></div>`;
        });
      }
    });

    if (!hasResults) {
      html += `<div class="image-picker-empty">${q ? 'No images match "' + escapeHtml(filter) + '"' : 'No image templates'}</div>`;
    }

    html += '</div>';
    dropdown.innerHTML = html;

    // Wire search input
    const searchInput = dropdown.querySelector('.image-picker-search input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        renderDropdown(e.target.value);
      });
      // Prevent trigger close when clicking in search
      searchInput.addEventListener('mousedown', (e) => e.stopPropagation());
      // Keep focus
      setTimeout(() => searchInput.focus(), 0);
      // Place cursor at end
      searchInput.selectionStart = searchInput.selectionEnd = searchInput.value.length;
    }

    // Wire item clicks
    dropdown.querySelectorAll('.image-picker-item').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const val = el.dataset.value;
        selectValue(val);
        closeDropdown();
      });
    });
  }

  function selectValue(val) {
    currentValue = val || null;
    trigger.innerHTML = currentValue
      ? `<span class="picker-value">${escapeHtml(getDisplayLabel(currentValue))}</span>${chevronSvg}`
      : `<span class="picker-value picker-placeholder">Select image...</span>${chevronSvg}`;
    if (_onChange) _onChange(currentValue);
  }

  function openDropdown() {
    if (isOpen) return;
    isOpen = true;
    trigger.classList.add('open');
    dropdown.style.display = '';
    renderDropdown('');
  }

  function closeDropdown() {
    if (!isOpen) return;
    isOpen = false;
    trigger.classList.remove('open');
    dropdown.style.display = 'none';
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isOpen) closeDropdown();
    else openDropdown();
  });

  // Close on outside click
  function handleOutsideClick(e) {
    if (!container.contains(e.target)) closeDropdown();
  }
  document.addEventListener('mousedown', handleOutsideClick);

  const controller = {
    onChange(cb) { _onChange = cb; },
    setValue(id) { selectValue(id); },
    getValue() { return currentValue; },
    async refresh() {
      try { images = await window.workflowAPI.getImages() || []; } catch (e) {}
      if (isOpen) renderDropdown('');
      // Update trigger label
      trigger.innerHTML = currentValue
        ? `<span class="picker-value">${escapeHtml(getDisplayLabel(currentValue))}</span>${chevronSvg}`
        : `<span class="picker-value picker-placeholder">Select image...</span>${chevronSvg}`;
    },
    destroy() {
      document.removeEventListener('mousedown', handleOutsideClick);
    }
  };

  return controller;
}

/**
 * Update image preview
 */
function updateImagePreview(imageId) {
  const container = document.getElementById('image-preview-container');
  const preview = document.getElementById('image-preview');
  if (!container || !preview) return;

  if (imageId) {
    // Note: In production, you'd get the actual file path
    container.style.display = '';
    preview.alt = imageId;
  } else {
    container.style.display = 'none';
  }
}

/**
 * Capture image template from screen with region selection
 */
async function captureImageTemplate(callback) {
  try {
    // Minimize the main window first
    await window.workflowAPI.minimizeWindow();

    // Small delay to ensure window is minimized
    await new Promise(r => setTimeout(r, 300));

    // Open region selection overlay (includes preview/confirm/redo loop)
    const result = await window.workflowAPI.captureRegionTemplate();

    // Restore the main window
    await window.workflowAPI.restoreWindow();

    if (result.cancelled) {
      showToast('info', 'Cancelled', 'Region capture cancelled');
      return;
    }

    if (!result.success) {
      showToast('error', 'Error', result.error || 'Failed to capture region');
      return;
    }

    showToast('success', 'Image Captured', `Saved as ${result.imageId}`);
    if (callback) callback(result.imageId);
  } catch (error) {
    console.error('Image capture failed:', error);
    showToast('error', 'Capture Failed', error.message);
    // Restore window even on error
    try { await window.workflowAPI.restoreWindow(); } catch (e) { /* ignore */ }
  }
}

