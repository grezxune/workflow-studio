import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'bun:test';
import {
  archiveUnreadableKeyFile,
  createRandomStoreKey,
  getStoreKeyFilePath,
  resolveStoreEncryptionKey
} from '../../src/main/lib/store-encryption-key-core';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-studio-key-'));
  tempDirs.push(dir);
  return dir;
}

function createStorageMock() {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`enc:${value}`, 'utf8'),
    decryptString: (value: Buffer) => {
      const decoded = value.toString('utf8');
      if (!decoded.startsWith('enc:')) {
        throw new Error('Unable to decrypt key');
      }
      return decoded.slice(4);
    }
  };
}

describe('store-encryption-key', () => {
  test('creates random keys', () => {
    const key = createRandomStoreKey();
    expect(key).toHaveLength(64);
  });

  test('returns environment override when provided', () => {
    const dir = createTempDir();
    const key = resolveStoreEncryptionKey({
      environmentKey: 'override-key',
      userDataPath: dir,
      storage: createStorageMock()
    });

    expect(key).toBe('override-key');
    expect(fs.existsSync(getStoreKeyFilePath(dir))).toBe(false);
  });

  test('creates and reuses an encrypted persisted key', () => {
    const dir = createTempDir();
    const storage = createStorageMock();

    const firstKey = resolveStoreEncryptionKey({ userDataPath: dir, storage });
    const secondKey = resolveStoreEncryptionKey({ userDataPath: dir, storage });

    expect(firstKey).toBe(secondKey);
    expect(fs.existsSync(getStoreKeyFilePath(dir))).toBe(true);
  });

  test('returns null when secure storage is unavailable', () => {
    const dir = createTempDir();
    const key = resolveStoreEncryptionKey({
      userDataPath: dir,
      storage: {
        isEncryptionAvailable: () => false,
        encryptString: () => Buffer.from(''),
        decryptString: () => ''
      }
    });

    expect(key).toBeNull();
  });

  test('archives unreadable key files and regenerates them', () => {
    const dir = createTempDir();
    const keyFilePath = getStoreKeyFilePath(dir);
    const storage = createStorageMock();

    fs.mkdirSync(path.dirname(keyFilePath), { recursive: true });
    fs.writeFileSync(keyFilePath, 'broken');

    const regeneratedKey = resolveStoreEncryptionKey({ userDataPath: dir, storage });
    const archivedFile = fs.readdirSync(path.dirname(keyFilePath)).find((entry) => entry.startsWith('store-key.corrupt-'));

    expect(regeneratedKey).toHaveLength(64);
    expect(archivedFile).toBeTruthy();
  });

  test('archives unreadable files with a timestamped suffix', () => {
    const dir = createTempDir();
    const keyFilePath = getStoreKeyFilePath(dir);

    fs.mkdirSync(path.dirname(keyFilePath), { recursive: true });
    fs.writeFileSync(keyFilePath, 'broken');

    const archivedPath = archiveUnreadableKeyFile(keyFilePath, new Date('2026-03-06T12:00:00.000Z'));

    expect(archivedPath).toBe(
      path.join(path.dirname(keyFilePath), 'store-key.corrupt-2026-03-06T12-00-00-000Z.bin')
    );
    expect(fs.existsSync(keyFilePath)).toBe(false);
  });
});
