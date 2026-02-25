/**
 * Workflow Executor Service
 *
 * Orchestrates the execution of workflows
 */

import { EventEmitter } from 'events';
import { getMouseController } from './mouse-controller.js';
import { getKeyboardController } from './keyboard-controller.js';
import { sleep, randomDelay } from '../lib/humanize.js';
import { ACTION_TYPES, EXECUTION_STATES } from '../../shared/constants.js';
import { hasAccessibilityPermission, requestAccessibilityPermission } from '../lib/permissions.js';

class WorkflowExecutor extends EventEmitter {
  constructor(options = {}) {
    super();

    this.mouseController = getMouseController(options.mouse);
    this.keyboardController = getKeyboardController(options.keyboard);
    this.detectionService = options.detectionService || null;

    this.state = EXECUTION_STATES.IDLE;
    this.currentWorkflow = null;
    this.currentActionIndex = 0;
    this.currentLoop = 0;
    this.isPaused = false;
    this.shouldStop = false;
    this.dryRun = false;
    this.lastDetection = null;
    this.clickAnchors = new Map();
  }

  async execute(workflow, options = {}) {
    console.log('[Executor] execute() called with options:', JSON.stringify(options));

    if (this.state === EXECUTION_STATES.RUNNING) {
      throw new Error('Another workflow is already running');
    }

    // Check for accessibility permissions on macOS
    if (process.platform === 'darwin' && !options.dryRun) {
      if (!hasAccessibilityPermission()) {
        console.log('[Executor] Accessibility permission not granted, requesting...');
        requestAccessibilityPermission();
        throw new Error('Accessibility permission required. Please grant access in System Preferences > Security & Privacy > Privacy > Accessibility, then try again.');
      }
      console.log('[Executor] Accessibility permission granted');
    }

    this.currentWorkflow = workflow;
    this.currentLoop = 0;
    this.currentActionIndex = 0;
    this.isPaused = false;
    this.shouldStop = false;
    this.dryRun = options.dryRun || false;
    this.clickAnchors.clear();

    console.log(`[Executor] Starting workflow: ${workflow.name}`);
    console.log(`[Executor] Actions: ${workflow.actions?.length || 0}, Loops: ${workflow.loopCount || 1}, DryRun: ${this.dryRun}`);

    const totalLoops = workflow.loopCount || 1;

    this.setState(EXECUTION_STATES.RUNNING);
    this.emit('workflow:start', { workflow, totalLoops });

    try {
      for (let loop = 0; loop < totalLoops && !this.shouldStop; loop++) {
        this.currentLoop = loop + 1;
        this.emit('loop:start', { loop: loop + 1, total: totalLoops });

        await this.executeActions(workflow.actions);

        if (loop < totalLoops - 1 && !this.shouldStop) {
          const loopDelay = workflow.loopDelay || { min: 500, max: 1000 };
          const delay = randomDelay(loopDelay.min, loopDelay.max);
          this.emit('loop:delay', { delay });
          await sleep(delay);
        }

        this.emit('loop:end', { loop: loop + 1, total: totalLoops });
      }

      if (this.shouldStop) {
        this.setState(EXECUTION_STATES.STOPPED);
        this.emit('workflow:stopped', { workflow });
      } else {
        this.setState(EXECUTION_STATES.COMPLETED);
        this.emit('workflow:complete', { workflow });
      }
    } catch (error) {
      this.setState(EXECUTION_STATES.ERROR);
      this.emit('workflow:error', { workflow, error });
      throw error;
    } finally {
      this.currentWorkflow = null;
    }
  }

  async executeActions(actions) {
    console.log(`[Executor] Executing ${actions.length} actions`);
    for (let i = 0; i < actions.length && !this.shouldStop; i++) {
      this.currentActionIndex = i;

      while (this.isPaused && !this.shouldStop) {
        await sleep(100);
      }

      if (this.shouldStop) break;

      const action = actions[i];
      console.log(`[Executor] Action ${i + 1}/${actions.length}: ${action.type}`);
      await this.executeAction(action, i, actions.length);
    }
    console.log('[Executor] All actions completed');
  }

  async executeAction(action, index, total) {
    this.emit('action:start', { action, index, total });

    try {
      if (action.condition && !await this.evaluateCondition(action.condition)) {
        this.emit('action:skipped', { action, index, reason: 'condition_not_met' });
        return;
      }

      console.log(`[Executor] dryRun check: ${this.dryRun} (type: ${typeof this.dryRun})`);
      if (this.dryRun === true) {
        console.log('[Executor] Dry run mode - skipping actual execution');
        this.emit('action:dryrun', { action, index });
        await sleep(100);
      } else {
        await this.performAction(action);
      }

      if (action.delay) {
        const delay = randomDelay(action.delay.min, action.delay.max);
        await sleep(delay);
      }

      this.emit('action:complete', { action, index, total });
    } catch (error) {
      console.error(`[Executor] Action ${index + 1} (${action.type}) error:`, error.message);
      console.error('[Executor] Full error:', error);
      this.emit('action:error', { action, index, error });

      if (action.continueOnError) {
        console.log('[Executor] Continuing despite error (continueOnError=true)');
        return;
      }
      throw error;
    }
  }

  async performAction(action) {
    console.log(`[Executor] Performing action: ${action.type}`, action);
    switch (action.type) {
      case ACTION_TYPES.MOUSE_MOVE:
        await this.performMouseMove(action);
        break;

      case ACTION_TYPES.MOUSE_CLICK:
        await this.performMouseClick(action);
        break;

      case ACTION_TYPES.KEYBOARD:
        await this.performKeyboard(action);
        break;

      case ACTION_TYPES.WAIT:
        await this.performWait(action);
        break;

      case ACTION_TYPES.CONDITIONAL:
        await this.performConditional(action);
        break;

      case ACTION_TYPES.LOOP:
        await this.performLoop(action);
        break;

      case ACTION_TYPES.IMAGE_DETECT:
        await this.performImageDetect(action);
        break;

      case ACTION_TYPES.PIXEL_DETECT:
        await this.performPixelDetect(action);
        break;

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  async performMouseMove(action) {
    let targetX = action.x;
    let targetY = action.y;
    let imageBounds = null;

    // Bounding box mode: pick a random point within the bounds
    if (action.moveMode === 'bounds' && action.bounds) {
      const b = action.bounds;
      targetX = Math.round(b.x + Math.random() * b.width);
      targetY = Math.round(b.y + Math.random() * b.height);
      console.log(`[Executor] Bounds (${b.x}, ${b.y}, ${b.width}x${b.height}) → random point (${targetX}, ${targetY})`);
    }

    // Image mode: find image on screen and pick a random point within it
    if (action.moveMode === 'image' && action.imageId) {
      if (!this.detectionService) {
        throw new Error('Detection service not available');
      }

      const result = await this.detectionService.findImage(action.imageId, {
        confidence: action.imageConfidence || 0.9,
        region: action.searchRegion,
        scaleDown: action.scaleDown || false
      });

      if (result) {
        this.lastDetection = result;
        imageBounds = result.bounds;
        const b = result.bounds;
        targetX = Math.round(b.left + Math.random() * (b.right - b.left));
        targetY = Math.round(b.top + Math.random() * (b.bottom - b.top));
        console.log(`[Executor] Image "${action.imageId}" found at (${b.left}, ${b.top}) ${result.width}×${result.height} → random point (${targetX}, ${targetY})`);
      } else {
        console.log(`[Executor] Image "${action.imageId}" not found`);
        if (action.failOnNotFound) {
          throw new Error(`Image not found: ${action.imageId}`);
        }
        return;
      }
    }

    if (action.relativeToDetection && this.lastDetection) {
      targetX = this.lastDetection.x + (action.offsetX || 0);
      targetY = this.lastDetection.y + (action.offsetY || 0);
    }

    console.log(`[Executor] Mouse move to (${targetX}, ${targetY})${action.duration !== undefined ? ` with duration ${action.duration}ms` : ''}`);
    await this.mouseController.moveTo(targetX, targetY, { duration: action.duration, bounds: imageBounds });
    console.log('[Executor] Mouse move complete');
  }

  async performMouseClick(action) {
    const options = {
      button: action.button || 'left',
      clickType: action.clickType || 'single',
      jitter: action.jitter !== false,
      duration: action.duration
    };

    if (action.x !== undefined && action.y !== undefined) {
      options.position = { x: action.x, y: action.y };
    } else if (action.relativeToDetection && this.lastDetection) {
      options.position = {
        x: this.lastDetection.x + (action.offsetX || 0),
        y: this.lastDetection.y + (action.offsetY || 0)
      };
    } else {
      // No explicit position — anchor to cursor position at first execution
      // so jitter doesn't drift across loop iterations
      const anchorKey = this.currentActionIndex;
      if (!this.clickAnchors.has(anchorKey)) {
        const pos = await this.mouseController.getPosition();
        this.clickAnchors.set(anchorKey, { x: pos.x, y: pos.y });
      }
      options.position = { ...this.clickAnchors.get(anchorKey) };
    }

    await this.mouseController.click(options);
  }

  async performKeyboard(action) {
    if (action.mode === 'type') {
      await this.keyboardController.type(action.text, { speed: action.speed });
    } else if (action.mode === 'press') {
      await this.keyboardController.press(action.key);
    } else if (action.mode === 'hold') {
      await this.keyboardController.pressKey(action.key);
    } else if (action.mode === 'release') {
      await this.keyboardController.releaseKey(action.key);
    } else if (action.mode === 'hold_and_act') {
      console.log(`[Executor] Hold key "${action.key}" and execute ${action.actions?.length || 0} sub-actions`);
      await this.keyboardController.pressKey(action.key);
      try {
        if (action.actions && action.actions.length > 0) {
          await this.executeActions(action.actions);
        }
      } finally {
        await this.keyboardController.releaseKey(action.key);
        console.log(`[Executor] Released key "${action.key}"`);
      }
    }
  }

  async performWait(action) {
    if (action.duration) {
      const duration = typeof action.duration === 'object'
        ? randomDelay(action.duration.min, action.duration.max)
        : action.duration;
      console.log(`[Executor] Waiting for ${duration}ms`);

      this.emit('wait:start', { duration, action });

      let elapsed = 0;
      let lastTick = Date.now();
      const tickInterval = 50;
      while (true) {
        if (this.shouldStop) break;

        // If paused, freeze the countdown
        if (this.isPaused) {
          this.emit('wait:tick', { duration, remaining: Math.max(0, duration - elapsed), elapsed, paused: true });
          while (this.isPaused && !this.shouldStop) {
            await sleep(100);
          }
          lastTick = Date.now(); // reset tick clock after unpause
          if (this.shouldStop) break;
        }

        const now = Date.now();
        elapsed += now - lastTick;
        lastTick = now;
        const remaining = Math.max(0, duration - elapsed);
        this.emit('wait:tick', { duration, remaining, elapsed, paused: false });
        if (remaining <= 0) break;
        await sleep(Math.min(tickInterval, remaining));
      }

      this.emit('wait:tick', { duration, remaining: 0, elapsed: duration, paused: false });
      console.log('[Executor] Wait complete');
    } else if (action.waitFor === 'image' && this.detectionService) {
      await this.waitForImage(action);
    } else if (action.waitFor === 'pixel' && this.detectionService) {
      await this.waitForPixel(action);
    }
  }

  async performConditional(action) {
    const conditionMet = await this.evaluateCondition(action.condition);

    if (conditionMet && action.thenActions) {
      await this.executeActions(action.thenActions);
    } else if (!conditionMet && action.elseActions) {
      await this.executeActions(action.elseActions);
    }
  }

  async performLoop(action) {
    const infinite = action.infinite === true;
    const iterations = infinite ? Infinity : (action.count || 1);

    for (let i = 0; i < iterations && !this.shouldStop; i++) {
      this.emit('subloop:iteration', { index: i, total: infinite ? '∞' : iterations });
      await this.executeActions(action.actions);

      if (action.delay && !this.shouldStop) {
        const delay = randomDelay(action.delay.min, action.delay.max);
        await sleep(delay);
      }
    }
  }

  async performImageDetect(action) {
    if (!this.detectionService) {
      throw new Error('Detection service not available');
    }

    const pollInterval = action.pollInterval || 500;

    while (true) {
      const result = await this.detectionService.findImage(action.imageId, {
        confidence: action.confidence || 0.9,
        region: action.searchRegion || action.region,
        scaleDown: action.scaleDown || false
      });

      if (result) {
        this.lastDetection = result;
        this.emit('detection:found', { type: 'image', result });
        return;
      }

      // Image not found
      if (!action.waitUntilFound) {
        this.emit('detection:notfound', { type: 'image' });
        if (action.failOnNotFound) {
          throw new Error('Image not found');
        }
        return;
      }

      // Wait until found mode — keep polling
      console.log(`[Executor] Image "${action.imageId}" not found, retrying in ${pollInterval}ms...`);
      this.emit('detection:notfound', { type: 'image', waiting: true });

      // Respect pause
      while (this.isPaused && !this.shouldStop) {
        await sleep(100);
      }

      if (this.shouldStop) {
        console.log('[Executor] Stop requested during wait-until-found');
        return;
      }

      await new Promise(r => setTimeout(r, pollInterval));

      if (this.shouldStop) {
        console.log('[Executor] Stop requested during wait-until-found');
        return;
      }
    }
  }

  async performPixelDetect(action) {
    if (!this.detectionService) {
      throw new Error('Detection service not available');
    }

    const result = await this.detectionService.findPixel(action.color, {
      tolerance: action.tolerance || 10,
      region: action.region
    });

    if (result) {
      this.lastDetection = result;
      this.emit('detection:found', { type: 'pixel', result });
    } else {
      this.emit('detection:notfound', { type: 'pixel' });
      if (action.failOnNotFound) {
        throw new Error('Pixel not found');
      }
    }
  }

  async waitForImage(action) {
    const timeout = action.timeout || 30000;
    const interval = action.interval || 500;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout && !this.shouldStop) {
      const result = await this.detectionService.findImage(action.imageId, {
        confidence: action.confidence || 0.9,
        region: action.region
      });

      if (result) {
        this.lastDetection = result;
        return true;
      }

      await sleep(interval);
    }

    if (action.failOnTimeout) {
      throw new Error('Timeout waiting for image');
    }
    return false;
  }

  async waitForPixel(action) {
    const timeout = action.timeout || 30000;
    const interval = action.interval || 500;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout && !this.shouldStop) {
      const result = await this.detectionService.findPixel(action.color, {
        tolerance: action.tolerance || 10,
        region: action.region
      });

      if (result) {
        this.lastDetection = result;
        return true;
      }

      await sleep(interval);
    }

    if (action.failOnTimeout) {
      throw new Error('Timeout waiting for pixel');
    }
    return false;
  }

  async evaluateCondition(condition) {
    if (!condition) return true;

    switch (condition.type) {
      case 'image_present':
        if (!this.detectionService) return false;
        return !!(await this.detectionService.findImage(condition.imageId, {
          confidence: condition.confidence || 0.9
        }));

      case 'image_absent':
        if (!this.detectionService) return true;
        return !(await this.detectionService.findImage(condition.imageId, {
          confidence: condition.confidence || 0.9
        }));

      case 'pixel_match':
        if (!this.detectionService) return false;
        return !!(await this.detectionService.findPixel(condition.color, {
          tolerance: condition.tolerance || 10
        }));

      case 'loop_count':
        return this.currentLoop < (condition.maxLoops || Infinity);

      default:
        return true;
    }
  }

  setState(state) {
    this.state = state;
    this.emit('state:change', { state });
  }

  pause() {
    if (this.state === EXECUTION_STATES.RUNNING) {
      this.isPaused = true;
      this.setState(EXECUTION_STATES.PAUSED);
      this.emit('workflow:paused');
    }
  }

  resume() {
    if (this.state === EXECUTION_STATES.PAUSED) {
      this.isPaused = false;
      // Clear click anchors so cursor position is re-captured after user may have moved it
      this.clickAnchors.clear();
      this.setState(EXECUTION_STATES.RUNNING);
      this.emit('workflow:resumed');
    }
  }

  stop() {
    this.shouldStop = true;
    this.isPaused = false;
    this.emit('workflow:stopping');
  }

  async emergencyStop() {
    this.stop();
    await Promise.all([
      this.mouseController.emergencyStop(),
      this.keyboardController.emergencyStop()
    ]);
    this.emit('workflow:emergency_stop');
  }

  getStatus() {
    return {
      state: this.state,
      workflow: this.currentWorkflow?.name || null,
      currentLoop: this.currentLoop,
      currentAction: this.currentActionIndex,
      totalActions: this.currentWorkflow?.actions?.length || 0,
      isPaused: this.isPaused,
      dryRun: this.dryRun
    };
  }
}

let instance = null;

export function getWorkflowExecutor(options) {
  if (!instance) {
    instance = new WorkflowExecutor(options);
  }
  return instance;
}

export { WorkflowExecutor };
