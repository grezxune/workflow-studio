/**
 * Workflow Studio - Images View
 *
 * Manages image template gallery with thumbnails, capture, delete, and virtual folders
 */

let _imagesActiveFolder = null; // null = "All Images"
let _allImages = [];
let _allFolders = [];

/**
 * Initialize images view
 */
function initImagesView() {
  document.getElementById('btn-capture-template')?.addEventListener('click', captureNewTemplate);
  document.getElementById('btn-capture-template-empty')?.addEventListener('click', captureNewTemplate);
  document.getElementById('btn-new-folder')?.addEventListener('click', createNewFolder);

  loadImagesAndFolders();
}

/**
 * Load all data and render both sidebar and gallery
 */
async function loadImagesAndFolders() {
  try {
    const [images, folders] = await Promise.all([
      window.workflowAPI.getImages(),
      window.workflowAPI.getImageFolders()
    ]);
    _allImages = images || [];
    _allFolders = folders || [];
  } catch (e) {
    console.error('Failed to load images/folders:', e);
    _allImages = [];
    _allFolders = [];
  }
  renderFolderSidebar();
  renderFilteredGallery();
}

// ==================== FOLDER SIDEBAR ====================

function renderFolderSidebar() {
  const list = document.getElementById('folder-list');
  if (!list) return;

  const folderIcon = `<svg class="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
  const allIcon = `<svg class="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;

  const allCount = _allImages.length;
  const uncatCount = _allImages.filter(i => !i.folder).length;

  let html = '';

  // All Images
  html += `<div class="folder-item ${_imagesActiveFolder === null ? 'active' : ''}" data-folder-key="__all__">
    ${allIcon}
    <span class="folder-name">All Images</span>
    <span class="folder-count">${allCount}</span>
  </div>`;

  // Uncategorized
  html += `<div class="folder-item ${_imagesActiveFolder === '__uncategorized__' ? 'active' : ''}" data-folder-key="__uncategorized__"
    data-folder-drop="__uncategorized__">
    ${allIcon}
    <span class="folder-name">Uncategorized</span>
    <span class="folder-count">${uncatCount}</span>
  </div>`;

  if (_allFolders.length > 0) {
    html += '<div class="folder-separator"></div>';
  }

  // Custom folders
  _allFolders.forEach(name => {
    const count = _allImages.filter(i => i.folder === name).length;
    html += `<div class="folder-item ${_imagesActiveFolder === name ? 'active' : ''}" data-folder-key="${escapeAttr(name)}"
      data-folder-drop="${escapeAttr(name)}">
      ${folderIcon}
      <span class="folder-name">${escapeHtml(name)}</span>
      <span class="folder-count">${count}</span>
      <div class="folder-actions">
        <button data-folder-rename="${escapeAttr(name)}" title="Rename">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
            <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
          </svg>
        </button>
        <button data-folder-delete="${escapeAttr(name)}" title="Delete folder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>`;
  });

  list.innerHTML = html;

  // Click to select folder
  list.querySelectorAll('.folder-item[data-folder-key]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.folder-actions')) return;
      const key = el.dataset.folderKey;
      if (key === '__all__') _imagesActiveFolder = null;
      else if (key === '__uncategorized__') _imagesActiveFolder = '__uncategorized__';
      else _imagesActiveFolder = key;
      renderFolderSidebar();
      renderFilteredGallery();
    });
  });

  // Rename folder
  list.querySelectorAll('[data-folder-rename]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      startFolderRename(btn.dataset.folderRename);
    });
  });

  // Delete folder
  list.querySelectorAll('[data-folder-delete]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteFolder(btn.dataset.folderDelete);
    });
  });

  // Drop targets for drag-to-move
  list.querySelectorAll('[data-folder-drop]').forEach(el => {
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.classList.add('drag-over');
    });
    el.addEventListener('dragleave', () => {
      el.classList.remove('drag-over');
    });
    el.addEventListener('drop', async (e) => {
      e.preventDefault();
      el.classList.remove('drag-over');
      const imageId = e.dataTransfer.getData('text/image-id');
      if (!imageId) return;
      const targetFolder = el.dataset.folderDrop === '__uncategorized__' ? null : el.dataset.folderDrop;
      try {
        await window.workflowAPI.moveImageToFolder(imageId, targetFolder);
        await loadImagesAndFolders();
        showToast('success', 'Moved', `"${imageId}" moved${targetFolder ? ' to ' + targetFolder : ' to Uncategorized'}`);
      } catch (err) {
        showToast('error', 'Error', err.message || 'Failed to move image');
      }
    });
  });
}

function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function createNewFolder() {
  showModal(
    'New Folder',
    `<div class="config-field">
      <label>Folder Name</label>
      <input type="text" id="new-folder-name" placeholder="e.g. Bank, Inventory, UI..." autofocus>
    </div>`,
    [
      { label: 'Cancel', class: 'btn-secondary' },
      {
        label: 'Create',
        class: 'btn-primary',
        onClick: async () => {
          const name = document.getElementById('new-folder-name').value.trim();
          if (!name) return;
          try {
            await window.workflowAPI.createImageFolder(name);
            _imagesActiveFolder = name;
            await loadImagesAndFolders();
            showToast('success', 'Created', `Folder "${name}" created`);
          } catch (err) {
            showToast('error', 'Error', err.message || 'Failed to create folder');
          }
        }
      }
    ]
  );
  setTimeout(() => document.getElementById('new-folder-name')?.focus(), 100);
}

function startFolderRename(currentName) {
  const folderEl = document.querySelector(`[data-folder-key="${CSS.escape(currentName)}"]`);
  if (!folderEl) return;
  const nameEl = folderEl.querySelector('.folder-name');
  if (!nameEl || nameEl.querySelector('input')) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'folder-rename-input';
  input.value = currentName;
  input.spellcheck = false;

  nameEl.textContent = '';
  nameEl.appendChild(input);
  input.select();
  input.focus();

  let committed = false;
  async function commit() {
    if (committed) return;
    committed = true;
    const newName = input.value.trim();
    if (!newName || newName === currentName) {
      nameEl.textContent = currentName;
      return;
    }
    try {
      await window.workflowAPI.renameImageFolder(currentName, newName);
      if (_imagesActiveFolder === currentName) _imagesActiveFolder = newName;
      await loadImagesAndFolders();
      showToast('success', 'Renamed', `"${currentName}" → "${newName}"`);
    } catch (err) {
      showToast('error', 'Error', err.message || 'Failed to rename folder');
      nameEl.textContent = currentName;
    }
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    else if (e.key === 'Escape') { e.preventDefault(); committed = true; nameEl.textContent = currentName; }
  });
  input.addEventListener('blur', commit);
}

async function deleteFolder(name) {
  showConfirm('Delete Folder', `Delete folder "${name}"? Images inside will be moved to Uncategorized.`, async () => {
    try {
      await window.workflowAPI.deleteImageFolder(name);
      if (_imagesActiveFolder === name) _imagesActiveFolder = null;
      await loadImagesAndFolders();
      showToast('success', 'Deleted', `Folder "${name}" deleted`);
    } catch (err) {
      showToast('error', 'Error', err.message || 'Failed to delete folder');
    }
  });
}

// ==================== GALLERY ====================

function renderFilteredGallery() {
  const gallery = document.getElementById('image-gallery');
  const emptyState = document.getElementById('images-empty');
  if (!gallery) return;

  let filtered;
  if (_imagesActiveFolder === null) {
    filtered = _allImages;
  } else if (_imagesActiveFolder === '__uncategorized__') {
    filtered = _allImages.filter(i => !i.folder);
  } else {
    filtered = _allImages.filter(i => i.folder === _imagesActiveFolder);
  }

  if (_allImages.length === 0) {
    gallery.innerHTML = '';
    gallery.style.display = 'none';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  gallery.style.display = '';
  if (emptyState) emptyState.classList.add('hidden');

  if (filtered.length === 0) {
    gallery.innerHTML = '<p style="color: var(--text-tertiary); padding: var(--space-4); grid-column: 1/-1; text-align:center;">No images in this folder</p>';
    return;
  }

  gallery.innerHTML = filtered.map(img => {
    const filePath = img.path.replace(/\\/g, '/');
    return `
      <div class="image-gallery-item" data-id="${img.id}" draggable="true">
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

  // Drag start — set image ID for folder drop targets
  gallery.querySelectorAll('.image-gallery-item[draggable]').forEach(el => {
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/image-id', el.dataset.id);
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
    });
  });

  // Rename handlers
  gallery.querySelectorAll('[data-rename]').forEach(nameEl => {
    nameEl.addEventListener('click', (e) => {
      e.stopPropagation();
      startInlineRename(nameEl, nameEl.dataset.rename);
    });
  });

  // Retake handlers
  gallery.querySelectorAll('[data-retake]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await retakeImage(btn.dataset.retake);
    });
  });

  // Delete handlers
  gallery.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const imageId = btn.dataset.delete;
      showConfirm('Delete Image', `Delete "${imageId}"? This cannot be undone.`, async () => {
        try {
          await window.workflowAPI.deleteImage(imageId);
          await loadImagesAndFolders();
          showToast('success', 'Deleted', 'Image template deleted');
        } catch (error) {
          showToast('error', 'Error', 'Failed to delete image');
        }
      });
    });
  });
}

// Keep this alias for any external callers
async function loadImageGallery() {
  await loadImagesAndFolders();
}

/**
 * Start inline rename on an image name element
 */
function startInlineRename(nameEl, currentId) {
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
      nameEl.textContent = currentId;
      return;
    }

    try {
      await window.workflowAPI.renameImage(currentId, newId);
      showToast('success', 'Renamed', `"${currentId}" → "${newId}"`);
      await loadImagesAndFolders();
    } catch (error) {
      showToast('error', 'Rename Failed', error.message || 'Could not rename image');
      nameEl.textContent = currentId;
    }
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    else if (e.key === 'Escape') { e.preventDefault(); committed = true; nameEl.textContent = currentId; }
  });
  input.addEventListener('blur', commit);
}

/**
 * Refresh all file:// image previews by busting the browser cache
 */
function refreshAllImagePreviews() {
  const bustParam = `t=${Date.now()}`;
  document.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') || '';
    if (src.startsWith('file://')) {
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
    try { await window.workflowAPI.clearTemplateCache(imageId); } catch (e) { /* ignore */ }
    await loadImagesAndFolders();
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
    await window.workflowAPI.minimizeWindow();
    await new Promise(r => setTimeout(r, 300));

    const result = await window.workflowAPI.captureRegionTemplate();

    await window.workflowAPI.restoreWindow();

    if (result.cancelled) {
      showToast('info', 'Cancelled', 'Region capture cancelled');
      return;
    }

    if (!result.success) {
      showToast('error', 'Error', result.error || 'Failed to capture region');
      return;
    }

    // Auto-assign to active folder if viewing a specific folder
    if (_imagesActiveFolder && _imagesActiveFolder !== '__uncategorized__') {
      try {
        await window.workflowAPI.moveImageToFolder(result.imageId, _imagesActiveFolder);
      } catch (e) { /* ignore */ }
    }

    showToast('success', 'Captured', `Image template saved as ${result.imageId}`);
    await loadImagesAndFolders();
  } catch (error) {
    console.error('Capture failed:', error);
    showToast('error', 'Error', 'Failed to capture image');
    try { await window.workflowAPI.restoreWindow(); } catch (e) { /* ignore */ }
  }
}
