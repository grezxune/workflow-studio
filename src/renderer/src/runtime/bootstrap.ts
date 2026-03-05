const RUNTIME_BUNDLE_RELATIVE_PATH = './runtime/runtime.bundle.js';

let runtimeLoaded = false;
let runtimeLoadPromise: Promise<void> | null = null;

function getRuntimeBundleUrl(): string {
  return new URL(RUNTIME_BUNDLE_RELATIVE_PATH, window.location.href).toString();
}

function loadRuntimeBundleScript(): Promise<void> {
  if (runtimeLoadPromise) {
    return runtimeLoadPromise;
  }

  runtimeLoadPromise = new Promise((resolve, reject) => {
    const runtimeWindow = window as Window & { __workflowRuntimeScriptLoaded?: boolean };
    if (runtimeWindow.__workflowRuntimeScriptLoaded) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.async = false;
    script.src = getRuntimeBundleUrl();
    script.onload = () => {
      runtimeWindow.__workflowRuntimeScriptLoaded = true;
      resolve();
    };
    script.onerror = () => {
      reject(new Error(`Failed to load runtime bundle: ${script.src}`));
    };
    document.head.appendChild(script);
  });

  return runtimeLoadPromise;
}

/**
 * Load renderer runtime bundle and execute application initialization.
 */
export async function bootstrapRendererRuntime(): Promise<void> {
  if (runtimeLoaded) {
    return;
  }

  await loadRuntimeBundleScript();
  runtimeLoaded = true;

  const runtimeWindow = window as Window & {
    initExecutionUI?: () => void;
    initApp?: () => Promise<void> | void;
  };

  try {
    runtimeWindow.initExecutionUI?.();
  } catch (error) {
    console.error('[RendererBootstrap] Failed to initialize execution UI:', error);
  }

  try {
    await runtimeWindow.initApp?.();
  } catch (error) {
    console.error('[RendererBootstrap] Failed to initialize app:', error);
  }
}
