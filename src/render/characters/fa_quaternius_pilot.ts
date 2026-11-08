import type { Object3D } from 'three';
import { weaponTypeForItem } from '../../sim/content/weapon_skin_rules';
import { ITEMS } from '../../sim/data';
import { FA_HUMAN_B_SHIELD, FA_HUMAN_B_SWORD } from './fa_human_b_pilot';
import type { AttachDef, VisualDef } from './manifest';

/** Local developer comparison only; this is never a saved appearance choice. */
export function faQuaterniusPilotAllowed(dev: boolean, hostname: string, search: string): boolean {
  return (
    dev &&
    ['localhost', '127.0.0.1', '[::1]'].includes(hostname.toLowerCase()) &&
    new URLSearchParams(search).get('fa-q-warrior') === '1'
  );
}

export function faQuaterniusPilotEnabled(): boolean {
  return (
    import.meta.env?.DEV === true &&
    typeof window !== 'undefined' &&
    faQuaterniusPilotAllowed(true, window.location.hostname, window.location.search)
  );
}

/** Experimental build slice: explicitly compiled, explicitly requested, loopback only. */
export function faCc0SliceAllowed(build: boolean, hostname: string, search: string): boolean {
  return (
    build &&
    ['localhost', '127.0.0.1', '[::1]'].includes(hostname.toLowerCase()) &&
    new URLSearchParams(search).get('fa-cc0-slice') === '1'
  );
}

export function faCc0SliceEnabled(): boolean {
  return (
    import.meta.env?.VITE_FA_CC0_SLICE === '1' &&
    typeof window !== 'undefined' &&
    faCc0SliceAllowed(true, window.location.hostname, window.location.search)
  );
}

export const FA_QUATERNIUS_MALE_KEY = 'player_fa_quaternius_male_pilot';
export const FA_QUATERNIUS_FEMALE_KEY = 'player_fa_quaternius_female_pilot';
export const FA_QUATERNIUS_MAGE_MALE_KEY = 'player_fa_quaternius_mage_male_pilot';
export const FA_QUATERNIUS_MAGE_FEMALE_KEY = 'player_fa_quaternius_mage_female_pilot';
export const FA_QUATERNIUS_PRIEST_MALE_KEY = 'player_fa_quaternius_priest_male_slice';
export const FA_QUATERNIUS_PRIEST_FEMALE_KEY = 'player_fa_quaternius_priest_female_slice';
export const FA_QUATERNIUS_TRADER_KEY = 'npc_fa_quaternius_trader_slice';

// The release adapter registers only keys whose original WOC def it replaced.
const releaseFits = new Map<string, 'male' | 'female'>();
export function faQuaterniusReleaseFit(key: string): 'male' | 'female' | undefined {
  return releaseFits.get(key);
}
export function faQuaterniusRegisterReleaseKey(key: string, fit: 'male' | 'female'): void {
  releaseFits.set(key, fit);
}

export function faQuaterniusPilotIsKey(key: string): boolean {
  return releaseFits.has(key) || [
    FA_QUATERNIUS_MALE_KEY,
    FA_QUATERNIUS_FEMALE_KEY,
    FA_QUATERNIUS_MAGE_MALE_KEY,
    FA_QUATERNIUS_MAGE_FEMALE_KEY,
    FA_QUATERNIUS_PRIEST_MALE_KEY,
    FA_QUATERNIUS_PRIEST_FEMALE_KEY,
    FA_QUATERNIUS_TRADER_KEY,
  ].includes(key);
}

/** Only the pilot's own models contain these independently skinned CC0 pieces. */
export function faQuaterniusPilotHair(
  key: string,
  model: Object3D,
  app: { headHair?: unknown } | null | undefined,
): boolean {
  const simple = faQuaterniusPilotHairStyle(key, app) === 'simple';
  if (!faQuaterniusPilotIsKey(key)) return false;
  let changed = false;
  model.traverse((node) => {
    const visible =
      node.name === 'FA_Hair_Simple' ? simple : node.name === 'FA_Hair_Buns' ? !simple : null;
    if (visible !== null && node.visible !== visible) {
      node.visible = visible;
      changed = true;
    }
  });
  return changed;
}

export function faQuaterniusPilotHairStyle(
  key: string,
  app: { headHair?: unknown } | null | undefined,
): 'simple' | 'buns' {
  const female = [
    FA_QUATERNIUS_FEMALE_KEY,
    FA_QUATERNIUS_MAGE_FEMALE_KEY,
    FA_QUATERNIUS_PRIEST_FEMALE_KEY,
  ].includes(key) || releaseFits.get(key) === 'female';
  // 'bob' is represented by the short parted cut in this early comparison;
  // all other B choices retain the previous buns. A retains its previous cut.
  return !female || app?.headHair === 'bob' ? 'simple' : 'buns';
}

const MAGE_STAFF: AttachDef = {
  url: '/models/weapons/fantasy-arena/ash-staff.glb',
  bone: 'hand_r',
  rotationX: Math.PI / 2,
};
const MAGE_BOOK: AttachDef = {
  url: '/models/weapons/fantasy-arena/bound-spellbook.glb',
  bone: 'hand_l',
  rotationY: Math.PI / 2,
};

/** Only these exact local-pilot attachment objects opt into this mapping. */
export function faQuaterniusPilotAttachment(
  base: AttachDef,
  itemId: string | null | undefined,
): AttachDef | null | undefined {
  if (base !== MAGE_STAFF && base !== MAGE_BOOK) return undefined;
  if (!itemId || !Object.hasOwn(ITEMS, itemId)) return null;
  const item = ITEMS[itemId];
  if (base === MAGE_STAFF) {
    return item.kind === 'weapon' && weaponTypeForItem(itemId) === 'staff' ? base : null;
  }
  return item.kind === 'held_offhand' &&
    ['voidbound_grimoire', 'sunpetal_grimoire'].includes(itemId)
    ? base
    : null;
}

function visual(sex: 'male' | 'female'): VisualDef {
  return {
    url: `/models/chars/players/fantasy-arena/quaternius-pilot/quaternius-${sex}-hair-study.glb`,
    lazyPreload: true,
    height: 2.86,
    authoredAtlas: true,
    hideWeaponsWhileSwimming: true,
    // These clips are posed around their own waterline, above the entity pivot.
    swimRise: { stroke: 0.75, tread: 0.48 },
    swimHeadHeight: 1.13,
    clips: {
      idle: 'Idle_Loop',
      walk: 'Walk_Loop',
      run: 'Sprint_Loop',
      swim: 'Swim_Fwd_Loop',
      swimSurface: 'Swim_Fwd_Loop',
      swimIdle: 'Swim_Idle_Loop',
      attack: ['Sword_Attack'],
      death: 'Death01',
      hit: ['Hit_Chest', 'Hit_Head'],
      cast: 'Spell_Simple_Shoot',
    },
    // Own FA weapons. Existing item-slot handling limits these to compatible
    // one-handed swords and shields and removes them when unequipped.
    attach: [
      { url: FA_HUMAN_B_SWORD, bone: 'hand_r', rotationX: Math.PI / 2 },
      { url: FA_HUMAN_B_SHIELD, bone: 'hand_l', rotationY: Math.PI / 2 },
    ],
    weaponSlots: [0],
    offhandSlot: 1,
  };
}

export const FA_QUATERNIUS_MALE_VISUAL = visual('male');
export const FA_QUATERNIUS_FEMALE_VISUAL = visual('female');
export const FA_QUATERNIUS_MAGE_MALE_VISUAL: VisualDef = {
  ...visual('male'),
  attach: [MAGE_STAFF, MAGE_BOOK],
};
export const FA_QUATERNIUS_MAGE_FEMALE_VISUAL: VisualDef = {
  ...visual('female'),
  attach: [MAGE_STAFF, MAGE_BOOK],
};

// No unverified sword strike for a priest wielding a staff: cast remains the
// documented spell gesture; staff melee is a known visual gap in this slice.
export const FA_QUATERNIUS_PRIEST_MALE_VISUAL: VisualDef = {
  ...FA_QUATERNIUS_MAGE_MALE_VISUAL,
  clips: { ...FA_QUATERNIUS_MAGE_MALE_VISUAL.clips, attack: [] },
};
export const FA_QUATERNIUS_PRIEST_FEMALE_VISUAL: VisualDef = {
  ...FA_QUATERNIUS_MAGE_FEMALE_VISUAL,
  clips: { ...FA_QUATERNIUS_MAGE_FEMALE_VISUAL.clips, attack: [] },
};
export const FA_QUATERNIUS_TRADER_VISUAL: VisualDef = {
  ...FA_QUATERNIUS_MALE_VISUAL,
  attach: [],
  weaponSlots: [],
  offhandSlot: undefined,
};

export function faQuaterniusPilotKey(
  cls: string,
  appearance: { gender?: unknown } | null | undefined,
): string | null {
  if (!faQuaterniusPilotEnabled() && !faCc0SliceEnabled()) return null;
  if (cls === 'priest' && faCc0SliceEnabled()) {
    return appearance?.gender === 'female'
      ? FA_QUATERNIUS_PRIEST_FEMALE_KEY
      : FA_QUATERNIUS_PRIEST_MALE_KEY;
  }
  if (cls === 'mage') {
    return appearance?.gender === 'female'
      ? FA_QUATERNIUS_MAGE_FEMALE_KEY
      : FA_QUATERNIUS_MAGE_MALE_KEY;
  }
  if (cls !== 'warrior') return null;
  return appearance?.gender === 'female' ? FA_QUATERNIUS_FEMALE_KEY : FA_QUATERNIUS_MALE_KEY;
}
