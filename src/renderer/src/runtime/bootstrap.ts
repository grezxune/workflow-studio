const runtimeChunkUrls = [
  '/runtime/chunks/app.js',
  '/runtime/chunks/workflows.js',
  '/runtime/chunks/editor-core.js',
  '/runtime/chunks/editor-config.js',
  '/runtime/chunks/editor-nested.js',
  '/runtime/chunks/editor-templates.js',
  '/runtime/chunks/images.js',
  '/runtime/chunks/settings.js',
  '/runtime/chunks/hotkeys.js',
  '/runtime/chunks/execution.js',
  '/runtime/chunks/quick-record.js'
] as const;

let runtimeLoaded = false;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load runtime chunk: ${src}`));
    document.body.appendChild(script);
  });
}

/**
 * Load renderer runtime chunks in deterministic order.
 * These chunks preserve the app's existing behavior while keeping files modular.
 */
export async function bootstrapRendererRuntime(): Promise<void> {
  if (runtimeLoaded) {
    return;
  }

  runtimeLoaded = true;

  for (const src of runtimeChunkUrls) {
    await loadScript(src);
  }
}
