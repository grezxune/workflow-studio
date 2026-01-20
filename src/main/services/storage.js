/**
 * Storage Service
 *
 * Handles workflow and configuration persistence
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_SETTINGS } from '../../shared/constants.js';

class StorageService {
  constructor() {
    this.store = new Store({
      name: 'config',
      encryptionKey: 'workflow-studio-v1',
      defaults: {
        settings: DEFAULT_SETTINGS,
        recentWorkflows: []
      }
    });

    this.workflowsDir = null;
    this.imagesDir = null;
    this.detectionsDir = null;

    this.initializeDirectories();
  }

  initializeDirectories() {
    const configuredDir = this.store.get('settings.workflowsDir');

    if (configuredDir && fs.existsSync(configuredDir)) {
      this.workflowsDir = configuredDir;
    } else {
      const documentsDir = app.getPath('documents');
      this.workflowsDir = path.join(documentsDir, 'WorkflowStudio');
    }

    this.imagesDir = path.join(this.workflowsDir, 'images');
    this.detectionsDir = path.join(this.workflowsDir, 'detections');
    const workflowsSubdir = path.join(this.workflowsDir, 'workflows');

    [this.workflowsDir, workflowsSubdir, this.imagesDir, this.detectionsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    this.store.set('settings.workflowsDir', this.workflowsDir);
  }

  setWorkflowsDir(newDir) {
    if (!fs.existsSync(newDir)) {
      throw new Error('Directory does not exist');
    }

    this.workflowsDir = newDir;
    this.imagesDir = path.join(newDir, 'images');
    this.detectionsDir = path.join(newDir, 'detections');

    [path.join(newDir, 'workflows'), this.imagesDir, this.detectionsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    this.store.set('settings.workflowsDir', newDir);
  }

  getWorkflowsPath() {
    return path.join(this.workflowsDir, 'workflows');
  }

  getAllWorkflows() {
    const workflowsPath = this.getWorkflowsPath();
    const files = fs.readdirSync(workflowsPath).filter(f => f.endsWith('.json'));

    const workflows = [];
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(workflowsPath, file), 'utf-8');
        const workflow = JSON.parse(content);
        workflows.push(workflow);
      } catch (err) {
        console.error(`Failed to load workflow ${file}:`, err);
      }
    }

    workflows.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return workflows;
  }

  getWorkflow(id) {
    const filePath = path.join(this.getWorkflowsPath(), `${id}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      console.error(`Failed to load workflow ${id}:`, err);
      return null;
    }
  }

  createWorkflow(data = {}) {
    const id = uuidv4();
    const now = new Date().toISOString();

    const workflow = {
      id,
      name: data.name || 'Untitled Workflow',
      description: data.description || '',
      createdAt: now,
      updatedAt: now,
      loopCount: data.loopCount ?? 1,
      loopDelay: data.loopDelay ?? { min: 500, max: 1000 },
      actions: data.actions || [],
      settings: {
        clickJitter: { enabled: true, radius: 3, distribution: 'gaussian' },
        ...data.settings
      }
    };

    this.saveWorkflow(workflow);
    this.addToRecent(id);

    return workflow;
  }

  updateWorkflow(id, updates) {
    const workflow = this.getWorkflow(id);

    if (!workflow) {
      throw new Error(`Workflow ${id} not found`);
    }

    const updated = {
      ...workflow,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    this.saveWorkflow(updated);
    this.addToRecent(id);

    return updated;
  }

  deleteWorkflow(id) {
    const filePath = path.join(this.getWorkflowsPath(), `${id}.json`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.removeFromRecent(id);
      return true;
    }

    return false;
  }

  duplicateWorkflow(id) {
    const original = this.getWorkflow(id);

    if (!original) {
      throw new Error(`Workflow ${id} not found`);
    }

    const duplicate = this.createWorkflow({
      ...original,
      name: `${original.name} (Copy)`,
      id: undefined
    });

    return duplicate;
  }

  saveWorkflow(workflow) {
    const filePath = path.join(this.getWorkflowsPath(), `${workflow.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf-8');
  }

  addToRecent(id) {
    const recent = this.store.get('recentWorkflows', []);
    const filtered = recent.filter(r => r !== id);
    filtered.unshift(id);
    this.store.set('recentWorkflows', filtered.slice(0, 10));
  }

  removeFromRecent(id) {
    const recent = this.store.get('recentWorkflows', []);
    this.store.set('recentWorkflows', recent.filter(r => r !== id));
  }

  getRecentWorkflows() {
    const recent = this.store.get('recentWorkflows', []);
    return recent.map(id => this.getWorkflow(id)).filter(Boolean);
  }

  getSettings() {
    return this.store.get('settings', DEFAULT_SETTINGS);
  }

  updateSettings(updates) {
    const current = this.getSettings();
    const updated = { ...current, ...updates };
    this.store.set('settings', updated);

    if (updates.workflowsDir && updates.workflowsDir !== current.workflowsDir) {
      this.setWorkflowsDir(updates.workflowsDir);
    }

    return updated;
  }

  getSetting(key) {
    return this.store.get(`settings.${key}`);
  }

  setSetting(key, value) {
    this.store.set(`settings.${key}`, value);
  }

  saveImage(id, buffer) {
    const filePath = path.join(this.imagesDir, `${id}.png`);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  getImagePath(id) {
    return path.join(this.imagesDir, `${id}.png`);
  }

  deleteImage(id) {
    const filePath = this.getImagePath(id);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  getAllImages() {
    const files = fs.readdirSync(this.imagesDir).filter(f => f.endsWith('.png'));
    return files.map(f => ({
      id: path.basename(f, '.png'),
      path: path.join(this.imagesDir, f),
      filename: f
    }));
  }

  getWorkflowsDir() {
    return this.workflowsDir;
  }

  exportWorkflow(id) {
    const workflow = this.getWorkflow(id);
    if (!workflow) return null;

    const exported = { ...workflow };
    delete exported.id;

    return JSON.stringify(exported, null, 2);
  }

  importWorkflow(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      return this.createWorkflow(data);
    } catch (err) {
      throw new Error('Invalid workflow JSON');
    }
  }
}

let instance = null;

export function getStorageService() {
  if (!instance) {
    instance = new StorageService();
  }
  return instance;
}

export { StorageService };
