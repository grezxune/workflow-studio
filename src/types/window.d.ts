type RuntimeRecord = Record<string, unknown>;
type Unsubscribe = () => void;

interface WorkflowAPI {
  getWorkflows(): Promise<RuntimeRecord[]>;
  getWorkflow(id: string): Promise<RuntimeRecord | null>;
  createWorkflow(data?: RuntimeRecord): Promise<RuntimeRecord>;
  updateWorkflow(id: string, updates: RuntimeRecord): Promise<RuntimeRecord>;
  deleteWorkflow(id: string): Promise<boolean>;
  duplicateWorkflow(id: string): Promise<RuntimeRecord>;
  exportWorkflow(id: string): Promise<string | null>;
  importWorkflow(): Promise<RuntimeRecord | null>;
  getRecentWorkflows(): Promise<RuntimeRecord[]>;

  generateWorkflowWithAI(payload: RuntimeRecord): Promise<RuntimeRecord>;
  getAISupportedGames(): Promise<RuntimeRecord[]>;

  executeWorkflow(workflow: RuntimeRecord, options?: RuntimeRecord): Promise<{ success: boolean; error?: string }>;
  pauseExecution(): Promise<{ success: boolean }>;
  resumeExecution(): Promise<{ success: boolean }>;
  stopExecution(): Promise<{ success: boolean }>;
  emergencyStop(): Promise<{ success: boolean }>;
  getExecutionStatus(): Promise<RuntimeRecord>;

  getSettings(): Promise<RuntimeRecord>;
  updateSettings(updates: RuntimeRecord): Promise<RuntimeRecord>;
  getSetting(key: string): Promise<unknown>;
  setSetting(key: string, value: unknown): Promise<{ success: boolean }>;
  selectDirectory(options?: RuntimeRecord): Promise<string | null>;
  getWorkflowsDir(): Promise<string>;

  captureScreen(options?: RuntimeRecord): Promise<string>;
  captureRegion(region: RuntimeRecord, name: string): Promise<RuntimeRecord>;
  findImage(imageId: string, options?: RuntimeRecord): Promise<RuntimeRecord | null>;
  findPixel(color: RuntimeRecord, options?: RuntimeRecord): Promise<RuntimeRecord | null>;
  getPixelColor(x: number, y: number): Promise<{ r: number; g: number; b: number } | null>;
  getScreenSize(): Promise<{ width: number; height: number }>;
  captureRegionTemplate(options?: RuntimeRecord): Promise<RuntimeRecord>;
  selectScreenRegion(): Promise<RuntimeRecord | null>;
  pickScreenPosition(): Promise<{ x: number; y: number } | null>;

  getImages(): Promise<RuntimeRecord[]>;
  deleteImage(id: string): Promise<boolean>;
  renameImage(oldId: string, newId: string): Promise<RuntimeRecord>;
  saveImage(id: string, buffer: ArrayBuffer | ArrayBufferView): Promise<string>;
  clearTemplateCache(imageId?: string): Promise<{ success: boolean; error?: string }>;
  getImageFolders(): Promise<string[]>;
  createImageFolder(name: string): Promise<string[]>;
  renameImageFolder(oldName: string, newName: string): Promise<string[]>;
  deleteImageFolder(name: string): Promise<string[]>;
  moveImageToFolder(imageId: string, folder: string | null): Promise<{ success: boolean }>;

  setPanicHotkey(hotkey: string): Promise<{ success: boolean }>;
  setPauseHotkey(hotkey: string): Promise<{ success: boolean }>;
  getSafetyConfig(): Promise<RuntimeRecord>;
  triggerPanic(): Promise<{ success: boolean }>;

  getTemplates(): Promise<RuntimeRecord[]>;
  getTemplate(id: string): Promise<RuntimeRecord | null>;
  createTemplate(data?: RuntimeRecord): Promise<RuntimeRecord>;
  updateTemplate(id: string, updates: RuntimeRecord): Promise<RuntimeRecord>;
  deleteTemplate(id: string): Promise<boolean>;
  duplicateTemplate(id: string): Promise<RuntimeRecord>;

  startQuickRecord(options?: RuntimeRecord): Promise<RuntimeRecord>;
  stopQuickRecord(): Promise<{ success: boolean }>;
  updateQuickRecordMode(mode: string): Promise<{ success: boolean }>;
  onQuickRecordPosition(callback: (data: RuntimeRecord) => void): Unsubscribe;

  showWorkflowPreview(workflow: RuntimeRecord): Promise<RuntimeRecord>;
  closeWorkflowPreview(): Promise<{ success: boolean }>;
  isWorkflowPreviewOpen(): Promise<boolean>;
  onWorkflowPreviewClosed(callback: () => void): Unsubscribe;

  getMousePosition(): Promise<{ x: number; y: number }>;
  minimizeWindow(): Promise<{ success: boolean }>;
  maximizeWindow(): Promise<{ success: boolean }>;
  closeWindow(): Promise<{ success: boolean }>;
  restoreWindow(): Promise<{ success: boolean }>;

  getPermissionStatus(): Promise<RuntimeRecord>;
  requestAccessibilityPermission(): Promise<RuntimeRecord>;

  onExecutionStarted(callback: (data: RuntimeRecord) => void): Unsubscribe;
  onExecutionCompleted(callback: (data: RuntimeRecord) => void): Unsubscribe;
  onExecutionStopped(callback: (data: RuntimeRecord) => void): Unsubscribe;
  onExecutionError(callback: (data: RuntimeRecord) => void): Unsubscribe;
  onExecutionPaused(callback: (data: RuntimeRecord) => void): Unsubscribe;
  onExecutionResumed(callback: (data: RuntimeRecord) => void): Unsubscribe;
  onActionStarted(callback: (data: RuntimeRecord) => void): Unsubscribe;
  onActionCompleted(callback: (data: RuntimeRecord) => void): Unsubscribe;
  onActionError(callback: (data: RuntimeRecord) => void): Unsubscribe;
  onWaitStart(callback: (data: RuntimeRecord) => void): Unsubscribe;
  onWaitTick(callback: (data: RuntimeRecord) => void): Unsubscribe;
  onLoopStarted(callback: (data: RuntimeRecord) => void): Unsubscribe;
  onLoopCompleted(callback: (data: RuntimeRecord) => void): Unsubscribe;
  onStateChanged(callback: (data: RuntimeRecord) => void): Unsubscribe;
  onPanicTriggered(callback: (data: RuntimeRecord) => void): Unsubscribe;

  showFloatingBar(): Promise<{ success: boolean }>;
  hideFloatingBar(): Promise<{ success: boolean }>;
  closeFloatingBar(): Promise<{ success: boolean }>;
  updateFloatingBarPause(paused: boolean): Promise<{ success: boolean }>;
  updateFloatingBarStopTimer(data: RuntimeRecord): Promise<{ success: boolean }>;
  syncFloatingBarWait(data: RuntimeRecord): Promise<{ success: boolean }>;
  onFloatingBarPauseClicked(callback: () => void): Unsubscribe;
  onFloatingBarStopClicked(callback: () => void): Unsubscribe;
  onFloatingBarExpandClicked(callback: () => void): Unsubscribe;

  checkForUpdates(): Promise<RuntimeRecord>;
  restartToUpdate(): Promise<void>;
  onUpdateAvailable(callback: (data: RuntimeRecord) => void): Unsubscribe;
  onUpdateNotAvailable(callback: (data?: RuntimeRecord) => void): Unsubscribe;
  onUpdateDownloadProgress(callback: (data: RuntimeRecord) => void): Unsubscribe;
  onUpdateDownloaded(callback: (data: RuntimeRecord) => void): Unsubscribe;
  onUpdateError(callback: (data: RuntimeRecord) => void): Unsubscribe;

  getHotkeys(): Promise<RuntimeRecord[]>;
  setHotkey(accelerator: string, workflowId: string, workflowName: string): Promise<{ success: boolean }>;
  removeHotkey(workflowId: string): Promise<{ success: boolean }>;
  onHotkeyTriggered(callback: (data: RuntimeRecord) => void): Unsubscribe;

  removeAllListeners(): void;
}

interface OverlayFloatingBarAPI {
  onUpdateAction(callback: (data: { text?: string }) => void): Unsubscribe;
  onUpdatePause(callback: (paused: boolean) => void): Unsubscribe;
  onWaitStart(callback: (data: { duration: number }) => void): Unsubscribe;
  onWaitTick(callback: (data: { duration: number; remaining: number; paused: boolean }) => void): Unsubscribe;
  onWaitHide(callback: () => void): Unsubscribe;
  onStopTimer(callback: (data: { visible?: boolean; text?: string }) => void): Unsubscribe;
  sendPause(): void;
  sendStop(): void;
  sendExpand(): void;
}

interface OverlayWorkflowPreviewAPI {
  onInit(callback: (data: RuntimeRecord) => void): Unsubscribe;
  close(): void;
}

interface OverlayQuickRecordAPI {
  onInit(callback: (data: RuntimeRecord) => void): Unsubscribe;
  onModeChanged(callback: (mode: string) => void): Unsubscribe;
  sendPosition(payload: { x: number; y: number; sequence: string[] }): void;
  sendSequenceChange(sequence: string[]): void;
  sendStop(): void;
}

interface OverlayRegionSelectAPI {
  sendRegionSelected(region: { x: number; y: number; width: number; height: number }): void;
  sendCancelled(): void;
}

interface OverlayPositionPickerAPI {
  sendPositionPicked(position: { x: number; y: number }): void;
  sendCancelled(): void;
}

interface OverlayCapturePreviewAPI {
  onImageData(callback: (data: RuntimeRecord) => void): Unsubscribe;
  sendConfirm(payload: { name: string }): void;
  sendRedo(): void;
  sendCancel(): void;
}

interface OverlayAPI {
  floatingBar: OverlayFloatingBarAPI;
  workflowPreview: OverlayWorkflowPreviewAPI;
  quickRecord: OverlayQuickRecordAPI;
  regionSelect: OverlayRegionSelectAPI;
  positionPicker: OverlayPositionPickerAPI;
  capturePreview: OverlayCapturePreviewAPI;
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
