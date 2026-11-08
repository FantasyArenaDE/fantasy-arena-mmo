interface Note {
  hz: number;
  delay: number;
  duration: number;
  gain: number;
}

const cues: Record<string, readonly Note[]> = {
  ui_duel_challenge: [
    { hz: 440, delay: 0, duration: 0.32, gain: 0.23 },
    { hz: 659.25, delay: 0.17, duration: 0.38, gain: 0.26 },
  ],
  ui_duel_countdown: [{ hz: 523.25, delay: 0, duration: 0.13, gain: 0.2 }],
  ui_duel_start: [
    { hz: 392, delay: 0, duration: 0.29, gain: 0.18 },
    { hz: 587.33, delay: 0, duration: 0.35, gain: 0.23 },
  ],
};

/** Original MMO timing cues with no media dependency. Render once into the normal SFX cache. */
export function releasePvpCueBuffer(
  ctx: Pick<BaseAudioContext, 'createBuffer' | 'sampleRate'>,
  key: string,
): AudioBuffer | null {
  if (!Object.hasOwn(cues, key)) return null;
  const notes = cues[key];
  const rate = ctx.sampleRate;
  const length = Math.ceil(rate * Math.max(...notes.map((note) => note.delay + note.duration)));
  const buffer = ctx.createBuffer(1, length, rate);
  const samples = buffer.getChannelData(0);
  for (const note of notes) {
    const start = Math.round(note.delay * rate);
    const frames = Math.floor(note.duration * rate);
    for (let i = 0; i < frames; i++) {
      const time = i / rate;
      const envelope = Math.min(1, time / 0.008) * (1 - i / frames) ** 2;
      const phase = 2 * Math.PI * note.hz * time;
      samples[start + i] += note.gain * envelope * (Math.sin(phase) + 0.24 * Math.sin(phase * 2));
    }
  }
  return buffer;
}
