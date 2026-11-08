const OWN_FOLEY = [
  /^(?:foot_(?:dirt|grass|snow|stone|water|wood)_[1-5]|combat_(?:block|crit|dodge|parry)_[1-3])$/,
  /^impact_(?:bone|flesh|leather|metal)_[1-4]$/,
  /^melee_(?:swing_(?:blade|heavy|light)|unarmed)_[1-7]$/,
  /^melee_bow_[1-5]$/,
  /^move_(?:(?:jump|swim)_[1-5]|land_[1-4]|splash_[1-3])$/,
];

export function releaseFoleyUrl(original: string): string {
  const name = original.match(/^\/audio\/sfx\/([a-z_]+_[1-7])\.mp3(?:\?v=[a-f0-9]{12})?$/)?.[1];
  if (!name || !OWN_FOLEY.some((pattern) => pattern.test(name))) return original;
  return `/audio/fantasy-arena/foley/${name}.wav`;
}
