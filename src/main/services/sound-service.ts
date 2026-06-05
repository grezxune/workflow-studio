/**
 * Sound Service
 *
 * Provides a small set of platform-native notification sounds and playback helpers.
 */

import { shell } from 'electron';
import { spawn } from 'child_process';

const BUILTIN_SOUNDS = [
  { id: 'none', label: 'No sound' },
  { id: 'beep', label: 'Beep', type: 'builtin' },
  { id: 'asterisk', label: 'Asterisk', type: 'builtin' },
  { id: 'exclamation', label: 'Exclamation', type: 'builtin' },
  { id: 'hand', label: 'Hand', type: 'builtin' },
  { id: 'question', label: 'Question', type: 'builtin' },
  { id: 'ping', label: 'Ping', type: 'builtin' },
  { id: 'success', label: 'Success', type: 'builtin' },
  { id: 'warning', label: 'Warning', type: 'builtin' },
  { id: 'alarm', label: 'Alarm', type: 'builtin' },
  { id: 'radar', label: 'Radar', type: 'builtin' },
  { id: 'powerup', label: 'Power Up', type: 'builtin' },
  { id: 'tts', label: 'Speak text', type: 'tts' }
];

class SoundService {
  getAvailableSounds() {
    return BUILTIN_SOUNDS;
  }

  async playSound(soundId) {
    if (!soundId || soundId === 'none') return { success: true, skipped: true };

    try {
      if (process.platform === 'win32') {
        await this.playWindowsSound(soundId);
      } else if (process.platform === 'darwin') {
        await this.playMacSound(soundId);
      } else {
        await this.playLinuxSound(soundId);
      }

      return { success: true };
    } catch (error) {
      console.warn('[Sound] Falling back to shell.beep():', error.message);
      try {
        shell.beep();
        return { success: true, fallback: true };
      } catch (fallbackError) {
        return { success: false, error: fallbackError.message };
      }
    }
  }

  async speakText(text, volume = 100) {
    const safeText = String(text || '').trim();
    if (!safeText) {
      return { success: true, skipped: true };
    }

    try {
      if (process.platform === 'win32') {
        const escaped = safeText.replace(/'/g, "''");
        const clampedVolume = Math.max(0, Math.min(100, Math.round(volume || 100)));
        const script = [
          'Add-Type -AssemblyName System.Speech',
          '$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer',
          `$synth.Volume = ${clampedVolume}`,
          `$synth.Speak('${escaped}')`
        ].join('; ');
        await this.spawnCommand('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
        return { success: true };
      }

      if (process.platform === 'darwin') {
        await this.spawnCommand('say', [safeText]);
        return { success: true };
      }

      await this.spawnCommand('espeak', ['-a', String(Math.max(0, Math.min(200, Math.round(volume || 100)))), safeText]);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async playWindowsSound(soundId) {
    const soundName = {
      asterisk: 'Asterisk',
      exclamation: 'Exclamation',
      hand: 'Hand',
      question: 'Question',
      beep: 'Beep'
    }[soundId];

    if (!soundName) {
      throw new Error(`Unsupported Windows sound: ${soundId}`);
    }

    const script = `[System.Media.SystemSounds]::${soundName}.Play()`;
    await this.spawnCommand('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
  }

  async playMacSound(soundId) {
    const fileName = {
      basso: 'Basso',
      glass: 'Glass',
      hero: 'Hero',
      ping: 'Ping',
      pop: 'Pop',
      submarine: 'Submarine'
    }[soundId];

    if (!fileName) {
      throw new Error(`Unsupported macOS sound: ${soundId}`);
    }

    await this.spawnCommand('afplay', [`/System/Library/Sounds/${fileName}.aiff`]);
  }

  async playLinuxSound(soundId) {
    const canberraId = {
      bell: 'bell',
      complete: 'complete',
      warning: 'dialog-warning',
      error: 'dialog-error'
    }[soundId];

    if (!canberraId) {
      throw new Error(`Unsupported Linux sound: ${soundId}`);
    }

    await this.spawnCommand('canberra-gtk-play', ['-i', canberraId]);
  }

  spawnCommand(command, args) {
    return new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'ignore',
        windowsHide: true
      });

      child.once('error', reject);
      child.once('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`${command} exited with code ${code}`));
        }
      });
    });
  }
}

let instance: SoundService | null = null;

export function getSoundService() {
  if (!instance) {
    instance = new SoundService();
  }
  return instance;
}

export { SoundService };
