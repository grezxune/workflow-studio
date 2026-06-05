/**
 * Workflow Studio - Editor View
 *
 * Handles workflow editing, action palette, and drag-drop
 */

// Action types with their metadata
const ACTION_TYPES = {
  mouse_move: {
    name: 'Mouse Move',
    icon: '<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/>',
    description: 'Move cursor to position'
  },
  mouse_click: {
    name: 'Mouse Click',
    icon: '<path d="M9 9a3 3 0 1 0 6 0 3 3 0 0 0-6 0z"/><path d="M12 3v3m0 12v3m9-9h-3M6 12H3"/>',
    description: 'Click at position'
  },
  keyboard: {
    name: 'Keyboard',
    icon: '<rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><line x1="6" y1="8" x2="6.01" y2="8"/><line x1="10" y1="8" x2="10.01" y2="8"/><line x1="14" y1="8" x2="14.01" y2="8"/><line x1="18" y1="8" x2="18.01" y2="8"/><line x1="8" y1="12" x2="8.01" y2="12"/><line x1="12" y1="12" x2="12.01" y2="12"/><line x1="16" y1="12" x2="16.01" y2="12"/><line x1="7" y1="16" x2="17" y2="16"/>',
    description: 'Type text or press keys'
  },
  wait: {
    name: 'Wait',
    icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    description: 'Wait for duration'
  },
  conditional: {
    name: 'Conditional',
    icon: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    description: 'If/then logic'
  },
  loop: {
    name: 'Loop',
    icon: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    description: 'Repeat actions'
  },
  image_detect: {
    name: 'Find Image',
    icon: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    description: 'Detect image on screen'
  },
  pixel_detect: {
    name: 'Find Pixel',
    icon: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
    description: 'Find pixel by color'
  }
};

// Editor state
let editorState = {
  selectedActionIndex: -1,
  draggedAction: null,
  isDirty: false,
  isAIGenerating: false,
  templates: [],
  selectedActionIndices: [], // For multi-select when saving templates
  compactView: false,
  systemSounds: [{ id: 'none', label: 'No sound' }]
};

// DOM references
let actionList = null;
let actionSequence = null;
let workflowNameInput = null;
let loopCountInput = null;
let loopInfiniteInput = null;
let loopDelayMinInput = null;
let loopDelayMaxInput = null;
let configPanel = null;
let templateList = null;
let toggleViewBtn = null;
let toggleAIBtn = null;
let aiComposer = null;
let aiGameSelect = null;
let aiModelSelect = null;
let aiApplyModeSelect = null;
let aiPromptInput = null;
let aiGenerateBtn = null;
let aiComposerMeta = null;
let aiContextPill = null;
let workflowVariablesBtn = null;
let workflowVariablesBadge = null;

/**
 * Initialize editor view
 */
function initEditorView() {
  actionList = document.getElementById('action-list');
  actionSequence = document.getElementById('action-sequence');
  workflowNameInput = document.getElementById('workflow-name');
  loopCountInput = document.getElementById('loop-count');
  loopInfiniteInput = document.getElementById('loop-infinite');
  loopDelayMinInput = document.getElementById('loop-delay-min');
  loopDelayMaxInput = document.getElementById('loop-delay-max');
  configPanel = document.getElementById('config-panel');
  templateList = document.getElementById('template-list');
  toggleViewBtn = document.getElementById('btn-toggle-view');
  toggleAIBtn = document.getElementById('btn-toggle-ai');
  aiComposer = document.getElementById('ai-composer');
  aiGameSelect = document.getElementById('ai-game-select');
  aiModelSelect = document.getElementById('ai-model-select');
  aiApplyModeSelect = document.getElementById('ai-apply-mode');
  aiPromptInput = document.getElementById('ai-prompt-input');
  aiGenerateBtn = document.getElementById('btn-ai-generate');
  aiComposerMeta = document.getElementById('ai-composer-meta');
  aiContextPill = document.getElementById('ai-context-pill');
  workflowVariablesBtn = document.getElementById('btn-workflow-variables');
  workflowVariablesBadge = document.getElementById('workflow-variables-badge');

  // Populate action palette
  populateActionPalette();

  // Setup event listeners
  setupEditorEvents();

  // Setup view toggle
  setupViewToggle();

  // Setup preview overlay
  setupPreviewOverlay();

  // Setup AI composer
  initAIComposer();

  // Load templates
  loadTemplates();
  loadSystemSounds();
}

