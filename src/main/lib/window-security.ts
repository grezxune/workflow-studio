import {
  session,
  shell,
  type BrowserWindow,
  type HandlerDetails
} from 'electron';
import {
  getRendererDevOrigin,
  isSafeExternalUrl,
  isTrustedRendererNavigationUrl
} from './window-security-rules';

export async function openExternalSafely(url: string): Promise<boolean> {
  if (!isSafeExternalUrl(url)) {
    console.warn(`[WindowSecurity] Blocked unsafe external URL: ${url}`);
    return false;
  }

  await shell.openExternal(url);
  return true;
}

function handleWindowOpen(details: HandlerDetails) {
  const { url } = details;
  if (isSafeExternalUrl(url)) {
    void openExternalSafely(url);
  } else {
    console.warn(`[WindowSecurity] Blocked window.open for URL: ${url}`);
  }

  return { action: 'deny' as const };
}

export function hardenBrowserWindow(window: BrowserWindow, name: string): void {
  const { webContents } = window;
  const rendererDevOrigin = getRendererDevOrigin();

  webContents.setWindowOpenHandler(handleWindowOpen);

  webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererNavigationUrl(url, rendererDevOrigin)) {
      event.preventDefault();
      console.warn(`[WindowSecurity] Blocked navigation in ${name}: ${url}`);
    }
  });

  webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
    console.warn(`[WindowSecurity] Blocked webview attach in ${name}`);
  });
}

let sessionSecurityConfigured = false;

export function configureSessionSecurity(): void {
  if (sessionSecurityConfigured) {
    return;
  }
  sessionSecurityConfigured = true;

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    console.warn(`[WindowSecurity] Denied permission request: ${permission}`);
    callback(false);
  });
}
