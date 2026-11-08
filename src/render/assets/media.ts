import { faReleaseQuestAsset } from '../fa_release_quest_assets';
import { MEDIA_ASSETS } from './manifest.generated';

declare const __FA_RELEASE_TEXTURE_TIERS__: readonly string[];

const RELEASE_MODEL_URLS: Readonly<Record<string, string>> = {
  'models/props/willow_tree.glb': '/models/props/fantasy-arena/fen-willow.glb',
  'models/props/fen_lilies.glb': '/models/props/fantasy-arena/fen-water-lilies.glb',
  'models/props/fen_reeds.glb': '/models/props/fantasy-arena/fen-reeds.glb',
  'models/props/fen_log.glb': '/models/props/fantasy-arena/fen-fallen-log.glb',
  'models/props/reeds.glb': '/models/props/fantasy-arena/marsh-reeds.glb',
  'models/props/pixie_mushroom_house.glb': '/models/props/fantasy-arena/pixie-mushroom-house.glb',
  'models/props/crystal_amethyst_cluster.glb': '/models/props/fantasy-arena/amethyst-cluster.glb',
  'models/props/crystal_mound_cave.glb': '/models/props/fantasy-arena/crystal-mound.glb',
  'models/props/star_heart_crystal.glb': '/models/props/fantasy-arena/star-heart.glb',
  'models/props/stag_shrine.glb': '/models/props/fantasy-arena/stag-shrine.glb',
  'models/props/mushroom_giant_purple.glb': '/models/props/fantasy-arena/giant-purple-mushroom.glb',
  'models/props/mushroom_glow_cluster.glb': '/models/props/fantasy-arena/glow-mushrooms.glb',
  'models/props/flower_glow.glb': '/models/props/fantasy-arena/glow-flowers.glb',
  'models/props/fallen_coconuts.glb': '/models/props/fantasy-arena/fallen-coconuts.glb',
  'models/vfx/guttered_eye.glb': '/models/vfx/fantasy-arena/guttered-eye.glb',
  'models/vfx/muster_grapnel.glb': '/models/vfx/fantasy-arena/muster-grapnel.glb',
  'models/dungeon/banner_red.glb': '/models/biome/kcas_banner_red_a.glb',
  'models/dungeon/banner_triple_red.glb': '/models/biome/kcas_banner_red_triple.glb',
  'models/props/hollow_crypt_kit.glb': '/models/props/fantasy-arena/hollow-crypt-kit.glb',
  'models/props/crypt_rite_vfx.glb': '/models/props/fantasy-arena/crypt-rite-vfx.glb',
};

function logicalPath(url: string): string {
  return url.replace(/^\/+/, '');
}

export function assetUrl(url: string): string {
  const logical = logicalPath(
    faReleaseQuestAsset(url, import.meta.env.VITE_FA_BROWSER_RELEASE === '1'),
  );
  if (
    import.meta.env.VITE_FA_BROWSER_RELEASE === '1' &&
    Object.hasOwn(RELEASE_MODEL_URLS, logical)
  ) {
    return RELEASE_MODEL_URLS[logical];
  }
  if (import.meta.env.DEV) return `/${logical}`;
  return MEDIA_ASSETS[logical] ?? `/${logical}`;
}

/** Whether the build ships an optional texture-tier sibling of a model. */
export function mediaAssetExists(url: string): boolean {
  if (import.meta.env.VITE_FA_BROWSER_RELEASE === '1') {
    // The full project manifest also contains tiers excluded from the curated build.
    if (typeof __FA_RELEASE_TEXTURE_TIERS__ === 'undefined') return false;
    return __FA_RELEASE_TEXTURE_TIERS__.includes(assetUrl(url));
  }
  return MEDIA_ASSETS[logicalPath(url)] !== undefined;
}
