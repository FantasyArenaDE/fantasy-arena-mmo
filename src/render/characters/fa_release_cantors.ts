import type { VisualDef } from './manifest';

/** CC0 Quaternius-derived pilgrim: keep the NPC and its dialogue/cast contract. */
export function faReleaseLaverock(def: VisualDef, enabled: boolean): VisualDef {
  if (!enabled) return def;
  return {
    ...def,
    url: 'models/chars/players/fantasy-arena/quaternius-pilot/quaternius-male-hair-study.glb',
    animUrls: [],
    clips: {
      idle: 'Idle_Loop',
      walk: 'Walk_Loop',
      run: 'Sprint_Loop',
      attack: ['Idle_Talking_Loop'],
      death: 'Idle_Loop',
      cast: 'Spell_Simple_Idle_Loop',
      castByAbility: { cantor_last_verse: 'Spell_Simple_Idle_Loop' },
      emote: {
        point: { clips: ['Interact'] },
        cry: { clips: ['Hit_Head'] },
        kneel: { clips: ['Fixing_Kneeling'] },
      },
    },
  };
}

/** Existing KayKit CC0 mage and rig-compatible clips for the hostile caster. */
export function faReleaseCantor(def: VisualDef, enabled: boolean): VisualDef {
  if (!enabled) return def;
  return {
    ...def,
    url: 'models/chars/players/mage.glb',
    authoredAtlas: false,
    clips: {
      idle: 'Idle',
      walk: 'Walking_A',
      run: 'Running_A',
      attack: ['Spellcast_Shoot'],
      cast: 'Spellcasting',
      hit: ['Hit_A'],
      death: 'Death_A',
    },
  };
}
