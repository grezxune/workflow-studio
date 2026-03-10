import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'bun:test';
import {
  createStoreWithRecovery,
  getStoreFilePath,
  isRecoverableStoreError,
  quarantineUnreadableStore
} from '../../src/main/lib/store-recovery';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-studio-store-'));
  tempDirs.push(dir);
  return dir;
}

describe('store-recovery', () => {
  test('detects unreadable store errors', () => {
    expect(isRecoverableStoreError(new SyntaxError('Unexpected token & in JSON at position 1'))).toBe(true);
    expect(isRecoverableStoreError(new Error('Failed to decrypt config'))).toBe(true);
    expect(isRecoverableStoreError(new Error('Permission denied'))).toBe(false);
  });

  test('archives unreadable store files with a timestamped suffix', () => {
    const dir = createTempDir();
    const storePath = getStoreFilePath('config', dir);

    fs.writeFileSync(storePath, 'broken');

    const archivedPath = quarantineUnreadableStore(storePath, new Date('2026-03-06T12:00:00.000Z'));

    expect(archivedPath).toBe(path.join(dir, 'config.corrupt-2026-03-06T12-00-00-000Z.json'));
    expect(fs.existsSync(storePath)).toBe(false);
    expect(fs.readFileSync(archivedPath!, 'utf8')).toBe('broken');
  });

  test('retries store creation after archiving a recoverable store file', () => {
    const dir = createTempDir();
    const storePath = getStoreFilePath('config', dir);
    const logger = { warn: () => {} };
    const createdStore = { get: () => undefined };
    let calls = 0;

    fs.writeFileSync(storePath, 'broken');

    const store = createStoreWithRecovery(
      { name: 'config', cwd: dir, defaults: {} },
      {
        createStore: () => {
          calls += 1;
          if (calls === 1) {
            throw new SyntaxError('Unexpected token & in JSON at position 1');
          }
          return createdStore as any;
        },
        logger,
        storeDir: dir
      }
    );

    const archivedFile = fs.readdirSync(dir).find((entry) => entry.startsWith('config.corrupt-'));

    expect(store).toBe(createdStore);
    expect(calls).toBe(2);
    expect(archivedFile).toBeTruthy();
    expect(fs.existsSync(storePath)).toBe(false);
  });
});
