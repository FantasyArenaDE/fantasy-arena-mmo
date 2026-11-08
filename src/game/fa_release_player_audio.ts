/** Exact non-vocal material fall/impact feedback; these are not voice recordings. */
export function releasePlayerAudioUrl(original: string): string {
  const match = original.match(
    /^\/audio\/sfx\/(player_(?:hurt(?:_female)?_[1-5]|death(?:_female)?_[1-3]))\.mp3(?:\?v=[a-f0-9]{12})?$/,
  );
  return match ? `/audio/fantasy-arena/player/${match[1]}.wav` : original;
}
