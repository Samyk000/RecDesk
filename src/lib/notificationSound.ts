/**
 * RecDesk Soft & Soothing Notification Sound Synthesizer
 * Built using the Web Audio API with zero external assets or file downloads.
 * Generates an acoustic-like 528Hz Solfeggio bell chime with warm harmonic shimmer.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Plays a warm, soft dual-tone harmonic chime (528Hz + 659.25Hz).
 * Perfect for friendly, non-startling desktop reminders and meeting prompts.
 */
export function playSoftChime(volume = 0.22): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Master gain node
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    // Smooth gentle attack (15ms)
    masterGain.gain.exponentialRampToValueAtTime(Math.min(Math.max(volume, 0.05), 0.8), now + 0.015);
    // Gentle exponential decay over 0.85 seconds
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
    masterGain.connect(ctx.destination);

    // Primary Fundamental Tone: 528 Hz (Warm harmonic chime)
    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(528, now);
    // Micro pitch glide for acoustic bell realism
    osc1.frequency.exponentialRampToValueAtTime(523.25, now + 0.85);

    // Secondary Harmonic: 659.25 Hz (E5 Major Third shimmer)
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(659.25, now + 0.05);

    // Subtle third harmonic overtone for glass-like clarity (1056 Hz, softer gain)
    const osc3 = ctx.createOscillator();
    osc3.type = "triangle";
    osc3.frequency.setValueAtTime(1056, now);

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.2, now);
    overtoneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc3.connect(overtoneGain);
    overtoneGain.connect(masterGain);

    osc1.connect(masterGain);
    osc2.connect(masterGain);

    osc1.start(now);
    osc2.start(now + 0.05);
    osc3.start(now);

    osc1.stop(now + 0.9);
    osc2.stop(now + 0.9);
    osc3.stop(now + 0.9);
  } catch {
    // Graceful fallback if Web Audio is blocked or unsupported
  }
}

/**
 * Plays a gentle, satisfying double chime for completed tasks.
 */
export function playCompletionChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    masterGain.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.setValueAtTime(880.0, now + 0.12); // A5

    osc1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.65);
  } catch {
    // Fail silently
  }
}
