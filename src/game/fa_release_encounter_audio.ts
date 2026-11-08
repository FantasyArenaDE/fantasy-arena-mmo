const ENCOUNTER_CUE =
  /^\/audio\/sfx\/(hoard_tide_(?:build|rush|crash|hit)|meteor|flamestrike)\.mp3(?:\?v=[a-f0-9]{12})?$/;

/** Target only these six effects while preserving their existing gameplay cue IDs. */
export function releaseEncounterAudioUrl(original: string): string {
  const match = original.match(ENCOUNTER_CUE);
  return match ? `/audio/fantasy-arena/encounter/${match[1]}.wav` : original;
}
