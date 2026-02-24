/**
 * Detection Service
 *
 * Handles image, pixel, and color detection
 */

import { screen, Region, saveImage } from '@nut-tree-fork/nut-js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';
import { getStorageService } from './storage.js';
import { DETECTION_METHODS } from '../../shared/constants.js';

const require = createRequire(import.meta.url);
const { cv } = require('opencv-wasm');
const Jimp = require('jimp');

class DetectionService {
  constructor(options = {}) {
    this.defaultConfidence = options.confidence || 0.9;
    this.defaultMethod = options.method || DETECTION_METHODS.TEMPLATE;
    this.storage = null;
    this.templateCache = new Map(); // imageId -> { mtime, mat, width, height }

    screen.config.confidence = this.defaultConfidence;
    screen.config.autoHighlight = false;
  }

  getStorage() {
    if (!this.storage) {
      this.storage = getStorageService();
    }
    return this.storage;
  }

  /**
   * Get a cached OpenCV matrix for a template image.
   * Reloads from disk only if the file has been modified.
   */
  getTemplateMat(imagePath, imageId) {
    const stat = fs.statSync(imagePath);
    const mtime = stat.mtimeMs;
    const cached = this.templateCache.get(imageId);

    if (cached && cached.mtime === mtime) {
      return { mat: cached.mat, width: cached.width, height: cached.height };
    }

    // Evict old cache entry
    if (cached) {
      try { cached.mat.delete(); } catch (e) { /* ignore */ }
    }

    // Load with Jimp and convert to OpenCV mat
    const img = Jimp.readSync ? Jimp.readSync(imagePath) : null;
    if (!img) {
      // Fallback: synchronous read via buffer
      const buf = fs.readFileSync(imagePath);
      return this._loadTemplateAsync(imagePath, imageId, mtime);
    }

    const mat = cv.matFromImageData(img.bitmap);
    this.templateCache.set(imageId, { mtime, mat, width: img.bitmap.width, height: img.bitmap.height });
    return { mat, width: img.bitmap.width, height: img.bitmap.height };
  }

  async _loadTemplateAsync(imagePath, imageId, mtime) {
    const img = await Jimp.read(imagePath);
    const mat = cv.matFromImageData(img.bitmap);

    // Evict old entry if exists
    const cached = this.templateCache.get(imageId);
    if (cached) {
      try { cached.mat.delete(); } catch (e) { /* ignore */ }
    }

    this.templateCache.set(imageId, { mtime, mat, width: img.bitmap.width, height: img.bitmap.height });
    return { mat, width: img.bitmap.width, height: img.bitmap.height };
  }

  /**
   * Convert a nut-js screen capture directly to an OpenCV matrix (no temp file).
   * The capture data is BGRA, 4 channels.
   */
  captureToMat(capture) {
    const width = capture.width;
    const height = capture.height;
    const data = capture.data;

    // Convert BGRA -> RGBA for cv.matFromImageData
    const rgba = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i += 4) {
      rgba[i] = data[i + 2];     // R <- B
      rgba[i + 1] = data[i + 1]; // G
      rgba[i + 2] = data[i];     // B <- R
      rgba[i + 3] = data[i + 3]; // A
    }

    return cv.matFromImageData({ data: rgba, width, height });
  }

  async findImage(imageId, options = {}) {
    const imagePath = this.getStorage().getImagePath(imageId);

    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image not found: ${imageId}`);
    }

    const confidence = options.confidence || this.defaultConfidence;
    const region = options.region;
    const scaleDown = options.scaleDown || false;
    const scaleFactor = options.scaleFactor || 0.5;

    try {
      const t0 = Date.now();

      // Capture the screen (or a region of it) — no temp file
      const capture = region
        ? await screen.grabRegion(new Region(region.x, region.y, region.width, region.height))
        : await screen.grab();

      const t1 = Date.now();

      // Convert capture directly to OpenCV matrix
      let src = this.captureToMat(capture);

      // Load template (cached)
      let templateData = this.templateCache.has(imageId)
        ? this.getTemplateMat(imagePath, imageId)
        : await this._loadTemplateAsync(imagePath, imageId, fs.statSync(imagePath).mtimeMs);

      // Handle promise if returned from async path
      if (templateData instanceof Promise) {
        templateData = await templateData;
      }

      let templ = templateData.mat;
      let tw = templateData.width;
      let th = templateData.height;

      const t2 = Date.now();

      // Optional scale-down for speed (only if source is large enough)
      let actualScale = 1;
      if (scaleDown) {
        // Ensure scaled source is still at least 2x the template in each dimension
        const minScaleW = (templ.cols * 2) / src.cols;
        const minScaleH = (templ.rows * 2) / src.rows;
        const minSafeScale = Math.max(minScaleW, minScaleH);
        actualScale = Math.max(scaleFactor, minSafeScale);

        if (actualScale < 0.95) { // only bother scaling if it actually reduces size
          const srcScaled = new cv.Mat();
          const templScaled = new cv.Mat();
          const srcSize = new cv.Size(Math.round(src.cols * actualScale), Math.round(src.rows * actualScale));
          const templSize = new cv.Size(Math.round(templ.cols * actualScale), Math.round(templ.rows * actualScale));
          cv.resize(src, srcScaled, srcSize, 0, 0, cv.INTER_AREA);
          cv.resize(templ, templScaled, templSize, 0, 0, cv.INTER_AREA);
          src.delete();
          src = srcScaled;
          templ = templScaled;
        } else {
          actualScale = 1; // skip scaling, region is too small
        }
      }

      const didScale = scaleDown && actualScale < 1;

      // Validate: source must be >= template in both dimensions
      if (src.cols < templ.cols || src.rows < templ.rows) {
        console.warn(`[Detection] "${imageId}": search area (${src.cols}x${src.rows}) is smaller than template (${templ.cols}x${templ.rows}) — skipping match`);
        src.delete();
        if (didScale) templ.delete();
        return null;
      }

      // Run template matching
      const result = new cv.Mat();
      const mask = new cv.Mat();
      try {
        cv.matchTemplate(src, templ, result, cv.TM_CCOEFF_NORMED, mask);
      } catch (cvErr) {
        src.delete();
        if (didScale) templ.delete();
        result.delete();
        mask.delete();
        throw new Error(`[Detection] OpenCV matchTemplate failed for "${imageId}": ${cvErr}`);
      }

      // Find the best match
      const minMax = cv.minMaxLoc(result, mask);
      const bestConfidence = minMax.maxVal;
      const bestLoc = minMax.maxLoc;

      const t3 = Date.now();

      // Clean up (don't delete the cached template mat)
      src.delete();
      if (didScale) templ.delete(); // only delete the scaled copy
      result.delete();
      mask.delete();

      // Scale coordinates back up if we scaled down
      const matchX = scaleDown ? Math.round(bestLoc.x / actualScale) : bestLoc.x;
      const matchY = scaleDown ? Math.round(bestLoc.y / actualScale) : bestLoc.y;

      console.log(`[Detection] "${imageId}": conf=${bestConfidence.toFixed(3)} threshold=${confidence} loc=(${matchX},${matchY}) [capture=${t1-t0}ms load=${t2-t1}ms match=${t3-t2}ms total=${t3-t0}ms]`);

      if (bestConfidence >= confidence) {
        const offsetX = region ? region.x : 0;
        const offsetY = region ? region.y : 0;

        return {
          x: Math.round(offsetX + matchX + tw / 2),
          y: Math.round(offsetY + matchY + th / 2),
          width: tw,
          height: th,
          confidence: bestConfidence,
          bounds: {
            left: offsetX + matchX,
            top: offsetY + matchY,
            right: offsetX + matchX + tw,
            bottom: offsetY + matchY + th
          }
        };
      }

      return null;
    } catch (error) {
      console.error('[Detection] findImage error:', error);
      throw error;
    }
  }

  /**
   * Clear the template cache (e.g. after a retake)
   */
  clearTemplateCache(imageId) {
    if (imageId) {
      const cached = this.templateCache.get(imageId);
      if (cached) {
        try { cached.mat.delete(); } catch (e) { /* ignore */ }
        this.templateCache.delete(imageId);
      }
    } else {
      for (const [, cached] of this.templateCache) {
        try { cached.mat.delete(); } catch (e) { /* ignore */ }
      }
      this.templateCache.clear();
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
        await saveImage({ image: capture, path: savePath });
        return savePath;
      }

      const tempPath = path.join(os.tmpdir(), `workflow-studio-capture-${Date.now()}.png`);
      await saveImage({ image: capture, path: tempPath });
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
