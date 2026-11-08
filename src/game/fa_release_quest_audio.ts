const QUEST_CUE = /^\/audio\/sfx\/(quest_(?:accept|ready|complete))_1\.mp3(?:\?v=[a-f0-9]{12})?$/;

/** Keep existing cue IDs and event routing while using original release audio. */
export function releaseQuestAudioUrl(original: string): string {
  const match = original.match(QUEST_CUE);
  return match ? `/audio/fantasy-arena/quest/${match[1]}.wav` : original;
}
