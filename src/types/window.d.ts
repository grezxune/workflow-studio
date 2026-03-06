interface WorkflowAPI {
  [method: string]: ((...args: unknown[]) => unknown) | undefined;
}

interface OverlayAPI {
  [scope: string]: Record<string, ((...args: unknown[]) => unknown) | undefined> | undefined;
}

declare global {
  interface Window {
    workflowAPI: WorkflowAPI;
    overlayAPI?: OverlayAPI;
    platform: {
      isMac: boolean;
      isWindows: boolean;
      isLinux: boolean;
      platform: string;
      appVersion: string;
    };
    quickRecord?: {
      init?: () => void;
    };
    __workflowRuntimeBootstrapped?: boolean;
    __workflowRuntimeScriptLoaded?: boolean;
    initApp?: () => Promise<void> | void;
    initExecutionUI?: () => void;
  }
}

export {};
