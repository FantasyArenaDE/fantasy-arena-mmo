// Exact release-only substitutions. These source models are independently
// tracked in the release media ledger; no unlisted quest art is exposed.
const QUEST_REPLACEMENTS: Readonly<Record<string, string>> = {
  'models/quest/supply_crate.glb': '/models/props/crate_wooden.glb',
  'models/quest/lost_caravan_goods.glb': '/models/quest/fantasy-arena/lost-caravan-goods.glb',
  'models/quest/gravecaller_sigil.glb': '/models/quest/fantasy-arena/gravecaller-sigil.glb',
  'models/quest/gravewyrm_sigil.glb': '/models/quest/fantasy-arena/gravewyrm-sigil.glb',
  'models/quest/weathered_ledger_page.glb': '/models/quest/fantasy-arena/weathered-ledger-page.glb',
  'models/quest/morthen_grimoire.glb': '/models/weapons/fantasy-arena/bound-spellbook.glb',
  'models/quest/rusted_censer.glb': '/models/quest/fantasy-arena/rusted-censer.glb',
  'models/quest/bastion_ward_stone.glb': '/models/quest/fantasy-arena/bastion-ward-stone.glb',
  'models/quest/sanctum_key_shard.glb': '/models/quest/fantasy-arena/sanctum-key-shard.glb',
  'models/resources/wood_log_stack.glb': '/models/quest/fantasy-arena/wood-log-stack.glb',
  'models/dungeon/pumpkin_orange.glb': '/models/quest/fantasy-arena/pumpkin-orange.glb',
};

export function faReleaseQuestAsset(url: string, enabled: boolean): string {
  if (!enabled) return url;
  return QUEST_REPLACEMENTS[url.replace(/^\/+/, '')] ?? url;
}
