import type { BrowserWindow, IpcMainEvent, IpcMainInvokeEvent } from 'electron';

type SenderEvent = Pick<IpcMainEvent, 'sender'> | Pick<IpcMainInvokeEvent, 'sender'>;

function hasLiveWebContents(window: BrowserWindow | null | undefined): window is BrowserWindow {
  return Boolean(window && !window.isDestroyed() && !window.webContents.isDestroyed());
}

export function isAuthorizedSender(
  event: SenderEvent,
  expectedWindow: BrowserWindow | null | undefined
): boolean {
  if (!hasLiveWebContents(expectedWindow)) {
    return false;
  }

  return event.sender === expectedWindow.webContents;
}

export function assertAuthorizedSender(
  event: SenderEvent,
  expectedWindow: BrowserWindow | null | undefined,
  channel: string
): void {
  if (!hasLiveWebContents(expectedWindow)) {
    throw new Error(`IPC channel "${channel}" is unavailable`);
  }

  if (event.sender !== expectedWindow.webContents) {
    throw new Error(`Unauthorized IPC sender for "${channel}"`);
  }
}

export function verifyAuthorizedSender(
  event: SenderEvent,
  expectedWindow: BrowserWindow | null | undefined,
  channel: string
): boolean {
  if (!hasLiveWebContents(expectedWindow)) {
    console.warn(`[IPC Guard] Ignored "${channel}" because target window is unavailable`);
    return false;
  }

  if (event.sender !== expectedWindow.webContents) {
    console.warn(`[IPC Guard] Blocked unauthorized sender for "${channel}"`);
    return false;
  }

  return true;
}
