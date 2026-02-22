/**
 * Auto-Updater Service
 *
 * Checks GitHub Releases for updates, downloads them in the background,
 * and notifies the renderer to show a "Restart to apply update" prompt.
 */

import { autoUpdater } from 'electron-updater';
import { ipcMain } from 'electron';

let mainWindow = null;

/**
 * Initialize the auto-updater
 */
export function initAutoUpdater(win) {
  mainWindow = win;

  // Don't auto-install on download — let the user choose when to restart
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Logging
  autoUpdater.logger = {
    info: (...args) => console.log('[AutoUpdater]', ...args),
    warn: (...args) => console.warn('[AutoUpdater]', ...args),
    error: (...args) => console.error('[AutoUpdater]', ...args),
    debug: (...args) => console.log('[AutoUpdater:debug]', ...args)
  };

  // Events
  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for update...');
    sendToRenderer('update:checking');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version);
    sendToRenderer('update:available', {
      version: info.version,
      releaseNotes: info.releaseNotes
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] No update available');
    sendToRenderer('update:not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('update:download-progress', {
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded:', info.version);
    sendToRenderer('update:downloaded', {
      version: info.version,
      releaseNotes: info.releaseNotes
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err.message);
    sendToRenderer('update:error', { message: err.message });
  });

  // IPC: renderer can request restart
  ipcMain.handle('update:restart', () => {
    console.log('[AutoUpdater] User requested restart to apply update');
    autoUpdater.quitAndInstall(false, true);
  });

  // IPC: renderer can manually check for updates
  ipcMain.handle('update:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, version: result?.updateInfo?.version };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Check for updates after a short delay (let the app finish loading)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => {
      console.error('[AutoUpdater] Initial check failed:', err.message);
    });
  }, 5000);

  // Re-check every 30 minutes
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 30 * 60 * 1000);
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

export default { initAutoUpdater };
