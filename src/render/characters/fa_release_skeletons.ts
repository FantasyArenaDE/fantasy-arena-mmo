import type { VisualDef } from './manifest';

const DIR = 'models/chars/fantasy-arena/skeletons';

/** Exact routes only: the CC0 1.0 KayKit bodies have the same animation rig;
 * the separately regenerated banks use those same CC0 bodies as input. */
export const FA_RELEASE_SKELETON_SOURCES: Readonly<Record<string, string>> = {
  'models/chars/enemies/skeleton_rogue.glb': `${DIR}/rogue.glb`,
  'models/chars/enemies/skeleton_warrior.glb': `${DIR}/warrior.glb`,
  'models/chars/enemies/skeleton_mage.glb': `${DIR}/mage.glb`,
  'models/chars/enemies/skeleton_rogue_hit_variety_anims.glb': `${DIR}/rogue_hit.glb`,
  'models/chars/enemies/skeleton_warrior_hit_variety_anims.glb': `${DIR}/warrior_hit.glb`,
  'models/chars/enemies/skeleton_mage_hit_variety_anims.glb': `${DIR}/mage_hit.glb`,
  'models/chars/enemies/skelboss_ability_anims.glb': `${DIR}/boss_attack.glb`,
};

export function faReleaseSkeletonEnabled(): boolean {
  return import.meta.env?.VITE_FA_BROWSER_RELEASE === '1';
}

export function faReleaseSkeletonSource(url: string, enabled: boolean): string {
  if (!enabled) return url;
  const key = url.replace(/^\/+/, '');
  return Object.hasOwn(FA_RELEASE_SKELETON_SOURCES, key) ? FA_RELEASE_SKELETON_SOURCES[key] : url;
}

/** The former body embeds weapons. The unmodified 1.0 bodies don't, so attach
 * the same CC0 KayKit weapon families at the existing named hand slots. */
export function faReleaseSkeletonArms(
  def: VisualDef,
  role: 'warrior' | 'rogue',
  enabled: boolean,
): VisualDef {
  if (!enabled) return def;
  return {
    ...def,
    attach:
      role === 'warrior'
        ? [
            { url: 'models/weapons/skeleton_blade.glb', bone: 'handslot.r' },
            { url: 'models/weapons/skeleton_shield_large_a.glb', bone: 'handslot.l' },
          ]
        : [{ url: 'models/weapons/skeleton_axe.glb', bone: 'handslot.r' }],
  };
}

export function faReleaseSkeletonMinion(def: VisualDef, enabled: boolean): VisualDef {
  if (!enabled) return def;
  const rise = 'Death_C_Skeletons_Resurrect';
  return {
    ...def,
    url: `${DIR}/minion.glb`,
    animUrls: [`${DIR}/minion_hit.glb`],
    clips: {
      idle: 'Idle',
      walk: 'Walking_A',
      run: 'Running_A',
      attack: ['Unarmed_Melee_Attack_Punch_A', 'Unarmed_Melee_Attack_Punch_B'],
      hit: ['Hit_A', 'Hit_B_Stagger'],
      death: 'Death_C_Skeletons',
      flourish: rise,
      cast: 'Spellcasting',
      entrance: rise,
    },
    oneShotsHoldAttacks: [rise],
    walkRef: undefined,
    runRef: undefined,
    authoredAtlas: undefined,
  };
}
