import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';

describe('runtime bundle generation', () => {
  test('generates syntactically valid JavaScript', () => {
    const generate = spawnSync('node', ['scripts/generate-runtime-bundle.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    expect(generate.status).toBe(0);

    const syntaxCheck = spawnSync(
      'node',
      [
        '-e',
        "const fs=require('node:fs'); const src=fs.readFileSync('src/renderer/public/runtime/runtime.bundle.js','utf8'); new Function(src);"
      ],
      {
      cwd: process.cwd(),
      encoding: 'utf8'
    }
    );

    expect(syntaxCheck.status).toBe(0);
  });
});
