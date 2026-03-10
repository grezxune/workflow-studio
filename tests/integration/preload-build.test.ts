import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

describe('preload build output', () => {
  test('emits CommonJS preload bundles for sandboxed Electron windows', () => {
    const generate = spawnSync('node', ['scripts/generate-runtime-bundle.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    expect(generate.status).toBe(0);

    const build = spawnSync('node', ['node_modules/electron-vite/bin/electron-vite.js', 'build'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    expect(build.status).toBe(0);

    const mainPreloadPath = 'out/preload/index.cjs';
    const overlayPreloadPath = 'out/preload/overlay.cjs';

    expect(fs.existsSync(mainPreloadPath)).toBe(true);
    expect(fs.existsSync(overlayPreloadPath)).toBe(true);
    expect(fs.existsSync('out/preload/index.mjs')).toBe(false);
    expect(fs.existsSync('out/preload/overlay.mjs')).toBe(false);
    expect(fs.existsSync('out/preload/chunks')).toBe(false);

    const mainPreload = fs.readFileSync(mainPreloadPath, 'utf8');
    const overlayPreload = fs.readFileSync(overlayPreloadPath, 'utf8');

    expect(mainPreload.includes('require("electron")') || mainPreload.includes("require('electron')")).toBe(true);
    expect(overlayPreload.includes('require("electron")') || overlayPreload.includes("require('electron')")).toBe(true);
    expect(mainPreload.startsWith('import ')).toBe(false);
    expect(overlayPreload.startsWith('import ')).toBe(false);
  });
});
