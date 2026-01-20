/**
 * Detection Service
 *
 * Handles image, pixel, and color detection
 */

import { screen, Region } from '@nut-tree-fork/nut-js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getStorageService } from './storage.js';
import { DETECTION_METHODS } from '../../shared/constants.js';

class DetectionService {
  constructor(options = {}) {
    this.defaultConfidence = options.confidence || 0.9;
    this.defaultMethod = options.method || DETECTION_METHODS.TEMPLATE;
    this.storage = null;

    screen.config.confidence = this.defaultConfidence;
    screen.config.autoHighlight = false;
  }

  getStorage() {
    if (!this.storage) {
      this.storage = getStorageService();
    }
    return this.storage;
  }

  async findImage(imageId, options = {}) {
    const imagePath = this.getStorage().getImagePath(imageId);

    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image not found: ${imageId}`);
    }

    const confidence = options.confidence || this.defaultConfidence;
    const region = options.region;

    try {
      screen.config.confidence = confidence;

      let searchRegion = null;
      if (region) {
        searchRegion = new Region(region.x, region.y, region.width, region.height);
      }

      const found = searchRegion
        ? await screen.find(imagePath, { searchRegion })
        : await screen.find(imagePath);

      if (found) {
        return {
          x: Math.round(found.left + found.width / 2),
          y: Math.round(found.top + found.height / 2),
          width: found.width,
          height: found.height,
          confidence: confidence,
          bounds: {
            left: found.left,
            top: found.top,
            right: found.left + found.width,
            bottom: found.top + found.height
          }
        };
      }

      return null;
    } catch (error) {
      if (error.message.includes('No match')) {
        return null;
      }
      throw error;
    }
  }

  async findPixel(color, options = {}) {
    const tolerance = options.tolerance || 10;
    const region = options.region;

    try {
      const capture = region
        ? await screen.grabRegion(new Region(region.x, region.y, region.width, region.height))
        : await screen.grab();

      const pixelData = await capture.toRGB();
      const width = capture.width;
      const height = capture.height;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 3;
          const r = pixelData.data[idx];
          const g = pixelData.data[idx + 1];
          const b = pixelData.data[idx + 2];

          if (this.colorMatch(r, g, b, color, tolerance)) {
            const resultX = region ? region.x + x : x;
            const resultY = region ? region.y + y : y;

            return { x: resultX, y: resultY, color: { r, g, b } };
          }
        }
      }

      return null;
    } catch (error) {
      console.error('findPixel error:', error);
      return null;
    }
  }

  async getPixelColor(x, y) {
    try {
      const region = new Region(x, y, 1, 1);
      const capture = await screen.grabRegion(region);
      const pixelData = await capture.toRGB();

      return {
        r: pixelData.data[0],
        g: pixelData.data[1],
        b: pixelData.data[2]
      };
    } catch (error) {
      console.error('getPixelColor error:', error);
      return null;
    }
  }

  colorMatch(r1, g1, b1, targetColor, tolerance) {
    return (
      Math.abs(r1 - targetColor.r) <= tolerance &&
      Math.abs(g1 - targetColor.g) <= tolerance &&
      Math.abs(b1 - targetColor.b) <= tolerance
    );
  }

  async captureScreen(region = null, saveAs = null) {
    try {
      const capture = region
        ? await screen.grabRegion(new Region(region.x, region.y, region.width, region.height))
        : await screen.grab();

      if (saveAs) {
        const savePath = saveAs.endsWith('.png') ? saveAs : `${saveAs}.png`;
        await capture.toFile(savePath);
        return savePath;
      }

      const tempPath = path.join(os.tmpdir(), `workflow-studio-capture-${Date.now()}.png`);
      await capture.toFile(tempPath);
      return tempPath;
    } catch (error) {
      console.error('captureScreen error:', error);
      throw error;
    }
  }

  async captureTemplate(region, name) {
    const id = name || `template-${Date.now()}`;
    const imagePath = this.getStorage().getImagePath(id);

    await this.captureScreen(region, imagePath);

    return { id, path: imagePath, region };
  }

  async getScreenSize() {
    const width = await screen.width();
    const height = await screen.height();
    return { width, height };
  }

  async waitForImage(imageId, options = {}) {
    const timeout = options.timeout || 30000;
    const interval = options.interval || 500;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = await this.findImage(imageId, options);
      if (result) {
        return result;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    return null;
  }

  async waitForImageGone(imageId, options = {}) {
    const timeout = options.timeout || 30000;
    const interval = options.interval || 500;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = await this.findImage(imageId, options);
      if (!result) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    return false;
  }

  updateSettings(settings) {
    if (settings.confidence !== undefined) {
      this.defaultConfidence = settings.confidence;
      screen.config.confidence = settings.confidence;
    }
    if (settings.method !== undefined) {
      this.defaultMethod = settings.method;
    }
  }
}

let instance = null;

export function getDetectionService(options) {
  if (!instance) {
    instance = new DetectionService(options);
  }
  return instance;
}

export { DetectionService };
