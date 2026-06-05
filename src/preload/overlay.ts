import { contextBridge, ipcRenderer } from 'electron';

type DataCallback<T = unknown> = (data: T) => void;

function subscribe<T = unknown>(channel: string, callback: DataCallback<T>): () => void {
  const handler = (_event: Electron.IpcRendererEvent, data: T) => {
    callback(data);
  };
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('overlayAPI', {
  floatingBar: {
    onUpdateAction: (callback: DataCallback<{ text?: string }>) => subscribe('floating-bar:update-action', callback),
    onUpdatePause: (callback: DataCallback<boolean>) => subscribe('floating-bar:update-pause', callback),
    onWaitStart: (callback: DataCallback<{ duration: number }>) => subscribe('floating-bar:wait-start', callback),
    onWaitTick: (callback: DataCallback<{ duration: number; remaining: number; paused: boolean }>) =>
      subscribe('floating-bar:wait-tick', callback),
    onWaitHide: (callback: DataCallback<void>) => subscribe('floating-bar:wait-hide', callback),
    onStopTimer: (callback: DataCallback<{ visible?: boolean; text?: string }>) =>
      subscribe('floating-bar:stop-timer', callback),
    onVariablesSync: (callback: DataCallback<{ variables?: unknown[] }>) =>
      subscribe('floating-bar:variables-sync', callback),
    onVariableChanged: (callback: DataCallback<{ variable?: Record<string, unknown> }>) =>
      subscribe('floating-bar:variable-changed', callback),
    sendPause: () => ipcRenderer.send('floating-bar:pause'),
    sendStop: () => ipcRenderer.send('floating-bar:stop'),
    sendExpand: () => ipcRenderer.send('floating-bar:expand'),
    sendResetVariable: (variableId: string) => ipcRenderer.send('floating-bar:reset-variable', variableId),
    sendSetStopTime: (payload: { from: string; to?: string }) => ipcRenderer.send('floating-bar:set-stop-time', payload),
    sendClearStopTime: () => ipcRenderer.send('floating-bar:clear-stop-time')
  },

  workflowPreview: {
    onInit: (callback: DataCallback<{
      targets: Array<Record<string, unknown>>;
      offset: { x: number; y: number };
      workflowName: string;
    }>) => subscribe('workflow-preview:init', callback),
    close: () => ipcRenderer.send('workflow-preview:close')
  },

  quickRecord: {
    onInit: (callback: DataCallback<{ mode: string; offset: { x: number; y: number } }>) =>
      subscribe('quick-record:init', callback),
    onModeChanged: (callback: DataCallback<string>) => subscribe('quick-record:mode-changed', callback),
    sendPosition: (payload: { x: number; y: number; sequence: string[] }) => ipcRenderer.send('quick-record:position', payload),
    sendSequenceChange: (sequence: string[]) => ipcRenderer.send('quick-record:sequence-change', sequence),
    sendStop: () => ipcRenderer.send('quick-record:stop')
  },

  regionSelect: {
    sendRegionSelected: (region: { x: number; y: number; width: number; height: number }) =>
      ipcRenderer.send('region-selected', region),
    sendCancelled: () => ipcRenderer.send('region-cancelled')
  },

  positionPicker: {
    sendPositionPicked: (position: { x: number; y: number }) => ipcRenderer.send('position-picked', position),
    sendCancelled: () => ipcRenderer.send('position-cancelled')
  },

  capturePreview: {
    onImageData: (callback: DataCallback<{ imagePath: string; region: { width: number; height: number }; defaultName?: string }>) =>
      subscribe('preview-image-data', callback),
    sendConfirm: (payload: { name: string }) => ipcRenderer.send('capture-preview-confirm', payload),
    sendRedo: () => ipcRenderer.send('capture-preview-redo'),
    sendCancel: () => ipcRenderer.send('capture-preview-cancel')
  }
});
