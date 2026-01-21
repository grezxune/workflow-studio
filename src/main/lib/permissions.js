/**
 * Permission Utilities
 *
 * Checks and requests system permissions needed for automation
 */

import { systemPreferences } from 'electron';

/**
 * Check if the app has accessibility permissions (macOS)
 * Required for mouse/keyboard control via nut-js
 */
export function hasAccessibilityPermission() {
  if (process.platform !== 'darwin') {
    return true;
  }

  return systemPreferences.isTrustedAccessibilityClient(false);
}

/**
 * Request accessibility permissions (macOS)
 * Opens the system preferences pane
 */
export function requestAccessibilityPermission() {
  if (process.platform !== 'darwin') {
    return true;
  }

  // This will prompt the user to grant accessibility access
  return systemPreferences.isTrustedAccessibilityClient(true);
}

/**
 * Check if screen recording is permitted (macOS)
 * Required for screen capture functionality
 */
export function hasScreenCapturePermission() {
  if (process.platform !== 'darwin') {
    return true;
  }

  const status = systemPreferences.getMediaAccessStatus('screen');
  return status === 'granted';
}

/**
 * Get all permission statuses
 */
export function getPermissionStatus() {
  if (process.platform !== 'darwin') {
    return {
      accessibility: true,
      screenCapture: true
    };
  }

  return {
    accessibility: hasAccessibilityPermission(),
    screenCapture: hasScreenCapturePermission()
  };
}
