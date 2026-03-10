import path from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    build: {
      externalizeDeps: false,
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/preload/index.ts'),
          overlay: path.resolve(__dirname, 'src/preload/overlay.ts')
        },
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
          chunkFileNames: '[name]-[hash].cjs'
        }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/renderer/index.html'),
          positionPicker: path.resolve(__dirname, 'src/renderer/position-picker.html'),
          regionSelect: path.resolve(__dirname, 'src/renderer/region-select.html'),
          workflowPreview: path.resolve(__dirname, 'src/renderer/workflow-preview.html'),
          floatingBar: path.resolve(__dirname, 'src/renderer/floating-bar.html'),
          quickRecord: path.resolve(__dirname, 'src/renderer/quick-record.html'),
          capturePreview: path.resolve(__dirname, 'src/renderer/capture-preview.html')
        }
      }
    }
  }
});
