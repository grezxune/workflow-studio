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

    mouse.config.autoDelayMs = 0;
    mouse.config.mouseSpeed = 1000;
  }

  async moveTo(x, y, options = {}) {
    const currentPos = await mouse.getPosition();
    const startX = currentPos.x;
    const startY = currentPos.y;

    const distance = Math.hypot(x - startX, y - startY);

    if (this.overshootConfig.enabled && shouldOvershoot(distance, this.overshootConfig.frequency)) {
      await this.moveWithOvershoot(startX, startY, x, y, options);
    } else {
      await this.moveDirectly(startX, startY, x, y, options);
    }
  }

  async moveDirectly(startX, startY, endX, endY, options = {}) {
    const path = this.windMouse.generatePath(startX, startY, endX, endY);

    for (const point of path) {
      await mouse.setPosition(new Point(point.x, point.y));
      if (point.delay > 0) {
        await sleep(point.delay);
      }
    }
  }

  async moveWithOvershoot(startX, startY, endX, endY, options = {}) {
    const distance = Math.hypot(endX - startX, endY - startY);
    const overshootDist = calculateOvershoot(distance, this.overshootConfig);

    const angle = Math.atan2(endY - startY, endX - startX);
    const overshootX = Math.round(endX + Math.cos(angle) * overshootDist);
    const overshootY = Math.round(endY + Math.sin(angle) * overshootDist);

    await this.moveDirectly(startX, startY, overshootX, overshootY, options);

    const pauseMs = pauseBeforeCorrection(this.overshootConfig);
    await sleep(pauseMs);

    const correctionPath = this.windMouse.generatePath(overshootX, overshootY, endX, endY);
    const slowedPath = correctionPath.map(point => ({
      ...point,
      delay: Math.round(point.delay * 1.5)
    }));

    for (const point of slowedPath) {
      await mouse.setPosition(new Point(point.x, point.y));
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
