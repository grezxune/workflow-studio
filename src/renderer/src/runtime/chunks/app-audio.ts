/* Renderer audio playback (notification sounds + TTS), ported from WIP app.js. */

async function playWorkflowSound({ soundId, volume = 100, repeatCount = 1, speechText = '' } = {}) {
  if (!soundId || soundId === 'none') return;

  if (soundId === 'tts') {
    await speakWorkflowText({ text: speechText, volume });
    return;
  }

  if (soundId.startsWith?.('custom:')) {
    await playCustomWorkflowSound({ soundId, volume, repeatCount });
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch (error) {
      console.warn('Failed to resume audio context:', error);
    }
  }

  const startAt = ctx.currentTime + 0.01;
  const gainBoost = Math.max(0.25, Math.min((volume || 100) / 100, 3));
  const plays = Math.max(1, Math.min(10, parseInt(repeatCount, 10) || 1));
  const repeatSpacing = 0.3;

  const patterns = {
    beep: [
      { freq: 880, duration: 0.16, type: 'sine', gain: 0.5 }
    ],
    asterisk: [
      { freq: 880, duration: 0.09, type: 'triangle', gain: 0.42 },
      { freq: 1320, duration: 0.12, type: 'triangle', gain: 0.38, offset: 0.09 }
    ],
    exclamation: [
      { freq: 740, duration: 0.09, type: 'square', gain: 0.35 },
      { freq: 988, duration: 0.14, type: 'square', gain: 0.3, offset: 0.1 }
    ],
    hand: [
      { freq: 220, duration: 0.22, type: 'sawtooth', gain: 0.26 },
      { freq: 164, duration: 0.22, type: 'sawtooth', gain: 0.22, offset: 0.02 }
    ],
    question: [
      { freq: 523.25, duration: 0.08, type: 'triangle', gain: 0.34 },
      { freq: 659.25, duration: 0.08, type: 'triangle', gain: 0.34, offset: 0.08 },
      { freq: 783.99, duration: 0.12, type: 'triangle', gain: 0.3, offset: 0.16 }
    ],
    ping: [
      { freq: 1046.5, duration: 0.08, type: 'sine', gain: 0.46 },
      { freq: 1318.5, duration: 0.18, type: 'sine', gain: 0.24, offset: 0.05 }
    ],
    success: [
      { freq: 523.25, duration: 0.07, type: 'triangle', gain: 0.3 },
      { freq: 659.25, duration: 0.08, type: 'triangle', gain: 0.34, offset: 0.08 },
      { freq: 783.99, duration: 0.12, type: 'triangle', gain: 0.38, offset: 0.16 }
    ],
    warning: [
      { freq: 660, duration: 0.14, type: 'square', gain: 0.3 },
      { freq: 560, duration: 0.14, type: 'square', gain: 0.26, offset: 0.16 }
    ],
    alarm: [
      { freq: 880, duration: 0.16, type: 'square', gain: 0.36 },
      { freq: 698.46, duration: 0.16, type: 'square', gain: 0.32, offset: 0.18 }
    ],
    radar: [
      { freq: 440, duration: 0.08, type: 'sine', gain: 0.18 },
      { freq: 660, duration: 0.08, type: 'sine', gain: 0.22, offset: 0.1 },
      { freq: 880, duration: 0.08, type: 'sine', gain: 0.26, offset: 0.2 }
    ],
    powerup: [
      { freq: 392, duration: 0.08, type: 'triangle', gain: 0.28 },
      { freq: 523.25, duration: 0.08, type: 'triangle', gain: 0.32, offset: 0.08 },
      { freq: 659.25, duration: 0.08, type: 'triangle', gain: 0.36, offset: 0.16 },
      { freq: 783.99, duration: 0.12, type: 'triangle', gain: 0.4, offset: 0.24 }
    ]
  };

  const sequence = patterns[soundId] || patterns.beep;
  for (let playIndex = 0; playIndex < plays; playIndex++) {
    const repeatOffset = playIndex * repeatSpacing;
    sequence.forEach((tone) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const toneStart = startAt + repeatOffset + (tone.offset || 0);
      const peak = Math.min(tone.gain * gainBoost, 1.5);

      oscillator.type = tone.type || 'sine';
      oscillator.frequency.setValueAtTime(tone.freq, toneStart);
      gainNode.gain.setValueAtTime(0.0001, toneStart);
      gainNode.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), toneStart + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, toneStart + tone.duration);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(toneStart);
      oscillator.stop(toneStart + tone.duration + 0.02);
    });
  }
}

async function playCustomWorkflowSound({ soundId, volume = 100, repeatCount = 1 } = {}) {
  const sound = (editorState?.systemSounds || []).find?.((item) => item.id === soundId);
  if (!sound?.path) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch (error) {
      console.warn('Failed to resume audio context for custom sound:', error);
    }
  }

  const plays = Math.max(1, Math.min(10, parseInt(repeatCount, 10) || 1));
  const gain = Math.max(0.1, Math.min((volume || 100) / 100, 5));

  for (let index = 0; index < plays; index++) {
    await new Promise((resolve) => {
      const audio = new Audio(pathToFileUrl(sound.path));
      audio.volume = 1;
      const source = ctx.createMediaElementSource(audio);
      const gainNode = ctx.createGain();
      gainNode.gain.value = gain;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      const cleanup = () => {
        try {
          source.disconnect();
          gainNode.disconnect();
        } catch {}
        resolve();
      };
      audio.addEventListener('ended', cleanup, { once: true });
      audio.addEventListener('error', cleanup, { once: true });

      audio.play().catch((error) => {
        console.warn('Failed to play custom sound:', error);
        resolve();
      });
    });
  }
}

async function speakWorkflowText({ text, volume = 100 } = {}) {
  if (!text?.trim()) return;

  try {
    const result = await window.workflowAPI.speakText?.({ text: text.trim(), volume });
    if (result?.success) {
      return;
    }
  } catch (error) {
    console.warn('Platform TTS failed, falling back to browser speech:', error);
  }

  if (!window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.volume = Math.max(0.1, Math.min((volume || 100) / 100, 1));
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function pathToFileUrl(filePath) {
  const normalized = String(filePath).replace(/\\/g, '/');
  return normalized.startsWith('file://') ? normalized : `file:///${encodeURI(normalized)}`;
}

window.playWorkflowSound = playWorkflowSound;

/**
 * Update execution state in UI
 */
