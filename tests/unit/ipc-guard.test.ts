import { describe, expect, test } from 'bun:test';
import {
  assertAuthorizedSender,
  isAuthorizedSender,
  verifyAuthorizedSender
} from '../../src/main/lib/ipc-guard';

function createWindowMock(overrides: Partial<{ destroyed: boolean; webContentsDestroyed: boolean }> = {}) {
  const webContents = {
    isDestroyed: () => overrides.webContentsDestroyed ?? false
  };

  return {
    webContents,
    isDestroyed: () => overrides.destroyed ?? false
  };
}

describe('ipc-guard', () => {
  test('accepts authorized sender', () => {
    const windowMock = createWindowMock();
    const event = { sender: windowMock.webContents };
    expect(isAuthorizedSender(event, windowMock as any)).toBe(true);
    expect(verifyAuthorizedSender(event, windowMock as any, 'test:channel')).toBe(true);
  });

  test('rejects unauthorized sender', () => {
    const windowMock = createWindowMock();
    const event = { sender: { isDestroyed: () => false } };
    expect(isAuthorizedSender(event, windowMock as any)).toBe(false);
    expect(verifyAuthorizedSender(event, windowMock as any, 'test:channel')).toBe(false);
    expect(() => assertAuthorizedSender(event, windowMock as any, 'test:channel')).toThrow(
      'Unauthorized IPC sender'
    );
  });

  test('rejects unavailable window', () => {
    const windowMock = createWindowMock({ destroyed: true });
    const event = { sender: windowMock.webContents };
    expect(isAuthorizedSender(event, windowMock as any)).toBe(false);
    expect(verifyAuthorizedSender(event, windowMock as any, 'test:channel')).toBe(false);
    expect(() => assertAuthorizedSender(event, windowMock as any, 'test:channel')).toThrow(
      'is unavailable'
    );
  });
});
