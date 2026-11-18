import { beforeAll, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const chunksDir = 'src/renderer/src/runtime/chunks';
const bundlePath = 'src/renderer/public/runtime/runtime.bundle.js';

function topLevelFunctionNames(fileName: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2020);
  return sourceFile.statements.flatMap((statement) =>
    ts.isFunctionDeclaration(statement) && statement.name ? [statement.name.text] : []
  );
}

describe('runtime bundle generation', () => {
  let generate: ReturnType<typeof spawnSync>;

  beforeAll(() => {
    generate = spawnSync('node', ['scripts/generate-runtime-bundle.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });
  });

  test('generates syntactically valid JavaScript', () => {
    // Matching on the object prints the generator's stderr when it fails.
    expect({ status: generate.status, stderr: generate.stderr }).toMatchObject({ status: 0 });

    const syntaxCheck = spawnSync(
      'node',
      [
        '-e',
        `const fs=require('node:fs'); const src=fs.readFileSync('${bundlePath}','utf8'); new Function(src);`
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8'
      }
    );

    expect(syntaxCheck.status).toBe(0);
  });

  // Chunks are concatenated, so an unclosed comment in one chunk can hide code in the
  // next and still leave the bundle valid. Each chunk has to parse on its own.
  test('every chunk parses on its own', () => {
    const errors = fs
      .readdirSync(chunksDir)
      .filter((chunk) => chunk.endsWith('.ts'))
      .flatMap((chunk) => {
        const result = ts.transpileModule(fs.readFileSync(path.join(chunksDir, chunk), 'utf8'), {
          compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
          fileName: chunk,
          reportDiagnostics: true
        });
        return (result.diagnostics ?? []).map(
          (diagnostic) =>
            `${chunk}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`
        );
      });

    expect(errors).toEqual([]);
  });

  test('declares the conditional editor helpers', () => {
    const declared = topLevelFunctionNames(bundlePath, fs.readFileSync(bundlePath, 'utf8'));

    expect(declared).toEqual(
      expect.arrayContaining([
        'normalizeConditionalBranchCondition',
        'renderConditionalConditionFields',
        'setConditionalConditionFieldVisibility',
        'bindConditionalConditionEditor'
      ])
    );
  });
});
