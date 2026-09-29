// Synthesized sounds (WebAudio) and haptics, honoring settings.
import { getState } from './store.js';
import { randInt } from './rng.js';

let ctx = null;

function audio() {
  try {
    if (!getState().settings.sound) return null;
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function clickAt(c, when, pitch = 1) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1400 * pitch, when);
  osc.frequency.exponentialRampToValueAtTime(500 * pitch, when + 0.045);
  gain.gain.setValueAtTime(0.18, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
  osc.connect(gain).connect(c.destination);
  osc.start(when);
  osc.stop(when + 0.07);
}

export function click() {
  try {
    const c = audio();
    if (c) clickAt(c, c.currentTime);
  } catch { /* ignore */ }
}

export function ting() {
  try {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    [[1760, 1], [2640, 0.4]].forEach(([freq, mult]) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15 * mult, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch { /* ignore */ }
}

export function rollClicks(n = 4, gap = 70) {
  try {
    const c = audio();
    if (!c) return;
    for (let i = 0; i < n; i++) {
      clickAt(c, c.currentTime + (i * gap) / 1000, 1 + randInt(-10, 10) / 100);
    }
  } catch { /* ignore */ }
}

export function vibrate(pattern) {
  try {
    if (getState().settings.vibration) navigator.vibrate?.(pattern);
  } catch { /* ignore */ }
}
