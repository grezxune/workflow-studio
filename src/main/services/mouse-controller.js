/**
 * Mouse Controller Service
 *
 * Handles all mouse operations with human-like behavior
 */

import { mouse, Point, Button } from '@nut-tree-fork/nut-js';
import WindMouse from '../lib/wind-mouse.js';
import ClickJitter from '../lib/click-jitter.js';
import {
  shouldOvershoot,
  calculateOvershoot,
  pauseBeforeCorrection,
  randomDelay,
  sleep
} from '../lib/humanize.js';
import { CLICK_BUTTONS, CLICK_TYPES, DEFAULT_SETTINGS } from '../../shared/constants.js';

class MouseController {
  constructor(settings = {}) {
    this.windMouse = new WindMouse(settings.windMouse || DEFAULT_SETTINGS.windMouse);
    this.clickJitter = new ClickJitter(settings.clickJitter || DEFAULT_SETTINGS.clickJitter);
    this.overshootConfig = settings.overshoot || DEFAULT_SETTINGS.overshoot;
    this.mouseMoveDuration = settings.mouseMoveDuration ?? DEFAULT_SETTINGS.mouseMoveDuration ?? 250;

    mouse.config.autoDelayMs = 0;
    mouse.config.mouseSpeed = 1000;
  }

  async moveTo(x, y, options = {}) {
    console.log(`[MouseController] moveTo(${x}, ${y})`);
    try {
      const currentPos = await mouse.getPosition();
      const startX = currentPos.x;
      const startY = currentPos.y;
      console.log(`[MouseController] Current position: (${startX}, ${startY})`);

      const distance = Math.hypot(x - startX, y - startY);
      console.log(`[MouseController] Distance: ${distance.toFixed(1)}px`);

      if (this.overshootConfig.enabled && shouldOvershoot(distance, this.overshootConfig.frequency)) {
        await this.moveWithOvershoot(startX, startY, x, y, options);
      } else {
        await this.moveDirectly(startX, startY, x, y, options);
      }
      console.log('[MouseController] Move complete');
    } catch (error) {
      console.error('[MouseController] moveTo error:', error);
      throw error;
    }
  }

  /**
   * Clamp a point to stay within bounds { left, top, right, bottom }
   */
  clampToBounds(x, y, bounds) {
    if (!bounds) return { x, y };
    return {
      x: Math.round(Math.max(bounds.left, Math.min(bounds.right, x))),
      y: Math.round(Math.max(bounds.top, Math.min(bounds.bottom, y)))
    };
  }

  async moveDirectly(startX, startY, endX, endY, options = {}) {
    const targetDuration = options.duration ?? this.mouseMoveDuration;
    console.log(`[MouseController] moveDirectly from (${startX}, ${startY}) to (${endX}, ${endY}), targetDuration=${targetDuration}ms, mouseMoveDuration=${this.mouseMoveDuration}ms`);
    try {
      const startTime = Date.now();
      let path = this.windMouse.generatePath(startX, startY, endX, endY);
      console.log(`[MouseController] Generated path: ${path.length} points`);

      // Estimate ~3ms overhead per setPosition call
      const SET_POS_OVERHEAD_MS = 3;
      const overheadTotal = path.length * SET_POS_OVERHEAD_MS;

      // If overhead alone would exceed target duration, subsample the path
      if (overheadTotal > targetDuration * 0.8 && path.length > 5) {
        const maxPoints = Math.max(5, Math.floor(targetDuration * 0.6 / SET_POS_OVERHEAD_MS));
        path = this.subsamplePath(path, maxPoints);
        console.log(`[MouseController] Subsampled to ${path.length} points (overhead budget: ${targetDuration * 0.8}ms)`);
      }

      // Scale delays: subtract estimated overhead from target so total time is correct
      const estimatedOverhead = path.length * SET_POS_OVERHEAD_MS;
      const sleepBudget = Math.max(0, targetDuration - estimatedOverhead);
      const scaledPath = this.scalePathDuration(path, sleepBudget);

      for (const point of scaledPath) {
        await mouse.setPosition(new Point(point.x, point.y));
        if (point.delay > 0) {
          await sleep(point.delay);
        }
      }
      const elapsed = Date.now() - startTime;
      console.log(`[MouseController] moveDirectly complete in ${elapsed}ms (target was ${targetDuration}ms)`);
    } catch (error) {
      console.error('[MouseController] moveDirectly error:', error);
      throw error;
    }
  }

  /**
   * Subsample a path to a maximum number of points while keeping start and end
   */
  subsamplePath(path, maxPoints) {
    if (path.length <= maxPoints) return path;
    const result = [];
    const step = (path.length - 1) / (maxPoints - 1);
    for (let i = 0; i < maxPoints - 1; i++) {
      result.push(path[Math.round(i * step)]);
    }
    result.push(path[path.length - 1]); // always include final point
    return result;
  }

  /**
   * Scale path delays to achieve a target total duration
   */
  scalePathDuration(path, targetDuration) {
    if (targetDuration <= 0 || path.length === 0) {
      // Instant movement - no delays
      return path.map(p => ({ ...p, delay: 0 }));
    }

    const currentTotal = path.reduce((sum, p) => sum + p.delay, 0);
    if (currentTotal === 0) {
      // Distribute duration evenly if no existing delays
      const delayPerPoint = Math.round(targetDuration / path.length);
      return path.map(p => ({ ...p, delay: delayPerPoint }));
    }

    const scale = targetDuration / currentTotal;
    return path.map(p => ({ ...p, delay: Math.round(p.delay * scale) }));
  }

  async moveWithOvershoot(startX, startY, endX, endY, options = {}) {
    const distance = Math.hypot(endX - startX, endY - startY);
    const overshootDist = calculateOvershoot(distance, this.overshootConfig);
    const bounds = options.bounds;

    const angle = Math.atan2(endY - startY, endX - startX);
    let overshootX = Math.round(endX + Math.cos(angle) * overshootDist);
    let overshootY = Math.round(endY + Math.sin(angle) * overshootDist);

    // Clamp overshoot point to bounds if provided
    if (bounds) {
      const clamped = this.clampToBounds(overshootX, overshootY, bounds);
      overshootX = clamped.x;
      overshootY = clamped.y;
    }

    // Use 80% of duration for main movement, 20% for correction
    const mainDuration = Math.round((options.duration ?? this.mouseMoveDuration) * 0.8);
    const correctionDuration = Math.round((options.duration ?? this.mouseMoveDuration) * 0.2);

    await this.moveDirectly(startX, startY, overshootX, overshootY, { ...options, duration: mainDuration });

    const pauseMs = pauseBeforeCorrection(this.overshootConfig);
    await sleep(pauseMs);

    let correctionPath = this.windMouse.generatePath(overshootX, overshootY, endX, endY);

    // Apply same overhead-aware logic as moveDirectly
    const SET_POS_OVERHEAD_MS = 3;
    const corrOverhead = correctionPath.length * SET_POS_OVERHEAD_MS;
    if (corrOverhead > correctionDuration * 0.8 && correctionPath.length > 5) {
      const maxPts = Math.max(5, Math.floor(correctionDuration * 0.6 / SET_POS_OVERHEAD_MS));
      correctionPath = this.subsamplePath(correctionPath, maxPts);
    }
    const corrSleepBudget = Math.max(0, correctionDuration - correctionPath.length * SET_POS_OVERHEAD_MS);
    const scaledCorrectionPath = this.scalePathDuration(correctionPath, corrSleepBudget);

    for (const point of scaledCorrectionPath) {
      let px = point.x, py = point.y;
      if (bounds) {
        const clamped = this.clampToBounds(px, py, bounds);
        px = clamped.x;
        py = clamped.y;
      }
      await mouse.setPosition(new Point(px, py));
      if (point.delay > 0) {
        await sleep(point.delay);
      }
    }
  }

  async click(options = {}) {
    const {
      button = CLICK_BUTTONS.LEFT,
      clickType = CLICK_TYPES.SINGLE,
      position = null,
      jitter = true
    } = options;

    if (position) {
      let targetX = position.x;
      let targetY = position.y;

      if (jitter && this.clickJitter.enabled) {
        const jittered = this.clickJitter.apply(targetX, targetY);
        targetX = jittered.x;
        targetY = jittered.y;
      }

      await this.moveTo(targetX, targetY);
    } else if (jitter && this.clickJitter.enabled) {
      const currentPos = await mouse.getPosition();
      const jittered = this.clickJitter.apply(currentPos.x, currentPos.y);
      await mouse.setPosition(new Point(jittered.x, jittered.y));
    }

    const nutButton = this.getNutButton(button);

    if (clickType === CLICK_TYPES.SINGLE) {
      await mouse.click(nutButton);
    } else if (clickType === CLICK_TYPES.DOUBLE) {
      await mouse.doubleClick(nutButton);
    } else if (typeof clickType === 'object' && clickType.hold) {
      const holdDuration = randomDelay(clickType.hold.min, clickType.hold.max);
      await mouse.pressButton(nutButton);
      await sleep(holdDuration);
      await mouse.releaseButton(nutButton);
    }
  }

  async pressButton(button = CLICK_BUTTONS.LEFT) {
    const nutButton = this.getNutButton(button);
    await mouse.pressButton(nutButton);
  }

  async releaseButton(button = CLICK_BUTTONS.LEFT) {
    const nutButton = this.getNutButton(button);
    await mouse.releaseButton(nutButton);
  }

  async scroll(amount, direction = 'down') {
    if (direction === 'down') {
      await mouse.scrollDown(amount);
    } else {
      await mouse.scrollUp(amount);
    }
  }

  async getPosition() {
    const pos = await mouse.getPosition();
    return { x: pos.x, y: pos.y };
  }

  getNutButton(button) {
    switch (button) {
      case CLICK_BUTTONS.RIGHT:
        return Button.RIGHT;
      case CLICK_BUTTONS.MIDDLE:
        return Button.MIDDLE;
      case CLICK_BUTTONS.LEFT:
      default:
        return Button.LEFT;
    }
  }

  updateSettings(settings) {
    if (settings.mouseMoveDuration !== undefined) {
      console.log(`[MouseController] updateSettings: mouseMoveDuration ${this.mouseMoveDuration}ms → ${settings.mouseMoveDuration}ms`);
      this.mouseMoveDuration = settings.mouseMoveDuration;
    }
    if (settings.windMouse) {
      this.windMouse.setParams(settings.windMouse);
    }
    if (settings.clickJitter) {
      this.clickJitter.setConfig(settings.clickJitter);
    }
    if (settings.overshoot) {
      this.overshootConfig = { ...this.overshootConfig, ...settings.overshoot };
    }
  }

  async emergencyStop() {
    try {
      await mouse.releaseButton(Button.LEFT);
      await mouse.releaseButton(Button.RIGHT);
      await mouse.releaseButton(Button.MIDDLE);
    } catch (err) {
      console.error('Error during emergency stop:', err);
    }
  }
}

let instance = null;

export function getMouseController(settings) {
  if (!instance) {
    instance = new MouseController(settings);
  }
  return instance;
}

export { MouseController };
