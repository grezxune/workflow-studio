/**
 * Shared constants used across main and renderer processes
 */

export const ACTION_TYPES = {
  MOUSE_MOVE: 'mouse_move',
  MOUSE_CLICK: 'mouse_click',
  KEYBOARD: 'keyboard',
  WAIT: 'wait',
  CONDITIONAL: 'conditional',
  LOOP: 'loop',
  IMAGE_DETECT: 'image_detect',
  PIXEL_DETECT: 'pixel_detect'
};

export const CLICK_BUTTONS = {
  LEFT: 'left',
  RIGHT: 'right',
  MIDDLE: 'middle'
};

export const CLICK_TYPES = {
  SINGLE: 'single',
  DOUBLE: 'double',
  HOLD: 'hold'
};

export const KEYBOARD_MODES = {
  TYPE: 'type',
  PRESS: 'press',
  HOLD: 'hold',
  RELEASE: 'release',
  HOLD_AND_ACT: 'hold_and_act'
};

export const WAIT_MODES = {
  DELAY: 'delay',
  DETECT_TRUE: 'detect_true',
  DETECT_FALSE: 'detect_false'
};

export const DETECTION_TYPES = {
  PIXEL: 'pixel',
  COLOR_REGION: 'color_region',
  IMAGE: 'image',
  OCR: 'ocr'
};

export const DETECTION_METHODS = {
  TEMPLATE: 'template',
  FEATURE: 'feature',
  PIXEL: 'pixel'
};

export const DETECTION_ENGINES = {
  NUTJS: 'nutjs',
  OPENCV: 'opencv',
  SHARP: 'sharp'
};

export const EXECUTION_STATES = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  STOPPED: 'stopped',
  COMPLETED: 'completed',
  ERROR: 'error'
};

export const WORKFLOW_STATUS = EXECUTION_STATES;

export const JITTER_DISTRIBUTIONS = {
  GAUSSIAN: 'gaussian',
  UNIFORM: 'uniform'
};

export const SAFETY_KEYS = {
  PANIC: 'F7',
  FOCUS_CHECK: 'F8',
  DRY_RUN: 'F9'
};

export const IPC_CHANNELS = {
  GET_WORKFLOWS: 'workflow:get-all',
  GET_WORKFLOW: 'workflow:get',
  CREATE_WORKFLOW: 'workflow:create',
  UPDATE_WORKFLOW: 'workflow:update',
  DELETE_WORKFLOW: 'workflow:delete',
  DUPLICATE_WORKFLOW: 'workflow:duplicate',
  EXPORT_WORKFLOW: 'workflow:export',
  IMPORT_WORKFLOW: 'workflow:import',
  GET_RECENT_WORKFLOWS: 'workflow:get-recent',

  EXECUTE_WORKFLOW: 'execution:start',
  STOP_EXECUTION: 'execution:stop',
  PAUSE_EXECUTION: 'execution:pause',
  RESUME_EXECUTION: 'execution:resume',
  EMERGENCY_STOP: 'execution:emergency-stop',
  GET_EXECUTION_STATUS: 'execution:get-status',

  EXECUTION_STARTED: 'execution:started',
  EXECUTION_COMPLETED: 'execution:completed',
  EXECUTION_STOPPED: 'execution:stopped',
  EXECUTION_ERROR: 'execution:error',
  EXECUTION_PAUSED: 'execution:paused',
  EXECUTION_RESUMED: 'execution:resumed',
  EXECUTION_STATE_CHANGED: 'execution:state-changed',

  ACTION_STARTED: 'action:started',
  ACTION_COMPLETED: 'action:completed',
  ACTION_ERROR: 'action:error',

  LOOP_STARTED: 'loop:started',
  LOOP_COMPLETED: 'loop:completed',

  GET_SETTINGS: 'settings:get',
  UPDATE_SETTINGS: 'settings:update',
  GET_SETTING: 'settings:get-one',
  SET_SETTING: 'settings:set-one',
  SELECT_DIRECTORY: 'settings:select-dir',
  GET_WORKFLOWS_DIR: 'settings:get-workflows-dir',

  SET_PANIC_HOTKEY: 'safety:set-panic-hotkey',
  GET_SAFETY_CONFIG: 'safety:get-config',
  TRIGGER_PANIC: 'safety:trigger-panic',
  PANIC_TRIGGERED: 'safety:panic-triggered',

  CAPTURE_SCREEN: 'detection:capture-screen',
  CAPTURE_REGION: 'detection:capture-region',
  FIND_IMAGE: 'detection:find-image',
  FIND_PIXEL: 'detection:find-pixel',
  GET_PIXEL_COLOR: 'detection:get-pixel-color',
  GET_SCREEN_SIZE: 'detection:get-screen-size',

  GET_IMAGES: 'images:get-all',
  DELETE_IMAGE: 'images:delete',
  SAVE_IMAGE: 'images:save',

  GET_MOUSE_POSITION: 'util:get-mouse-pos',
  MINIMIZE_WINDOW: 'window:minimize',
  MAXIMIZE_WINDOW: 'window:maximize',
  CLOSE_WINDOW: 'window:close',

  // Templates
  GET_TEMPLATES: 'template:get-all',
  GET_TEMPLATE: 'template:get',
  CREATE_TEMPLATE: 'template:create',
  UPDATE_TEMPLATE: 'template:update',
  DELETE_TEMPLATE: 'template:delete',
  DUPLICATE_TEMPLATE: 'template:duplicate'
};

export const DEFAULT_SETTINGS = {
  workflowsDir: null,
  panicHotkey: 'F7',
  theme: 'dark',
  defaultLoopDelay: { min: 500, max: 1000 },
  typingSpeed: { min: 50, max: 150 },
  mouseMoveDuration: 250,
  clickJitter: {
    enabled: true,
    radius: 3,
    distribution: JITTER_DISTRIBUTIONS.GAUSSIAN
  },
  windMouse: {
    gravity: 9.0,
    wind: 3.0,
    minWait: 2,
    maxWait: 10,
    maxStep: 10,
    targetArea: 8
  },
  overshoot: {
    enabled: true,
    frequency: 0.15,
    distanceMultiplier: { min: 0.05, max: 0.15 },
    correctionSpeed: { min: 0.3, max: 0.6 },
    pauseBeforeCorrection: { min: 50, max: 150 }
  },
  detection: {
    confidence: 0.9,
    method: DETECTION_METHODS.TEMPLATE
  }
};

export const ACTION_TYPE_META = {
  [ACTION_TYPES.MOUSE_MOVE]: {
    name: 'Mouse Move',
    icon: 'cursor-arrow-rays',
    color: 'cyan',
    description: 'Move the mouse cursor to a position'
  },
  [ACTION_TYPES.MOUSE_CLICK]: {
    name: 'Mouse Click',
    icon: 'cursor-arrow-ripple',
    color: 'blue',
    description: 'Click at the current or specified position'
  },
  [ACTION_TYPES.KEYBOARD]: {
    name: 'Keyboard',
    icon: 'keyboard',
    color: 'violet',
    description: 'Type text or press keys'
  },
  [ACTION_TYPES.WAIT]: {
    name: 'Wait',
    icon: 'clock',
    color: 'amber',
    description: 'Wait for a duration or condition'
  },
  [ACTION_TYPES.CONDITIONAL]: {
    name: 'Conditional',
    icon: 'question-mark-circle',
    color: 'emerald',
    description: 'Execute actions based on a condition'
  },
  [ACTION_TYPES.LOOP]: {
    name: 'Loop',
    icon: 'arrow-path',
    color: 'rose',
    description: 'Repeat a set of actions'
  },
  [ACTION_TYPES.IMAGE_DETECT]: {
    name: 'Find Image',
    icon: 'photo',
    color: 'indigo',
    description: 'Detect an image on screen'
  },
  [ACTION_TYPES.PIXEL_DETECT]: {
    name: 'Find Pixel',
    icon: 'eye-dropper',
    color: 'pink',
    description: 'Find a pixel by color'
  }
};
