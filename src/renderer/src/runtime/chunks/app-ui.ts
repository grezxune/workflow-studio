function showToast(type, title, message, duration = 4000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    error: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
  };

  toast.innerHTML = `
    <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${icons[type] || icons.info}
    </svg>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
  `;

  elements.toastContainer.appendChild(toast);

  // Auto remove
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.2s ease reverse';
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

/**
 * Show modal dialog
 */
function showModal(title, content, buttons = []) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = content;

  const footer = document.getElementById('modal-footer');
  footer.innerHTML = '';

  buttons.forEach(btn => {
    const button = document.createElement('button');
    // Support both 'class' and 'primary' button formats
    if (btn.primary) {
      button.className = 'btn btn-primary';
    } else {
      button.className = `btn ${btn.class || 'btn-secondary'}`;
    }
    button.textContent = btn.label;
    button.onclick = () => {
      if (btn.onClick) btn.onClick();
      if (typeof btn.action === 'function') btn.action();
      if (btn.action === 'close' || btn.closeOnClick !== false) closeModal();
    };
    footer.appendChild(button);
  });

  elements.modalOverlay.classList.remove('hidden');

  // Close on backdrop click
  elements.modalOverlay.onclick = (e) => {
    if (e.target === elements.modalOverlay) closeModal();
  };

  // Close button
  document.getElementById('modal-close').onclick = closeModal;
}

/**
 * Hide modal dialog (alias for closeModal)
 */
function hideModal() {
  elements.modalOverlay.classList.add('hidden');
}

/**
 * Close modal dialog
 */
function closeModal() {
  elements.modalOverlay.classList.add('hidden');
}

/**
 * Show confirmation dialog
 */
function showConfirm(title, message, onConfirm) {
  showModal(title, `<p>${message}</p>`, [
    { label: 'Cancel', class: 'btn-secondary' },
    { label: 'Confirm', class: 'btn-danger', onClick: onConfirm }
  ]);
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  // Less than a minute
  if (diff < 60000) return 'Just now';

  // Less than an hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins} min${mins > 1 ? 's' : ''} ago`;
  }

  // Less than a day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }

  // Less than a week
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  // Full date
  return date.toLocaleDateString();
}

/**
 * Generate unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Setup auto-update event listeners and banner controls
 */
function setupUpdateListeners() {
  const banner = document.getElementById('update-banner');
  const title = document.getElementById('update-banner-title');
  const subtitle = document.getElementById('update-banner-subtitle');
  const restartBtn = document.getElementById('update-banner-restart');
  const dismissBtn = document.getElementById('update-banner-dismiss');

  if (!banner) return;

  window.workflowAPI.onUpdateAvailable((data) => {
    title.textContent = `Update v${data.version} available`;
    subtitle.textContent = 'Downloading in the background...';
    restartBtn.classList.add('hidden');
    banner.classList.remove('hidden');
  });

  window.workflowAPI.onUpdateDownloadProgress((data) => {
    subtitle.textContent = `Downloading update... ${data.percent}%`;
  });

  window.workflowAPI.onUpdateDownloaded((data) => {
    title.textContent = `v${data.version} ready to install`;
    subtitle.textContent = 'Restart the app to apply the update';
    restartBtn.classList.remove('hidden');
    banner.classList.remove('hidden');
  });

  window.workflowAPI.onUpdateError((data) => {
    console.warn('[Update] Error:', data.message);
    banner.classList.add('hidden');
  });

  restartBtn.addEventListener('click', () => {
    window.workflowAPI.restartToUpdate();
  });

  dismissBtn.addEventListener('click', () => {
    banner.classList.add('hidden');
  });
}

// App bootstrap is executed by runtime/bootstrap.ts after all chunks load.
