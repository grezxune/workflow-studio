import fs from 'node:fs';
import path from 'node:path';
import type Store from 'electron-store';
import type { Options as StoreOptions } from 'electron-store';

type StoreFactory<T extends Record<string, unknown>> = (options: StoreOptions<T>) => Store<T>;

type RecoveryLogger = {
  warn: (message: string, ...meta: unknown[]) => void;
};

export function getStoreFilePath(name: string, storeDir: string) {
  return path.join(storeDir, `${name}.json`);
}

export function isRecoverableStoreError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /unexpected token|valid json|decrypt|corrupt/i.test(error.message);
}

export function quarantineUnreadableStore(storeFilePath: string, timestamp = new Date()) {
  if (!fs.existsSync(storeFilePath)) {
    return null;
  }

  const parsedPath = path.parse(storeFilePath);
  const safeTimestamp = timestamp.toISOString().replace(/[:.]/g, '-');
  const archivedPath = path.join(
    parsedPath.dir,
    `${parsedPath.name}.corrupt-${safeTimestamp}${parsedPath.ext || '.json'}`
  );

  fs.renameSync(storeFilePath, archivedPath);
  return archivedPath;
}

export function createStoreWithRecovery<T extends Record<string, unknown>>(
  options: StoreOptions<T>,
  dependencies: {
    createStore: StoreFactory<T>;
    logger: RecoveryLogger;
    storeDir: string;
  }
) {
  try {
    return dependencies.createStore(options);
  } catch (error) {
    if (!isRecoverableStoreError(error)) {
      throw error;
    }

    const storeFilePath = getStoreFilePath(options.name ?? 'config', dependencies.storeDir);
    const archivedPath = quarantineUnreadableStore(storeFilePath);

    if (!archivedPath) {
      throw error;
    }

    dependencies.logger.warn(
      `[Storage] Archived unreadable store file and recreated defaults: ${archivedPath}`
    );

    return dependencies.createStore(options);
  }
}
