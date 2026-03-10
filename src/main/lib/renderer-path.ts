import path from 'node:path';
import { app } from 'electron';
import type { BrowserWindow } from 'electron';

function getAppRootPath(): string {
  return app.getAppPath();
}

function getBuiltOutputPath(...segments: string[]): string {
  return path.join(getAppRootPath(), 'out', ...segments);
}

export function getPreloadPath(): string {
  return getBuiltOutputPath('preload', 'index.cjs');
}

export function getOverlayPreloadPath(): string {
  return getBuiltOutputPath('preload', 'overlay.cjs');
}

export function getRendererHtmlPath(fileName: string): string {
  return getBuiltOutputPath('renderer', fileName);
}

export function getRendererDevUrl(fileName: string): string | null {
  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (!rendererUrl) {
    return null;
  }

  return `${rendererUrl}/${fileName}`;
}

export async function loadRendererPage(window: BrowserWindow, fileName: string): Promise<void> {
  const devUrl = getRendererDevUrl(fileName);

  if (devUrl) {
    await window.loadURL(devUrl);
    return;
  }

  await window.loadFile(getRendererHtmlPath(fileName));
}
