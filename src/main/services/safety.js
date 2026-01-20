/**
 * Safety Service
 *
 * Handles emergency stop, panic hotkey, and safety features
 */

import { EventEmitter } from 'events';
import { globalShortcut } from 'electron';
import { SAFETY_KEYS } from '../../shared/constants.js';

class SafetyService extends EventEmitter {
  constructor() {
    super();
    this.panicHotkey = SAFETY_KEYS.PANIC;
    this.isRegistered = false;
    this.onPanicCallback = null;
    this.deadManSwitchKey = null;
    this.deadManSwitchActive = false;
    this.deadManSwitchTimer = null;
  }

  initialize(options = {}) {
    if (options.panicHotkey) {
      this.panicHotkey = options.panicHotkey;
    }

    this.registerPanicHotkey();

    if (options.deadManSwitch) {
      this.setupDeadManSwitch(options.deadManSwitch);
    }
  }

  registerPanicHotkey() {
    if (this.isRegistered) {
      globalShortcut.unregister(this.panicHotkey);
    }

    try {
      const registered = globalShortcut.register(this.panicHotkey, () => {
        this.triggerPanic('hotkey');
      });

      if (registered) {
        this.isRegistered = true;
        this.emit('panic:registered', { hotkey: this.panicHotkey });
      } else {
        this.emit('panic:registration_failed', { hotkey: this.panicHotkey });
      }
    } catch (error) {
      this.emit('panic:registration_error', { error });
    }
  }

  setPanicHotkey(newHotkey) {
    if (this.isRegistered) {
      globalShortcut.unregister(this.panicHotkey);
      this.isRegistered = false;
    }

    this.panicHotkey = newHotkey;
    this.registerPanicHotkey();
  }

  onPanic(callback) {
    this.onPanicCallback = callback;
  }

  triggerPanic(source = 'manual') {
    this.emit('panic:triggered', { source });

    if (this.onPanicCallback) {
      try {
        this.onPanicCallback(source);
      } catch (error) {
        console.error('Error in panic callback:', error);
      }
    }

    this.stopDeadManSwitch();
  }

  setupDeadManSwitch(config) {
    this.deadManSwitchKey = config.key || 'Space';
    this.deadManSwitchTimeout = config.timeout || 5000;

    try {
      globalShortcut.register(this.deadManSwitchKey, () => {
        this.resetDeadManSwitch();
      });
    } catch (error) {
      console.error('Failed to register dead man switch:', error);
    }
  }

  startDeadManSwitch() {
    if (!this.deadManSwitchKey) return;

    this.deadManSwitchActive = true;
    this.resetDeadManSwitch();
    this.emit('deadman:started');
  }

  resetDeadManSwitch() {
    if (!this.deadManSwitchActive) return;

    if (this.deadManSwitchTimer) {
      clearTimeout(this.deadManSwitchTimer);
    }

    this.deadManSwitchTimer = setTimeout(() => {
      if (this.deadManSwitchActive) {
        this.emit('deadman:timeout');
        this.triggerPanic('deadman_switch');
      }
    }, this.deadManSwitchTimeout);

    this.emit('deadman:reset');
  }

  stopDeadManSwitch() {
    this.deadManSwitchActive = false;
    if (this.deadManSwitchTimer) {
      clearTimeout(this.deadManSwitchTimer);
      this.deadManSwitchTimer = null;
    }
    this.emit('deadman:stopped');
  }

  isPanicRegistered() {
    return this.isRegistered;
  }

  getConfig() {
    return {
      panicHotkey: this.panicHotkey,
      isRegistered: this.isRegistered,
      deadManSwitch: {
        key: this.deadManSwitchKey,
        timeout: this.deadManSwitchTimeout,
        active: this.deadManSwitchActive
      }
    };
  }

  destroy() {
    if (this.isRegistered) {
      globalShortcut.unregister(this.panicHotkey);
      this.isRegistered = false;
    }

    if (this.deadManSwitchKey) {
      try {
        globalShortcut.unregister(this.deadManSwitchKey);
      } catch (e) {
        // Ignore
      }
    }

    this.stopDeadManSwitch();
    this.removeAllListeners();
  }
}

let instance = null;

export function getSafetyService() {
  if (!instance) {
    instance = new SafetyService();
  }
  return instance;
}

export { SafetyService };
