import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type SafeStorageLike = {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
};

export type FileSystemLike = Pick<typeof fs, 'existsSync' | 'mkdirSync' | 'readFileSync' | 'renameSync' | 'writeFileSync'>;

type LoggerLike = {
  info: (message: string, ...meta: unknown[]) => void;
  warn: (message: string, ...meta: unknown[]) => void;
};

const STORE_KEY_DIRECTORY = 'secrets';
const STORE_KEY_FILE = 'store-key.bin';

export function createRandomStoreKey() {
  return crypto.randomBytes(32).toString('hex');
}

export function getStoreKeyFilePath(userDataPath: string) {
  return path.join(userDataPath, STORE_KEY_DIRECTORY, STORE_KEY_FILE);
}

export function archiveUnreadableKeyFile(
  keyFilePath: string,
  timestamp = new Date(),
  fileSystem: FileSystemLike = fs
) {
  if (!fileSystem.existsSync(keyFilePath)) {
    return null;
  }

  const parsed = path.parse(keyFilePath);
  const suffix = timestamp.toISOString().replace(/[:.]/g, '-');
  const archivedPath = path.join(parsed.dir, `${parsed.name}.corrupt-${suffix}${parsed.ext || '.bin'}`);

  fileSystem.renameSync(keyFilePath, archivedPath);
  return archivedPath;
}

function createAndPersistStoreKey(
  keyFilePath: string,
  storage: SafeStorageLike,
  fileSystem: FileSystemLike
) {
  const key = createRandomStoreKey();
  fileSystem.mkdirSync(path.dirname(keyFilePath), { recursive: true });
  fileSystem.writeFileSync(keyFilePath, storage.encryptString(key));
  return key;
}

export function resolveStoreEncryptionKey(options: {
  environmentKey?: string | null;
  userDataPath: string;
  storage: SafeStorageLike;
  fileSystem?: FileSystemLike;
  logger?: LoggerLike;
}) {
  const environmentKey = options.environmentKey?.trim();
  if (environmentKey) {
    options.logger?.info('[Storage] Using store encryption key from environment override.');
    return environmentKey;
  }

  if (!options.storage.isEncryptionAvailable()) {
    options.logger?.warn('[Storage] OS secure storage is unavailable; settings will be stored without encryption.');
    return null;
  }

  const fileSystem = options.fileSystem ?? fs;
  const keyFilePath = getStoreKeyFilePath(options.userDataPath);

  if (!fileSystem.existsSync(keyFilePath)) {
    return createAndPersistStoreKey(keyFilePath, options.storage, fileSystem);
  }

  try {
    const encryptedKey = fileSystem.readFileSync(keyFilePath);
    return options.storage.decryptString(encryptedKey);
  } catch (error) {
    const archivedPath = archiveUnreadableKeyFile(keyFilePath, new Date(), fileSystem);
    options.logger?.warn(
      `[Storage] Archived unreadable secure store key and generated a new one: ${archivedPath}`,
      error
    );
    return createAndPersistStoreKey(keyFilePath, options.storage, fileSystem);
  }
}
