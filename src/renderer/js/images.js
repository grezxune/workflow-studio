/**
 * Workflow Studio - Images View
 *
 * Manages image template gallery with thumbnails, capture, and delete
 */

/**
 * Initialize images view
 */
function initImagesView() {
  // Capture template buttons
  document.getElementById('btn-capture-template')?.addEventListener('click', captureNewTemplate);
  document.getElementById('btn-capture-template-empty')?.addEventListener('click', captureNewTemplate);

  // Load gallery
  loadImageGallery();
}

/**
 * Load and render image gallery with actual thumbnails
 */
async function loadImageGallery() {
  const gallery = document.getElementById('image-gallery');
  const emptyState = document.getElementById('images-empty');
  if (!gallery) return;

  try {
    const images = await window.workflowAPI.getImages();

    if (!images || images.length === 0) {
      gallery.innerHTML = '';
      gallery.style.display = 'none';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    gallery.style.display = '';
    if (emptyState) emptyState.classList.add('hidden');

    gallery.innerHTML = images.map(img => {
      const filePath = img.path.replace(/\\/g, '/');
      return `
        <div class="image-gallery-item" data-id="${img.id}">
          <img src="file://${filePath}?t=${Date.now()}" alt="${img.id}" loading="lazy">
          <span class="image-name" data-rename="${img.id}" title="Click to rename">${img.id}</span>
          <button class="retake-image" data-retake="${img.id}" title="Retake">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
              <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
          <button class="delete-image" data-delete="${img.id}" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      `;
    }).join('');

    // Add rename handlers (click on name to edit inline)
    gallery.querySelectorAll('[data-rename]').forEach(nameEl => {
      nameEl.addEventListener('click', (e) => {
        e.stopPropagation();
        startInlineRename(nameEl, nameEl.dataset.rename);
      });
    });

    // Add retake handlers
    gallery.querySelectorAll('[data-retake]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const imageId = btn.dataset.retake;
        await retakeImage(imageId);
      });
    });

    // Add delete handlers
    gallery.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const imageId = btn.dataset.delete;
        showConfirm('Delete Image', `Delete "${imageId}"? This cannot be undone.`, async () => {
          try {
            await window.workflowAPI.deleteImage(imageId);
            loadImageGallery();
            showToast('success', 'Deleted', 'Image template deleted');
          } catch (error) {
            showToast('error', 'Error', 'Failed to delete image');
          }
        });
      });
    });
  } catch (error) {
    console.error('Failed to load images:', error);
    gallery.innerHTML = '<p style="color: var(--text-tertiary); padding: var(--space-4);">Failed to load images</p>';
  }
}

/**
 * Start inline rename on an image name element
 */
function startInlineRename(nameEl, currentId) {
  // Prevent double-activation
  if (nameEl.querySelector('input')) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'image-rename-input';
  input.value = currentId;
  input.spellcheck = false;

  nameEl.textContent = '';
  nameEl.appendChild(input);
  input.select();
  input.focus();

  let committed = false;

  async function commit() {
    if (committed) return;
    committed = true;

    const newId = input.value.trim();
    if (!newId || newId === currentId) {
      // No change — restore original name
      nameEl.textContent = currentId;
      return;
    }

    try {
      await window.workflowAPI.renameImage(currentId, newId);
      showToast('success', 'Renamed', `"${currentId}" → "${newId}"`);
      loadImageGallery();
    } catch (error) {
      showToast('error', 'Rename Failed', error.message || 'Could not rename image');
      nameEl.textContent = currentId;
    }
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      committed = true;
      nameEl.textContent = currentId;
    }
  });

  input.addEventListener('blur', commit);
}

/**
 * Refresh all file:// image previews by busting the browser cache.
 * Covers the gallery, config panel previews, and any other img elements.
 */
function refreshAllImagePreviews() {
  const bustParam = `t=${Date.now()}`;
  document.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') || '';
    if (src.startsWith('file://')) {
      // Strip any existing cache-bust param and add a new one
      const cleanSrc = src.replace(/[?&]t=\d+/, '');
      img.src = cleanSrc + (cleanSrc.includes('?') ? '&' : '?') + bustParam;
    }
  });
}

/**
 * Retake an existing image template (overwrites the file, keeps the same ID)
 */
async function retakeImage(imageId) {
  try {
    await window.workflowAPI.minimizeWindow();
    await new Promise(r => setTimeout(r, 300));

    const result = await window.workflowAPI.captureRegionTemplate({ name: imageId });

    await window.workflowAPI.restoreWindow();

    if (result.cancelled) {
      showToast('info', 'Cancelled', 'Retake cancelled');
      return;
    }

    if (!result.success) {
      showToast('error', 'Error', result.error || 'Failed to capture region');
      return;
    }

    showToast('success', 'Retaken', `"${imageId}" has been updated`);
    // Clear the detection service template cache for this image
    try { await window.workflowAPI.clearTemplateCache(imageId); } catch (e) { /* ignore */ }
    // Reload gallery first (re-renders with fresh cache-bust timestamps)
    await loadImageGallery();
    // Then refresh any other image previews on the page (config panels, etc.)
    refreshAllImagePreviews();
  } catch (error) {
    console.error('Retake failed:', error);
    showToast('error', 'Error', 'Failed to retake image');
    try { await window.workflowAPI.restoreWindow(); } catch (e) { /* ignore */ }
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

    showToast('success', 'Captured', `Image template saved as ${result.imageId}`);
    loadImageGallery();
  } catch (error) {
    console.error('Capture failed:', error);
    showToast('error', 'Error', 'Failed to capture image');
    try { await window.workflowAPI.restoreWindow(); } catch (e) { /* ignore */ }
  }
}
