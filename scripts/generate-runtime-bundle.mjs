import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const chunkOrder = [
  'ui-buttons.ts',
  'duration-input.ts',
  'app-init.ts',
  'app-ipc.ts',
  'app-ui.ts',
  'analytics.ts',
  'workflows-state.ts',
  'workflows-cards.ts',
  'workflows-actions.ts',
  'workflows-io.ts',
  'workflows-history.ts',
  'editor-state-metadata.ts',
  'editor-view-controls.ts',
  'editor-ai-compose.ts',
  'editor-palette-events.ts',
  'editor-sequence-base.ts',
  'editor-sequence-inline.ts',
  'editor-sequence-dnd.ts',
  'editor-core-actions.ts',
  'editor-config-render.ts',
  'editor-config-logic.ts',
  'editor-config-image.ts',
  'editor-config-pixel.ts',
  'editor-config-update.ts',
  'editor-nested-images.ts',
  'editor-nested-list-modal.ts',
  'editor-nested-config.ts',
  'editor-nested-dnd.ts',
  'editor-templates-list.ts',
  'editor-templates-manage.ts',
  'editor-key-recorder.ts',
  'images-folders.ts',
  'images-gallery.ts',
  'settings-init.ts',
  'settings-actions.ts',
  'hotkeys-core.ts',
  'hotkeys-recorder.ts',
  'execution-init.ts',
  'execution-controls.ts',
  'execution-schedule.ts',
  'quick-record-core.ts',
  'quick-record-actions.ts'
];

const chunksDir = path.join(projectRoot, 'src/renderer/src/runtime/chunks');
const outputDir = path.join(projectRoot, 'src/renderer/public/runtime');
const outputFile = path.join(outputDir, 'runtime.bundle.js');

const header = [
  '/*',
  ' * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY.',
  ' * Source: src/renderer/src/runtime/chunks/*.ts',
  ' * Regenerate with: bun run gen:runtime',
  ' */',
  ''
].join('\n');

const contents = [header];

for (const chunk of chunkOrder) {
  const chunkPath = path.join(chunksDir, chunk);
  if (!fs.existsSync(chunkPath)) {
    throw new Error(`Missing runtime chunk: ${chunkPath}`);
  }
  const source = fs.readFileSync(chunkPath, 'utf8').trimEnd();
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      removeComments: false
    },
    fileName: chunkPath
  }).outputText.trimEnd();
  contents.push(`// ===== ${chunk} =====`);
  contents.push(transpiled);
  contents.push('');
}

fs.mkdirSync(outputDir, { recursive: true });
const bundleOutput = contents.join('\n');
try {
  new Function(bundleOutput);
} catch (error) {
  throw new Error(`[gen:runtime] Generated runtime bundle is invalid JavaScript: ${error.message}`);
}
fs.writeFileSync(outputFile, bundleOutput, 'utf8');
console.log(`[gen:runtime] Wrote ${path.relative(projectRoot, outputFile)}`);
