import { describe, expect, test } from 'bun:test';
import config from '../../electron.vite.config';

describe('electron vite preload config', () => {
  test('builds sandbox-compatible CommonJS preload bundles', () => {
    const preload = config.preload;

    expect(preload).toBeDefined();
    expect(preload?.build?.externalizeDeps).toBe(false);

    const output = preload?.build?.rollupOptions?.output;
    expect(output).toBeDefined();

    if (!output || Array.isArray(output)) {
      throw new Error('Expected preload build to define a single rollup output object.');
    }

    expect(output.format).toBe('cjs');
    expect(output.entryFileNames).toBe('[name].cjs');
    expect(output.chunkFileNames).toBe('[name]-[hash].cjs');
  });
});
