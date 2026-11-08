const ACHIEVEMENT_CUE = /^\/audio\/sfx\/(ui_(?:achievement|level_up))\.mp3(?:\?v=[a-f0-9]{12})?$/;

/** Release-only substitution; cue IDs and event handling stay unchanged. */
export function releaseAchievementAudioUrl(original: string): string {
  const match = original.match(ACHIEVEMENT_CUE);
  return match ? `/audio/fantasy-arena/events/${match[1]}.wav` : original;
}
