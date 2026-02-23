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
    console.log('[Storage] Initializing StorageService...');
    try {
      this.store = new Store({
        name: 'config',
        encryptionKey: 'workflow-studio-v1',
        defaults: {
          settings: DEFAULT_SETTINGS,
          recentWorkflows: []
        }
      });
      console.log('[Storage] Store created successfully');
    } catch (error) {
      console.error('[Storage] Failed to create store:', error);
      throw error;
    }

    this.workflowsDir = null;
    this.imagesDir = null;
    this.detectionsDir = null;
    this.templatesDir = null;

    try {
      this.initializeDirectories();
    } catch (error) {
      console.error('[Storage] Failed to initialize directories:', error);
      throw error;
    }
  }

  initializeDirectories() {
    const configuredDir = this.store.get('settings.workflowsDir');
    console.log('[Storage] Configured workflows dir from store:', configuredDir);

    if (configuredDir && fs.existsSync(configuredDir)) {
      this.workflowsDir = configuredDir;
      console.log('[Storage] Using configured dir:', this.workflowsDir);
    } else {
      const documentsDir = app.getPath('documents');
      this.workflowsDir = path.join(documentsDir, 'WorkflowStudio');
      console.log('[Storage] Using default dir:', this.workflowsDir);
    }

    this.imagesDir = path.join(this.workflowsDir, 'images');
    this.detectionsDir = path.join(this.workflowsDir, 'detections');
    this.templatesDir = path.join(this.workflowsDir, 'templates');
    const workflowsSubdir = path.join(this.workflowsDir, 'workflows');

    [this.workflowsDir, workflowsSubdir, this.imagesDir, this.detectionsDir, this.templatesDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        console.log('[Storage] Creating directory:', dir);
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    this.store.set('settings.workflowsDir', this.workflowsDir);
    console.log('[Storage] Final workflows path:', this.getWorkflowsPath());

    // Seed sample workflow on first launch
    this.seedSampleWorkflows();
  }

  seedSampleWorkflows() {
    const seeded = this.store.get('sampleWorkflowsSeeded', false);
    if (seeded) return;

    console.log('[Storage] Seeding sample workflows for first launch...');

    const sampleWorkflow = {
      id: uuidv4(),
      name: 'Sample: Auto-Clicker Demo',
      description: 'A demo workflow that moves the mouse, clicks, types text, and waits. Edit or run this to see how Workflow Studio works!',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      loopCount: 3,
      loopDelay: { min: 800, max: 1500 },
      actions: [
        {
          type: 'mouse_move',
          x: 960,
          y: 540,
          humanized: true,
          description: 'Move to center of screen'
        },
        {
          type: 'wait',
          duration: 500,
          randomize: true,
          minDuration: 300,
          maxDuration: 700,
          description: 'Short pause before clicking'
        },
        {
          type: 'mouse_click',
          button: 'left',
          clickType: 'single',
          x: 960,
          y: 540,
          description: 'Click at center'
        },
        {
          type: 'wait',
          duration: 1000,
          randomize: true,
          minDuration: 800,
          maxDuration: 1200,
          description: 'Wait after click'
        },
        {
          type: 'keyboard',
          mode: 'type',
          text: 'Hello from Workflow Studio!',
          description: 'Type a greeting'
        },
        {
          type: 'wait',
          duration: 2000,
          randomize: false,
          description: 'Wait 2 seconds before next loop'
        }
      ],
      settings: {
        clickJitter: { enabled: true, radius: 3, distribution: 'gaussian' }
      }
    };

    this.saveWorkflow(sampleWorkflow);
    this.addToRecent(sampleWorkflow.id);

    const shiftClickWorkflow = {
      id: uuidv4(),
      name: 'Sample: Shift-Click Inventory',
      description: 'Demonstrates the "Hold Key + Actions" feature. Holds Shift while clicking multiple inventory slots with pauses in between — perfect for games.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      loopCount: 1,
      loopDelay: { min: 500, max: 1000 },
      actions: [
        {
          id: uuidv4(),
          type: 'keyboard',
          mode: 'hold_and_act',
          key: 'shift',
          name: 'Shift-click 3 inventory slots',
          actions: [
            {
              id: uuidv4(),
              type: 'mouse_click',
              button: 'left',
              clickType: 'single',
              x: 500,
              y: 400,
              name: 'Click slot 1'
            },
            {
              id: uuidv4(),
              type: 'wait',
              duration: { min: 200, max: 400 }
            },
            {
              id: uuidv4(),
              type: 'mouse_click',
              button: 'left',
              clickType: 'single',
              x: 550,
              y: 400,
              name: 'Click slot 2'
            },
            {
              id: uuidv4(),
              type: 'wait',
              duration: { min: 200, max: 400 }
            },
            {
              id: uuidv4(),
              type: 'mouse_click',
              button: 'left',
              clickType: 'single',
              x: 600,
              y: 400,
              name: 'Click slot 3'
            }
          ]
        },
        {
          id: uuidv4(),
          type: 'wait',
          duration: { min: 500, max: 1000 },
          name: 'Pause after shift-clicking'
        }
      ],
      settings: {
        clickJitter: { enabled: true, radius: 3, distribution: 'gaussian' }
      }
    };

    this.saveWorkflow(shiftClickWorkflow);
    this.addToRecent(shiftClickWorkflow.id);

    const keyComboWorkflow = {
      id: uuidv4(),
      name: 'Sample: Keyboard Combos',
      description: 'Demonstrates pressing multi-key combos like Ctrl+A, Ctrl+C, and Ctrl+V. Shows how the "Press Key" mode handles simultaneous key presses.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      loopCount: 1,
      loopDelay: { min: 500, max: 1000 },
      actions: [
        {
          id: uuidv4(),
          type: 'mouse_click',
          button: 'left',
          clickType: 'single',
          x: 960,
          y: 540,
          name: 'Click to focus a text field'
        },
        {
          id: uuidv4(),
          type: 'wait',
          duration: { min: 300, max: 600 }
        },
        {
          id: uuidv4(),
          type: 'keyboard',
          mode: 'type',
          text: 'Workflow Studio is awesome!',
          name: 'Type some text'
        },
        {
          id: uuidv4(),
          type: 'wait',
          duration: { min: 400, max: 800 }
        },
        {
          id: uuidv4(),
          type: 'keyboard',
          mode: 'press',
          key: 'ctrl+a',
          name: 'Select All (Ctrl+A)'
        },
        {
          id: uuidv4(),
          type: 'wait',
          duration: { min: 200, max: 500 }
        },
        {
          id: uuidv4(),
          type: 'keyboard',
          mode: 'press',
          key: 'ctrl+c',
          name: 'Copy (Ctrl+C)'
        },
        {
          id: uuidv4(),
          type: 'wait',
          duration: { min: 300, max: 600 }
        },
        {
          id: uuidv4(),
          type: 'keyboard',
          mode: 'press',
          key: 'end',
          name: 'Move cursor to end'
        },
        {
          id: uuidv4(),
          type: 'keyboard',
          mode: 'press',
          key: 'enter',
          name: 'Press Enter for new line'
        },
        {
          id: uuidv4(),
          type: 'wait',
          duration: { min: 200, max: 400 }
        },
        {
          id: uuidv4(),
          type: 'keyboard',
          mode: 'press',
          key: 'ctrl+v',
          name: 'Paste (Ctrl+V)'
        },
        {
          id: uuidv4(),
          type: 'wait',
          duration: { min: 500, max: 1000 },
          name: 'Done — text is now duplicated'
        }
      ],
      settings: {
        clickJitter: { enabled: true, radius: 3, distribution: 'gaussian' }
      }
    };

    this.saveWorkflow(keyComboWorkflow);
    this.addToRecent(keyComboWorkflow.id);

    this.store.set('sampleWorkflowsSeeded', true);
    console.log('[Storage] Sample workflows created');
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
    console.log('[Storage] Loading workflows from:', workflowsPath);

    if (!fs.existsSync(workflowsPath)) {
      console.log('[Storage] Workflows directory does not exist, creating...');
      fs.mkdirSync(workflowsPath, { recursive: true });
      return [];
    }

    const files = fs.readdirSync(workflowsPath).filter(f => f.endsWith('.json'));
    console.log('[Storage] Found workflow files:', files);

    const workflows = [];
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(workflowsPath, file), 'utf-8');
        const workflow = JSON.parse(content);
        workflows.push(workflow);
      } catch (err) {
        console.error(`[Storage] Failed to load workflow ${file}:`, err);
      }
    }

    console.log('[Storage] Loaded', workflows.length, 'workflows');
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

  // ==================== TEMPLATES ====================

  getTemplatesPath() {
    return this.templatesDir;
  }

  getAllTemplates() {
    const templatesPath = this.getTemplatesPath();
    console.log('[Storage] Loading templates from:', templatesPath);

    if (!fs.existsSync(templatesPath)) {
      console.log('[Storage] Templates directory does not exist, creating...');
      fs.mkdirSync(templatesPath, { recursive: true });
      return [];
    }

    const files = fs.readdirSync(templatesPath).filter(f => f.endsWith('.json'));
    console.log('[Storage] Found template files:', files);

    const templates = [];
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(templatesPath, file), 'utf-8');
        const template = JSON.parse(content);
        templates.push(template);
      } catch (err) {
        console.error(`[Storage] Failed to load template ${file}:`, err);
      }
    }

    console.log('[Storage] Loaded', templates.length, 'templates');
    templates.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return templates;
  }

  getTemplate(id) {
    const filePath = path.join(this.getTemplatesPath(), `${id}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      console.error(`Failed to load template ${id}:`, err);
      return null;
    }
  }

  createTemplate(data = {}) {
    const id = uuidv4();
    const now = new Date().toISOString();

    const template = {
      id,
      name: data.name || 'Untitled Template',
      description: data.description || '',
      createdAt: now,
      updatedAt: now,
      actions: data.actions || []
    };

    this.saveTemplate(template);
    return template;
  }

  updateTemplate(id, updates) {
    const template = this.getTemplate(id);

    if (!template) {
      throw new Error(`Template ${id} not found`);
    }

    const updated = {
      ...template,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    this.saveTemplate(updated);
    return updated;
  }

  deleteTemplate(id) {
    const filePath = path.join(this.getTemplatesPath(), `${id}.json`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }

    return false;
  }

  saveTemplate(template) {
    const filePath = path.join(this.getTemplatesPath(), `${template.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(template, null, 2), 'utf-8');
  }

  duplicateTemplate(id) {
    const original = this.getTemplate(id);

    if (!original) {
      throw new Error(`Template ${id} not found`);
    }

    const duplicate = this.createTemplate({
      ...original,
      name: `${original.name} (Copy)`,
      id: undefined
    });

    return duplicate;
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
