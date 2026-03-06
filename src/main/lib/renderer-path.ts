import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrowserWindow } from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getPreloadPath(): string {
  return path.join(__dirname, '../../preload/index.mjs');
}

export function getOverlayPreloadPath(): string {
  return path.join(__dirname, '../../preload/overlay.mjs');
}

export function getRendererHtmlPath(fileName: string): string {
  return path.join(__dirname, '../../renderer', fileName);
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
