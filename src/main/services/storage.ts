/**
 * Storage Service
 *
 * Handles workflow and configuration persistence
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';
import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_SETTINGS } from '../../shared/constants';
import { assertSafeFileId, resolvePathWithin } from '../lib/safe-path';
import { getStoreEncryptionKey } from '../lib/store-encryption-key';
import { createStoreWithRecovery } from '../lib/store-recovery';

const MAX_EXECUTION_HISTORY = 1000;

class StorageService {
  [key: string]: any;

  constructor() {
    console.log('[Storage] Initializing StorageService...');
    try {
      const encryptionKey = getStoreEncryptionKey();
      const storeDir = app.getPath('userData');

      const storeOptions: any = {
        name: 'config',
        cwd: storeDir,
        defaults: {
          settings: DEFAULT_SETTINGS,
          recentWorkflows: [],
          executionHistory: []
        }
      };

      if (encryptionKey) {
        storeOptions.encryptionKey = encryptionKey;
      }

      this.store = createStoreWithRecovery(storeOptions, {
        createStore: (options) => new Store(options),
        logger: console,
        storeDir
      });
      console.log('[Storage] Store created successfully');
    } catch (error) {
      console.error('[Storage] Failed to create store:', error);
      throw error;
    }

    // Recover config orphaned when the legacy→hardened encryption-key change
    // quarantined the old (legacy-key-encrypted) store as config.corrupt-*.json.
    this.recoverLegacyConfig(app.getPath('userData'));

    this.workflowsDir = null;
    this.imagesDir = null;
    this.detectionsDir = null;
    this.templatesDir = null;
    this.soundsDir = null;

    try {
      this.initializeDirectories();
    } catch (error) {
      console.error('[Storage] Failed to initialize directories:', error);
      throw error;
    }
  }

  recoverLegacyConfig(storeDir) {
    let corruptName;
    try {
      const entries = fs.readdirSync(storeDir).filter((f) => /^config\.corrupt-.*\.json$/i.test(f));
      if (entries.length === 0) return;
      entries.sort();
      corruptName = entries[entries.length - 1]; // newest quarantined file
      const corruptPath = path.join(storeDir, corruptName);
      const data = fs.readFileSync(corruptPath);
      const iv = data.slice(0, 16);
      const ciphertext = data.slice(17); // format: [iv:16][':' :1][ciphertext]
      const decode = (salt) => {
        const password = crypto.pbkdf2Sync('workflow-studio-v1', salt, 10000, 32, 'sha512');
        const decipher = crypto.createDecipheriv('aes-256-cbc', password, iv);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
      };
      // conf primary scheme uses the IV buffer as salt; legacy used iv.toString().
      let json;
      try { json = decode(iv); } catch { json = decode(iv.toString()); }
      const legacy = JSON.parse(json);

      let restored = 0;
      for (const key of ['settings', 'recentWorkflows', 'executionHistory', 'hotkeys', 'imageFolders', 'imageFolderMap']) {
        if (legacy[key] !== undefined) {
          this.store.set(key, legacy[key]);
          restored++;
        }
      }

      // Mark recovered so this only ever runs once (and the old data is kept, not deleted).
      fs.renameSync(corruptPath, corruptPath.replace('.corrupt-', '.recovered-'));
      console.log(`[Storage] Recovered ${restored} config section(s) from legacy ${corruptName}`);
    } catch (error) {
      console.warn(`[Storage] Legacy config recovery skipped (${corruptName || 'no file'}):`, error.message);
    }
  }

  initializeDirectories() {
    const configuredDir = this.store.get('settings.workflowsDir');
    console.log('[Storage] Configured workflows dir from store:', configuredDir);

    if (configuredDir && fs.existsSync(configuredDir)) {
      console.log('[Storage] Using configured dir:', configuredDir);
      this.setWorkflowsDir(configuredDir);
    } else {
      const documentsDir = app.getPath('documents');
      const defaultDir = path.join(documentsDir, 'WorkflowStudio');
      console.log('[Storage] Using default dir:', defaultDir);
      this.setWorkflowsDir(defaultDir);
    }

    console.log('[Storage] Final workflows path:', this.getWorkflowsPath());

    // Seed sample workflow on first launch
    this.seedSampleWorkflows();
  }

  normalizeWorkflowsRootDir(dirPath) {
    if (path.basename(dirPath).toLowerCase() === 'workflows') {
      return path.dirname(dirPath);
    }
    return dirPath;
  }

  ensureDirectoryStructure(baseDir) {
    this.imagesDir = path.join(baseDir, 'images');
    this.detectionsDir = path.join(baseDir, 'detections');
    this.templatesDir = path.join(baseDir, 'templates');
    this.soundsDir = path.join(baseDir, 'sounds');
    const workflowsSubdir = path.join(baseDir, 'workflows');

    [baseDir, workflowsSubdir, this.imagesDir, this.detectionsDir, this.templatesDir, this.soundsDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        console.log('[Storage] Creating directory:', dir);
        fs.mkdirSync(dir, { recursive: true });
      }
    });
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
    if (!newDir || typeof newDir !== 'string') {
      throw new Error('Invalid directory path');
    }

    const normalizedDir = this.normalizeWorkflowsRootDir(path.resolve(newDir));
    this.workflowsDir = normalizedDir;
    this.ensureDirectoryStructure(normalizedDir);
    this.store.set('settings.workflowsDir', normalizedDir);
  }

  getWorkflowsPath() {
    if (!this.workflowsDir) {
      const documentsDir = app.getPath('documents');
      this.workflowsDir = path.join(documentsDir, 'WorkflowStudio');
      this.ensureDirectoryStructure(this.workflowsDir);
      this.store.set('settings.workflowsDir', this.workflowsDir);
    }
    return path.join(this.workflowsDir, 'workflows');
  }

  assertSafeFileId(id, label = 'id') {
    return assertSafeFileId(id, label);
  }

  resolveSafePath(baseDir, fileName) {
    return resolvePathWithin(baseDir, fileName);
  }

  getWorkflowFilePath(id) {
    const safeId = this.assertSafeFileId(id, 'workflow id');
    return this.resolveSafePath(this.getWorkflowsPath(), `${safeId}.json`);
  }

  getTemplateFilePath(id) {
    const safeId = this.assertSafeFileId(id, 'template id');
    return this.resolveSafePath(this.getTemplatesPath(), `${safeId}.json`);
  }

  getImageFilePath(id) {
    const safeId = this.assertSafeFileId(id, 'image id');
    return this.resolveSafePath(this.imagesDir, `${safeId}.png`);
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
    workflows.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return workflows;
  }

  getWorkflow(id) {
    const filePath = this.getWorkflowFilePath(id);

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

  createWorkflow(data: any = {}) {
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
    const filePath = this.getWorkflowFilePath(id);

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
    const filePath = this.getWorkflowFilePath(workflow.id);
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
    return this.getAllWorkflows()
      .sort((a, b) => +new Date(b.createdAt || b.updatedAt || 0) - +new Date(a.createdAt || a.updatedAt || 0))
      .slice(0, 10);
  }

  recordWorkflowExecution(entry: any = {}) {
    if (!entry.workflowId) return null;

    const now = new Date().toISOString();
    const durationMs = Number.isFinite(entry.durationMs)
      ? Math.max(0, Math.round(entry.durationMs))
      : 0;
    const record = {
      id: entry.id || uuidv4(),
      workflowId: entry.workflowId,
      workflowName: entry.workflowName || 'Untitled Workflow',
      status: entry.status || 'completed',
      startedAt: entry.startedAt || now,
      endedAt: entry.endedAt || now,
      durationMs,
      loopsConfigured: entry.loopsConfigured ?? 1,
      completedLoops: entry.completedLoops ?? null,
      actions: entry.actions ?? 0,
      dryRun: !!entry.dryRun,
      error: entry.error || null
    };

    const history = this.getExecutionHistory();
    history.unshift(record);
    this.store.set('executionHistory', history.slice(0, MAX_EXECUTION_HISTORY));
    return record;
  }

  getExecutionHistory(options: any = {}) {
    let history = this.store.get('executionHistory', []);
    if (!Array.isArray(history)) history = [];

    if (options.workflowId) {
      history = history.filter(record => record.workflowId === options.workflowId);
    }

    history = history
      .filter(record => record && record.workflowId)
      .sort((a, b) => +new Date(b.startedAt || b.endedAt || 0) - +new Date(a.startedAt || a.endedAt || 0));

    if (Number.isFinite(options.limit)) {
      history = history.slice(0, Math.max(0, options.limit));
    }

    return history;
  }

  clearExecutionHistory() {
    this.store.set('executionHistory', []);
    return { success: true };
  }

  importExecutionHistory(records: any[] = []) {
    if (!Array.isArray(records) || records.length === 0) {
      return { success: true, imported: 0 };
    }

    const existing = this.getExecutionHistory();
    const seen = new Set(existing.map(record => `${record.workflowId}:${record.startedAt}:${record.status}`));
    const imported = [];

    for (const entry of records) {
      if (!entry?.workflowId) continue;

      const startedAt = entry.startedAt || entry.timestamp || new Date().toISOString();
      const endedAt = entry.endedAt || entry.timestamp || startedAt;
      const durationMs = Number.isFinite(entry.durationMs)
        ? entry.durationMs
        : (Number.isFinite(entry.duration) ? entry.duration : Math.max(0, +new Date(endedAt) - +new Date(startedAt)));
      const status = entry.status || 'completed';
      const dedupeKey = `${entry.workflowId}:${startedAt}:${status}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      imported.push({
        id: entry.id || uuidv4(),
        workflowId: entry.workflowId,
        workflowName: entry.workflowName || 'Untitled Workflow',
        status,
        startedAt,
        endedAt,
        durationMs: Math.max(0, Math.round(durationMs || 0)),
        loopsConfigured: entry.loopsConfigured ?? entry.loops ?? 1,
        completedLoops: entry.completedLoops ?? null,
        actions: entry.actions ?? 0,
        dryRun: !!entry.dryRun,
        error: entry.error || null
      });
    }

    const nextHistory = [...imported, ...existing]
      .sort((a, b) => +new Date(b.startedAt || b.endedAt || 0) - +new Date(a.startedAt || a.endedAt || 0))
      .slice(0, MAX_EXECUTION_HISTORY);
    this.store.set('executionHistory', nextHistory);

    return { success: true, imported: imported.length };
  }

  getRecentRunWorkflows(limit = 10) {
    const seen = new Set();
    const recent = [];

    for (const record of this.getExecutionHistory()) {
      if (seen.has(record.workflowId)) continue;
      const workflow = this.getWorkflow(record.workflowId);
      if (!workflow) continue;
      seen.add(record.workflowId);

      const analytics = this.getWorkflowAnalytics(record.workflowId);
      recent.push({
        ...workflow,
        lastRunAt: record.startedAt,
        lastRunStatus: record.status,
        lastDurationMs: record.durationMs,
        runCount: analytics.summary.totalRuns
      });

      if (recent.length >= limit) break;
    }

    return recent;
  }

  getWorkflowAnalytics(workflowId) {
    const workflow = this.getWorkflow(workflowId);
    const history = this.getExecutionHistory({ workflowId });
    return {
      workflow,
      summary: this.buildExecutionSummary(history),
      runs: history
    };
  }

  getOverallAnalytics() {
    const history = this.getExecutionHistory();
    const workflows = this.getAllWorkflows();
    const workflowNames = new Map(workflows.map(workflow => [workflow.id, workflow.name]));
    const grouped = new Map();

    for (const record of history) {
      if (!grouped.has(record.workflowId)) grouped.set(record.workflowId, []);
      grouped.get(record.workflowId).push(record);
    }

    const perWorkflow = Array.from(grouped.entries()).map(([workflowId, records]) => ({
      workflowId,
      workflowName: workflowNames.get(workflowId) || records[0]?.workflowName || 'Deleted Workflow',
      summary: this.buildExecutionSummary(records)
    })).sort((a, b) => b.summary.totalRuns - a.summary.totalRuns);

    return {
      summary: this.buildExecutionSummary(history),
      workflowCount: workflows.length,
      workflowsRun: perWorkflow.length,
      perWorkflow,
      recentRuns: history.slice(0, 25)
    };
  }

  buildExecutionSummary(history: any[] = []) {
    const records = Array.isArray(history) ? history : [];
    const totalRuns = records.length;
    const completedRuns = records.filter(record => record.status === 'completed').length;
    const stoppedRuns = records.filter(record => record.status === 'stopped').length;
    const errorRuns = records.filter(record => record.status === 'error').length;
    const dryRuns = records.filter(record => record.dryRun).length;
    const durations = records
      .map(record => Number(record.durationMs))
      .filter(duration => Number.isFinite(duration) && duration >= 0);
    const totalDurationMs = durations.reduce((total, duration) => total + duration, 0);
    const totalActions = records.reduce((total, record) => total + (Number(record.actions) || 0), 0);
    const completedLoopCounts = records
      .map(record => Number(record.completedLoops))
      .filter(loopCount => Number.isFinite(loopCount) && loopCount >= 0);
    const totalCompletedLoops = completedLoopCounts.reduce((total, loopCount) => total + loopCount, 0);

    return {
      totalRuns,
      completedRuns,
      stoppedRuns,
      errorRuns,
      dryRuns,
      successRate: totalRuns ? completedRuns / totalRuns : 0,
      totalDurationMs,
      averageDurationMs: durations.length ? totalDurationMs / durations.length : 0,
      shortestDurationMs: durations.length ? Math.min(...durations) : 0,
      longestDurationMs: durations.length ? Math.max(...durations) : 0,
      totalActions,
      averageActions: totalRuns ? totalActions / totalRuns : 0,
      totalCompletedLoops,
      averageCompletedLoops: completedLoopCounts.length ? totalCompletedLoops / completedLoopCounts.length : 0,
      firstRunAt: records.length ? records[records.length - 1].startedAt : null,
      lastRunAt: records.length ? records[0].startedAt : null,
      lastStatus: records.length ? records[0].status : null
    };
  }

  getSettings() {
    const settings = this.store.get('settings', DEFAULT_SETTINGS) || {};
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      defaultLoopDelay: {
        ...DEFAULT_SETTINGS.defaultLoopDelay,
        ...(settings.defaultLoopDelay || {})
      },
      typingSpeed: {
        ...DEFAULT_SETTINGS.typingSpeed,
        ...(settings.typingSpeed || {})
      },
      clickJitter: {
        ...DEFAULT_SETTINGS.clickJitter,
        ...(settings.clickJitter || {})
      },
      windMouse: {
        ...DEFAULT_SETTINGS.windMouse,
        ...(settings.windMouse || {})
      },
      overshoot: {
        ...DEFAULT_SETTINGS.overshoot,
        ...(settings.overshoot || {})
      },
      detection: {
        ...DEFAULT_SETTINGS.detection,
        ...(settings.detection || {})
      },
      maxRunTime: (() => {
        const merged = { ...DEFAULT_SETTINGS.maxRunTime, ...(settings.maxRunTime || {}) };
        // Migrate legacy minutes-based value to canonical milliseconds.
        if (merged.ms == null && merged.minutes != null) {
          merged.ms = Math.round(Number(merged.minutes) * 60 * 1000);
        }
        delete merged.minutes;
        return merged;
      })(),
      ai: {
        ...DEFAULT_SETTINGS.ai,
        ...(settings.ai || {})
      }
    };
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
    const filePath = this.getImageFilePath(id);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  getImagePath(id) {
    return this.getImageFilePath(id);
  }

  renameImage(oldId, newId) {
    const oldPath = this.getImagePath(oldId);
    const newPath = this.getImagePath(newId);
    if (!fs.existsSync(oldPath)) {
      throw new Error(`Image not found: ${oldId}`);
    }
    if (fs.existsSync(newPath)) {
      throw new Error(`An image named "${newId}" already exists`);
    }
    fs.renameSync(oldPath, newPath);
    return { id: newId, path: newPath };
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
    const folderMap = this.getImageFolderMap();
    return files.map(f => {
      const id = path.basename(f, '.png');
      return {
        id,
        path: path.join(this.imagesDir, f),
        filename: f,
        folder: folderMap[id] || null
      };
    });
  }

  // ==================== IMAGE FOLDERS (virtual, metadata-only) ====================

  getImageFolders() {
    return this.store.get('imageFolders', []);
  }

  createImageFolder(name) {
    const folders = this.getImageFolders();
    if (folders.includes(name)) {
      throw new Error(`Folder "${name}" already exists`);
    }
    folders.push(name);
    folders.sort((a, b) => a.localeCompare(b));
    this.store.set('imageFolders', folders);
    return folders;
  }

  renameImageFolder(oldName, newName) {
    const folders = this.getImageFolders();
    const idx = folders.indexOf(oldName);
    if (idx === -1) throw new Error(`Folder "${oldName}" not found`);
    if (folders.includes(newName)) throw new Error(`Folder "${newName}" already exists`);
    folders[idx] = newName;
    folders.sort((a, b) => a.localeCompare(b));
    this.store.set('imageFolders', folders);

    // Update all images in the old folder to the new folder name
    const map = this.getImageFolderMap();
    for (const [imageId, folder] of Object.entries(map)) {
      if (folder === oldName) map[imageId] = newName;
    }
    this.store.set('imageFolderMap', map);
    return folders;
  }

  deleteImageFolder(name) {
    let folders = this.getImageFolders();
    folders = folders.filter(f => f !== name);
    this.store.set('imageFolders', folders);

    // Unassign all images from this folder (move to root)
    const map = this.getImageFolderMap();
    for (const [imageId, folder] of Object.entries(map)) {
      if (folder === name) delete map[imageId];
    }
    this.store.set('imageFolderMap', map);
    return folders;
  }

  getImageFolderMap() {
    return this.store.get('imageFolderMap', {});
  }

  setImageFolder(imageId, folderName) {
    const map = this.getImageFolderMap();
    if (folderName === null || folderName === '') {
      delete map[imageId];
    } else {
      map[imageId] = folderName;
    }
    this.store.set('imageFolderMap', map);
  }

  moveImageToFolder(imageId, folderName) {
    this.setImageFolder(imageId, folderName);
  }

  getCustomSounds() {
    if (!fs.existsSync(this.soundsDir)) {
      fs.mkdirSync(this.soundsDir, { recursive: true });
      return [];
    }

    const files = fs.readdirSync(this.soundsDir).filter((file) => /\.(wav|mp3|ogg|m4a|aac|flac)$/i.test(file));
    return files.map((file) => {
      const parsed = path.parse(file);
      return {
        id: `custom:${parsed.name}`,
        label: `Custom: ${parsed.name}`,
        type: 'custom',
        path: path.join(this.soundsDir, file),
        filename: file
      };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }

  importCustomSound(sourcePath) {
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      throw new Error('Sound file not found');
    }

    if (!fs.existsSync(this.soundsDir)) {
      fs.mkdirSync(this.soundsDir, { recursive: true });
    }

    const parsed = path.parse(sourcePath);
    const baseName = parsed.name.replace(/[^a-z0-9-_ ]/gi, '').trim() || `sound-${uuidv4().slice(0, 8)}`;
    let candidate = `${baseName}${parsed.ext.toLowerCase()}`;
    let counter = 2;
    while (fs.existsSync(path.join(this.soundsDir, candidate))) {
      candidate = `${baseName}-${counter}${parsed.ext.toLowerCase()}`;
      counter++;
    }

    const destination = path.join(this.soundsDir, candidate);
    fs.copyFileSync(sourcePath, destination);
    const stored = path.parse(candidate);
    return {
      id: `custom:${stored.name}`,
      label: `Custom: ${stored.name}`,
      type: 'custom',
      path: destination,
      filename: candidate
    };
  }

  deleteCustomSound(soundId) {
    if (!soundId?.startsWith('custom:')) {
      throw new Error('Only custom sounds can be deleted');
    }

    const targetName = soundId.slice('custom:'.length);
    const sound = this.getCustomSounds().find((item) => item.id === soundId || path.parse(item.filename).name === targetName);
    if (!sound?.path || !fs.existsSync(sound.path)) {
      throw new Error('Custom sound not found');
    }

    fs.unlinkSync(sound.path);
    return true;
  }

  getWorkflowsDir() {
    if (!this.workflowsDir || !fs.existsSync(this.workflowsDir)) {
      const configuredDir = this.store.get('settings.workflowsDir');
      const fallbackDir = configuredDir && typeof configuredDir === 'string'
        ? configuredDir
        : path.join(app.getPath('documents'), 'WorkflowStudio');
      this.setWorkflowsDir(fallbackDir);
    }

    const workflowsPath = this.getWorkflowsPath();
    if (!fs.existsSync(workflowsPath)) {
      fs.mkdirSync(workflowsPath, { recursive: true });
    }

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
    templates.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return templates;
  }

  getTemplate(id) {
    const filePath = this.getTemplateFilePath(id);

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

  createTemplate(data: any = {}) {
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
    const filePath = this.getTemplateFilePath(id);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }

    return false;
  }

  saveTemplate(template) {
    const filePath = this.getTemplateFilePath(template.id);
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
