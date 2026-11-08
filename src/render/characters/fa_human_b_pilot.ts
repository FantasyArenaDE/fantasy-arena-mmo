import { weaponTypeForItem } from '../../sim/content/weapon_skin_rules';
import { ITEMS } from '../../sim/data';
import type { AttachDef, VisualDef } from './manifest';

export const FA_HUMAN_B_KEY = 'player_fa_human_b_pilot';
export const FA_HUMAN_B_SWORD = '/models/weapons/fantasy-arena/iron-sword.glb';
export const FA_HUMAN_B_SHIELD = '/models/weapons/fantasy-arena/wooden-shield.glb';

/** Undefined means this is not the pilot slot; null means the slot is unsupported or empty. */
export function faHumanBPilotAttachment(
  base: AttachDef,
  itemId: string | null | undefined,
): AttachDef | null | undefined {
  if (base.url !== FA_HUMAN_B_SWORD && base.url !== FA_HUMAN_B_SHIELD) return undefined;
  if (!itemId || !Object.hasOwn(ITEMS, itemId)) return null;
  const item = ITEMS[itemId];
  if (base.url === FA_HUMAN_B_SWORD) {
    return item.kind === 'weapon' &&
      item.hand !== 'twohand' &&
      weaponTypeForItem(itemId) === 'sword'
      ? base
      : null;
  }
  return item.kind === 'armor' &&
    item.slot === 'offhand' &&
    'shield' in item &&
    item.shield === true
    ? base
    : null;
}

/** A local, development-only visual trial. It is never a saved character choice. */
export function faHumanBPilotAllowed(dev: boolean, hostname: string, search: string): boolean {
  return (
    dev &&
    ['localhost', '127.0.0.1', '[::1]'].includes(hostname.toLowerCase()) &&
    new URLSearchParams(search).get('fa-human-b') === '1'
  );
}

export function faHumanBPilotEnabled(): boolean {
  return (
    import.meta.env?.DEV === true &&
    typeof window !== 'undefined' &&
    faHumanBPilotAllowed(true, window.location.hostname, window.location.search)
  );
}

export function faHumanBPilotMatches(
  cls: string,
  appearance: { gender?: unknown } | null | undefined,
): boolean {
  return cls === 'warrior' && appearance?.gender === 'female' && faHumanBPilotEnabled();
}

/** This pilot has baked clothing; only its one-handed sword and shield are illustrated. */
export const FA_HUMAN_B_VISUAL: VisualDef = {
  url: '/models/chars/players/fantasy-arena/human-b.glb',
  animUrls: [
    '/models/chars/players/fantasy-arena/human-b-idle.glb',
    '/models/chars/players/fantasy-arena/human-b-walk.glb',
    '/models/chars/players/fantasy-arena/human-b-run.glb',
    '/models/chars/players/fantasy-arena/human-b-attack.glb',
  ],
  lazyPreload: true,
  height: 2.86,
  authoredAtlas: true,
  clips: {
    idle: 'Armature|Idle_02|baselayer',
    walk: 'Armature|walking_man|baselayer',
    run: 'Armature|running|baselayer',
    attack: ['Armature|Right_Hand_Sword_Slash|baselayer'],
    death: 'Armature|Idle_02|baselayer',
  },
  attach: [
    // The Meshy armature uses centimetres; offsets move the grips from wrist to palm.
    {
      url: FA_HUMAN_B_SWORD,
      bone: 'RightHand',
      position: [0, 9, 0],
      rotationX: Math.PI / 2,
      boneScale: 100,
    },
    {
      url: FA_HUMAN_B_SHIELD,
      bone: 'LeftHand',
      position: [0, 10, 0],
      rotationY: Math.PI / 2,
      boneScale: 100,
    },
  ],
  weaponSlots: [0],
  offhandSlot: 1,
};
