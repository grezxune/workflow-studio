import { app, safeStorage } from 'electron';
import { resolveStoreEncryptionKey } from './store-encryption-key-core';

export { archiveUnreadableKeyFile, createRandomStoreKey, getStoreKeyFilePath } from './store-encryption-key-core';

export function getStoreEncryptionKey() {
  return resolveStoreEncryptionKey({
    environmentKey: process.env.WORKFLOW_STUDIO_STORE_KEY,
    userDataPath: app.getPath('userData'),
    storage: safeStorage,
    logger: console
  });
}
