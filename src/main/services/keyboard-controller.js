/**
 * Keyboard Controller Service
 *
 * Handles all keyboard operations with human-like timing
 */

import { keyboard, Key } from '@nut-tree-fork/nut-js';
import { generateTypingDelays, sleep, randomDelay } from '../lib/humanize.js';

class KeyboardController {
  constructor(settings = {}) {
    this.defaultSpeed = settings.typingSpeed || { min: 50, max: 150 };
    keyboard.config.autoDelayMs = 0;
  }

  async type(text, options = {}) {
    const speed = options.speed || this.defaultSpeed;
    const delays = generateTypingDelays(text, speed.min, speed.max);

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      await keyboard.type(char);

      if (i < text.length - 1 && delays[i] > 0) {
        await sleep(delays[i]);
      }
    }
  }

  async press(keyCombo) {
    const keys = this.parseKeyCombo(keyCombo);

    if (keys.length === 1) {
      await keyboard.pressKey(keys[0]);
      await sleep(randomDelay(30, 80));
      await keyboard.releaseKey(keys[0]);
    } else {
      for (const key of keys) {
        await keyboard.pressKey(key);
        await sleep(randomDelay(10, 30));
      }

      await sleep(randomDelay(30, 80));

      for (const key of keys.reverse()) {
        await keyboard.releaseKey(key);
        await sleep(randomDelay(10, 30));
      }
    }
  }

  async pressKey(keyCombo) {
    const keys = this.parseKeyCombo(keyCombo);
    for (const key of keys) {
      await keyboard.pressKey(key);
    }
  }

  async releaseKey(keyCombo) {
    const keys = this.parseKeyCombo(keyCombo);
    for (const key of keys.reverse()) {
      await keyboard.releaseKey(key);
    }
  }

  parseKeyCombo(combo) {
    const parts = combo.toLowerCase().split('+').map(p => p.trim());
    return parts.map(part => this.getKey(part));
  }

  getKey(keyStr) {
    const keyMap = {
      'ctrl': Key.LeftControl,
      'control': Key.LeftControl,
      'shift': Key.LeftShift,
      'alt': Key.LeftAlt,
      'meta': Key.LeftSuper,
      'cmd': Key.LeftSuper,
      'command': Key.LeftSuper,
      'win': Key.LeftSuper,
      'windows': Key.LeftSuper,
      'enter': Key.Enter,
      'return': Key.Enter,
      'tab': Key.Tab,
      'space': Key.Space,
      'backspace': Key.Backspace,
      'delete': Key.Delete,
      'escape': Key.Escape,
      'esc': Key.Escape,
      'up': Key.Up,
      'down': Key.Down,
      'left': Key.Left,
      'right': Key.Right,
      'home': Key.Home,
      'end': Key.End,
      'pageup': Key.PageUp,
      'pagedown': Key.PageDown,
      'insert': Key.Insert,
      'f1': Key.F1, 'f2': Key.F2, 'f3': Key.F3, 'f4': Key.F4,
      'f5': Key.F5, 'f6': Key.F6, 'f7': Key.F7, 'f8': Key.F8,
      'f9': Key.F9, 'f10': Key.F10, 'f11': Key.F11, 'f12': Key.F12,
      '0': Key.Num0, '1': Key.Num1, '2': Key.Num2, '3': Key.Num3,
      '4': Key.Num4, '5': Key.Num5, '6': Key.Num6, '7': Key.Num7,
      '8': Key.Num8, '9': Key.Num9,
      'a': Key.A, 'b': Key.B, 'c': Key.C, 'd': Key.D,
      'e': Key.E, 'f': Key.F, 'g': Key.G, 'h': Key.H,
      'i': Key.I, 'j': Key.J, 'k': Key.K, 'l': Key.L,
      'm': Key.M, 'n': Key.N, 'o': Key.O, 'p': Key.P,
      'q': Key.Q, 'r': Key.R, 's': Key.S, 't': Key.T,
      'u': Key.U, 'v': Key.V, 'w': Key.W, 'x': Key.X,
      'y': Key.Y, 'z': Key.Z,
      'minus': Key.Minus, '-': Key.Minus,
      'equal': Key.Equal, '=': Key.Equal,
      '[': Key.LeftBracket, ']': Key.RightBracket,
      ';': Key.Semicolon, "'": Key.Quote,
      '\\': Key.Backslash, ',': Key.Comma,
      '.': Key.Period, '/': Key.Slash, '`': Key.Grave
    };

    const key = keyMap[keyStr];
    if (!key) {
      console.warn(`Unknown key: ${keyStr}, defaulting to space`);
      return Key.Space;
    }
    return key;
  }

  async emergencyStop() {
    const modifiers = [
      Key.LeftControl, Key.RightControl,
      Key.LeftShift, Key.RightShift,
      Key.LeftAlt, Key.RightAlt,
      Key.LeftSuper, Key.RightSuper
    ];

    for (const key of modifiers) {
      try {
        await keyboard.releaseKey(key);
      } catch (err) {
        // Ignore errors
      }
    }
  }

  updateSettings(settings) {
    if (settings.typingSpeed) {
      this.defaultSpeed = settings.typingSpeed;
    }
  }
}

let instance = null;

export function getKeyboardController(settings) {
  if (!instance) {
    instance = new KeyboardController(settings);
  }
  return instance;
}

export { KeyboardController };
