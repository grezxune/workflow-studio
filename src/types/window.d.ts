declare global {
  interface Window {
    workflowAPI: Record<string, any>;
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
