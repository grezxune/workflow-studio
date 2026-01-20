/**
 * Humanization Utilities
 *
 * Functions for adding human-like variation to timing and behavior
 */

/**
 * Generate a random delay within a range
 */
export function randomDelay(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

/**
 * Generate a delay with Gaussian distribution
 */
export function gaussianDelay(min, max) {
  const mean = (min + max) / 2;
  const stdDev = (max - min) / 6;

  let result;
  do {
    result = gaussianRandom(mean, stdDev);
  } while (result < min || result > max);

  return Math.round(result);
}

/**
 * Generate random number from Gaussian distribution
 */
export function gaussianRandom(mean, stdDev) {
  let u1 = Math.random();
  let u2 = Math.random();
  while (u1 === 0) u1 = Math.random();

  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

/**
 * Calculate typing delay between keystrokes
 */
export function typingDelay(baseMin = 50, baseMax = 150, burstMode = true) {
  let delay = gaussianDelay(baseMin, baseMax);

  if (burstMode) {
    if (Math.random() < 0.2) {
      delay += randomDelay(100, 300);
    }
    if (Math.random() < 0.1) {
      delay = Math.round(delay * 0.5);
    }
  }

  return delay;
}

/**
 * Generate delays for a typing sequence
 */
export function generateTypingDelays(text, baseMin = 50, baseMax = 150) {
  const delays = [];
  let burstRemaining = 0;

  for (let i = 0; i < text.length; i++) {
    let delay;

    if (burstRemaining > 0) {
      delay = gaussianDelay(baseMin * 0.4, baseMax * 0.5);
      burstRemaining--;
    } else if (Math.random() < 0.1) {
      burstRemaining = Math.floor(Math.random() * 5) + 3;
      delay = gaussianDelay(baseMin * 0.4, baseMax * 0.5);
    } else {
      delay = gaussianDelay(baseMin, baseMax);
    }

    const char = text[i];
    const nextChar = text[i + 1];

    if (['.', ',', '!', '?', ';', ':'].includes(char)) {
      delay += randomDelay(50, 200);
    }

    if (nextChar && nextChar === nextChar.toUpperCase() && /[A-Z]/.test(nextChar)) {
      delay += randomDelay(20, 100);
    }

    if (Math.random() < 0.05) {
      delay += randomDelay(200, 500);
    }

    delays.push(delay);
  }

  return delays;
}

/**
 * Should we perform an overshoot on this movement?
 */
export function shouldOvershoot(distance, frequency = 0.15) {
  const distanceFactor = Math.min(1, distance / 500);
  const adjustedFrequency = frequency * (0.5 + distanceFactor * 0.5);
  return Math.random() < adjustedFrequency;
}

/**
 * Calculate overshoot distance
 */
export function calculateOvershoot(distance, config = {}) {
  const minMult = config.distanceMultiplier?.min ?? 0.05;
  const maxMult = config.distanceMultiplier?.max ?? 0.15;
  const multiplier = minMult + Math.random() * (maxMult - minMult);
  return Math.round(distance * multiplier);
}

/**
 * Calculate correction movement speed
 */
export function correctionDuration(baseDuration, config = {}) {
  const minSpeed = config.correctionSpeed?.min ?? 0.3;
  const maxSpeed = config.correctionSpeed?.max ?? 0.6;
  const speedMultiplier = minSpeed + Math.random() * (maxSpeed - minSpeed);
  return Math.round(baseDuration / speedMultiplier);
}

/**
 * Get pause duration before correction
 */
export function pauseBeforeCorrection(config = {}) {
  const min = config.pauseBeforeCorrection?.min ?? 50;
  const max = config.pauseBeforeCorrection?.max ?? 150;
  return randomDelay(min, max);
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
