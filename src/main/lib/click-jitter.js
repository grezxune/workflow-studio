/**
 * Click Jitter System
 *
 * Adds human-like imprecision to click locations.
 */

import { JITTER_DISTRIBUTIONS } from '../../shared/constants.js';

export default class ClickJitter {
  constructor(options = {}) {
    this.enabled = options.enabled ?? true;
    this.radius = options.radius ?? 3;
    this.distribution = options.distribution ?? JITTER_DISTRIBUTIONS.GAUSSIAN;
    this.sigma = options.sigma ?? this.radius / 3;
  }

  /**
   * Apply jitter to a click position
   */
  apply(x, y) {
    if (!this.enabled) {
      return { x: Math.round(x), y: Math.round(y) };
    }

    let offsetX, offsetY;

    if (this.distribution === JITTER_DISTRIBUTIONS.GAUSSIAN) {
      offsetX = this.gaussianRandom(0, this.sigma);
      offsetY = this.gaussianRandom(0, this.sigma);

      const dist = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
      if (dist > this.radius) {
        const scale = this.radius / dist;
        offsetX *= scale;
        offsetY *= scale;
      }
    } else {
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * this.radius;
      offsetX = Math.cos(angle) * distance;
      offsetY = Math.sin(angle) * distance;
    }

    return {
      x: Math.round(x + offsetX),
      y: Math.round(y + offsetY)
    };
  }

  /**
   * Generate a random number from Gaussian distribution
   */
  gaussianRandom(mean, stdDev) {
    let u1 = Math.random();
    let u2 = Math.random();
    while (u1 === 0) u1 = Math.random();

    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  /**
   * Update jitter settings
   */
  setConfig(options) {
    if (options.enabled !== undefined) this.enabled = options.enabled;
    if (options.radius !== undefined) {
      this.radius = options.radius;
      this.sigma = options.sigma ?? this.radius / 3;
    }
    if (options.distribution !== undefined) this.distribution = options.distribution;
    if (options.sigma !== undefined) this.sigma = options.sigma;
  }
}
