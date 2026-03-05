import uiButtonsChunkSource from './chunks/ui-buttons.ts?raw';
import appInitChunkSource from './chunks/app-init.ts?raw';
import appIpcChunkSource from './chunks/app-ipc.ts?raw';
import appUiChunkSource from './chunks/app-ui.ts?raw';
import workflowsStateChunkSource from './chunks/workflows-state.ts?raw';
import workflowsCardsChunkSource from './chunks/workflows-cards.ts?raw';
import workflowsActionsChunkSource from './chunks/workflows-actions.ts?raw';
import workflowsIoChunkSource from './chunks/workflows-io.ts?raw';
import workflowsHistoryChunkSource from './chunks/workflows-history.ts?raw';
import editorStateMetadataChunkSource from './chunks/editor-state-metadata.ts?raw';
import editorViewControlsChunkSource from './chunks/editor-view-controls.ts?raw';
import editorAiComposeChunkSource from './chunks/editor-ai-compose.ts?raw';
import editorPaletteEventsChunkSource from './chunks/editor-palette-events.ts?raw';
import editorSequenceBaseChunkSource from './chunks/editor-sequence-base.ts?raw';
import editorSequenceInlineChunkSource from './chunks/editor-sequence-inline.ts?raw';
import editorSequenceDndChunkSource from './chunks/editor-sequence-dnd.ts?raw';
import editorCoreActionsChunkSource from './chunks/editor-core-actions.ts?raw';
import editorConfigRenderChunkSource from './chunks/editor-config-render.ts?raw';
import editorConfigLogicChunkSource from './chunks/editor-config-logic.ts?raw';
import editorConfigImageChunkSource from './chunks/editor-config-image.ts?raw';
import editorConfigPixelChunkSource from './chunks/editor-config-pixel.ts?raw';
import editorConfigUpdateChunkSource from './chunks/editor-config-update.ts?raw';
import editorNestedImagesChunkSource from './chunks/editor-nested-images.ts?raw';
import editorNestedListModalChunkSource from './chunks/editor-nested-list-modal.ts?raw';
import editorNestedConfigChunkSource from './chunks/editor-nested-config.ts?raw';
import editorNestedDndChunkSource from './chunks/editor-nested-dnd.ts?raw';
import editorTemplatesListChunkSource from './chunks/editor-templates-list.ts?raw';
import editorTemplatesManageChunkSource from './chunks/editor-templates-manage.ts?raw';
import editorKeyRecorderChunkSource from './chunks/editor-key-recorder.ts?raw';
import imagesFoldersChunkSource from './chunks/images-folders.ts?raw';
import imagesGalleryChunkSource from './chunks/images-gallery.ts?raw';
import settingsInitChunkSource from './chunks/settings-init.ts?raw';
import settingsActionsChunkSource from './chunks/settings-actions.ts?raw';
import hotkeysCoreChunkSource from './chunks/hotkeys-core.ts?raw';
import hotkeysRecorderChunkSource from './chunks/hotkeys-recorder.ts?raw';
import executionInitChunkSource from './chunks/execution-init.ts?raw';
import executionControlsChunkSource from './chunks/execution-controls.ts?raw';
import executionScheduleChunkSource from './chunks/execution-schedule.ts?raw';
import quickRecordCoreChunkSource from './chunks/quick-record-core.ts?raw';
import quickRecordActionsChunkSource from './chunks/quick-record-actions.ts?raw';

const runtimeChunkSources = [
  uiButtonsChunkSource,
  appInitChunkSource,
  appIpcChunkSource,
  appUiChunkSource,
  workflowsStateChunkSource,
  workflowsCardsChunkSource,
  workflowsActionsChunkSource,
  workflowsIoChunkSource,
  workflowsHistoryChunkSource,
  editorStateMetadataChunkSource,
  editorViewControlsChunkSource,
  editorAiComposeChunkSource,
  editorPaletteEventsChunkSource,
  editorSequenceBaseChunkSource,
  editorSequenceInlineChunkSource,
  editorSequenceDndChunkSource,
  editorCoreActionsChunkSource,
  editorConfigRenderChunkSource,
  editorConfigLogicChunkSource,
  editorConfigImageChunkSource,
  editorConfigPixelChunkSource,
  editorConfigUpdateChunkSource,
  editorNestedImagesChunkSource,
  editorNestedListModalChunkSource,
  editorNestedConfigChunkSource,
  editorNestedDndChunkSource,
  editorTemplatesListChunkSource,
  editorTemplatesManageChunkSource,
  editorKeyRecorderChunkSource,
  imagesFoldersChunkSource,
  imagesGalleryChunkSource,
  settingsInitChunkSource,
  settingsActionsChunkSource,
  hotkeysCoreChunkSource,
  hotkeysRecorderChunkSource,
  executionInitChunkSource,
  executionControlsChunkSource,
  executionScheduleChunkSource,
  quickRecordCoreChunkSource,
  quickRecordActionsChunkSource
] as const;

let runtimeLoaded = false;

function loadScriptSource(source: string): Promise<void> {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.async = false;
    script.textContent = source;
    document.body.appendChild(script);
    resolve();
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

  for (const source of runtimeChunkSources) {
    await loadScriptSource(source);
  }

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
