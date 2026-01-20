/**
 * Wind Mouse Algorithm
 *
 * Simulates natural human mouse movement using physics-inspired
 * "wind" and "gravity" forces. Produces realistic curved paths
 * with natural speed variation.
 */

class WindMouse {
  constructor(options = {}) {
    this.gravity = options.gravity ?? 9.0;
    this.wind = options.wind ?? 3.0;
    this.minWait = options.minWait ?? 2;
    this.maxWait = options.maxWait ?? 10;
    this.maxStep = options.maxStep ?? 10;
    this.targetArea = options.targetArea ?? 8;
  }

  /**
   * Generate a path from start to end using Wind Mouse algorithm
   * @param {number} startX - Starting X coordinate
   * @param {number} startY - Starting Y coordinate
   * @param {number} endX - Target X coordinate
   * @param {number} endY - Target Y coordinate
   * @returns {Array<{x: number, y: number, delay: number}>} Array of points with delays
   */
  generatePath(startX, startY, endX, endY) {
    const path = [];
    let currentX = startX;
    let currentY = startY;

    let windX = 0;
    let windY = 0;
    let velocityX = 0;
    let velocityY = 0;

    const distance = this.hypot(endX - startX, endY - startY);

    while (true) {
      const dist = this.hypot(endX - currentX, endY - currentY);

      if (dist < 1) {
        // Final position
        path.push({ x: Math.round(endX), y: Math.round(endY), delay: 0 });
        break;
      }

      // Wind effect (random lateral movement)
      const windMag = Math.min(this.wind, dist);
      if (dist >= this.targetArea) {
        windX = windX / Math.sqrt(3) + (Math.random() * 2 - 1) * windMag / Math.sqrt(5);
        windY = windY / Math.sqrt(3) + (Math.random() * 2 - 1) * windMag / Math.sqrt(5);
      } else {
        // Close to target - reduce wind, increase precision
        windX /= Math.sqrt(3);
        windY /= Math.sqrt(3);
        if (this.maxStep < 3) {
          this.maxStep = Math.random() * 3 + 3;
        } else {
          this.maxStep /= Math.sqrt(5);
        }
      }

      // Gravity effect (pull toward target)
      const gravityMag = Math.min(this.gravity, dist);
      velocityX += windX + gravityMag * (endX - currentX) / dist;
      velocityY += windY + gravityMag * (endY - currentY) / dist;

      // Limit velocity
      const velocityMag = this.hypot(velocityX, velocityY);
      if (velocityMag > this.maxStep) {
        const randomDist = this.maxStep / 2 + Math.random() * this.maxStep / 2;
        velocityX = velocityX / velocityMag * randomDist;
        velocityY = velocityY / velocityMag * randomDist;
      }

      // Apply velocity
      currentX += velocityX;
      currentY += velocityY;

      // Calculate delay based on distance moved and total distance
      const step = this.hypot(velocityX, velocityY);
      const delay = Math.round(
        this.minWait + Math.random() * (this.maxWait - this.minWait) * (step / this.maxStep)
      );

      path.push({
        x: Math.round(currentX),
        y: Math.round(currentY),
        delay
      });

      // Safety check to prevent infinite loops
      if (path.length > 10000) {
        path.push({ x: Math.round(endX), y: Math.round(endY), delay: 0 });
        break;
      }
    }

    return this.applySpeedCurve(path, distance);
  }

  /**
   * Apply acceleration/deceleration speed curve
   * Humans accelerate at start, maintain speed, then decelerate at end
   */
  applySpeedCurve(path, totalDistance) {
    const len = path.length;
    if (len < 3) return path;

    return path.map((point, i) => {
      const progress = i / len;
      let speedMultiplier;

      if (progress < 0.2) {
        // Acceleration phase - start slow
        speedMultiplier = 0.5 + progress * 2.5; // 0.5 to 1.0
      } else if (progress > 0.8) {
        // Deceleration phase - slow down
        speedMultiplier = 1.0 - (progress - 0.8) * 3; // 1.0 to 0.4
      } else {
        // Cruise phase
        speedMultiplier = 1.0;
      }

      // Apply multiplier to delay (inverse - higher multiplier = shorter delay)
      const adjustedDelay = Math.round(point.delay / Math.max(0.3, speedMultiplier));

      return { ...point, delay: adjustedDelay };
    });
  }

  /**
   * Calculate hypotenuse (distance)
   */
  hypot(x, y) {
    return Math.sqrt(x * x + y * y);
  }

  /**
   * Update algorithm parameters
   */
  setParams(options) {
    if (options.gravity !== undefined) this.gravity = options.gravity;
    if (options.wind !== undefined) this.wind = options.wind;
    if (options.minWait !== undefined) this.minWait = options.minWait;
    if (options.maxWait !== undefined) this.maxWait = options.maxWait;
    if (options.maxStep !== undefined) this.maxStep = options.maxStep;
    if (options.targetArea !== undefined) this.targetArea = options.targetArea;
  }
}

export default WindMouse;
