import { isDreamdancerQuestWeapon } from '../../sim/content/dreamdancer';
import { weaponTypeForItem } from '../../sim/content/weapon_skin_rules';
import { CLASSES, ITEMS } from '../../sim/data';
import type { PlayerClass } from '../../sim/types';
import { FA_QUATERNIUS_FEMALE_VISUAL, FA_QUATERNIUS_MALE_VISUAL } from './fa_quaternius_pilot';
import { faReleaseClassLook } from './fa_release_class_look';
import { faReleaseHandFit } from './fa_release_hand_fit';
import type { AttachDef, VisualDef, WeaponLayoutOverride } from './manifest';
import type { NpcPropSet } from './npc_looks';

/** Active only in the explicitly curated browser build. Ordinary/dev builds keep their originals. */
export function faReleaseHumansEnabled(): boolean {
  return import.meta.env?.VITE_FA_BROWSER_RELEASE === '1';
}

function releaseBodyUrl(url: string): string {
  return url.replace('-hair-study.glb', '-hair-catalog-v3.glb');
}

export const FA_RELEASE_HUMAN_BODY_URLS = [
  releaseBodyUrl(FA_QUATERNIUS_MALE_VISUAL.url),
  releaseBodyUrl(FA_QUATERNIUS_FEMALE_VISUAL.url),
] as const;

/** Entry still waits for the two replacement bodies; missing files fail loudly. */
export function loadFaReleaseHumanEntryFiles(load: (url: string) => Promise<void>): Promise<void> {
  return Promise.all(FA_RELEASE_HUMAN_BODY_URLS.map(load)).then(() => undefined);
}

type Fit = 'male' | 'female';
const weapons: Readonly<Record<string, string>> = {
  sword: 'iron-sword',
  dagger: 'iron-dagger',
  mace: 'iron-mace',
  axe: 'iron-axe',
  staff: 'ash-staff',
  wand: 'wand',
  polearm: 'spear',
};
const twoHand: Readonly<Record<string, string>> = {
  sword: 'greatsword',
  axe: 'greataxe',
  mace: 'greatmaul',
};
const url = (name: string) => `/models/weapons/fantasy-arena/${name}.glb`;
const grip = (name: string, hand: 'hand_r' | 'hand_l', fit: Fit = 'male'): AttachDef => ({
  url: url(name),
  bone: hand,
  ...faReleaseHandFit(name, hand, fit),
  ...(name === 'dreamdancer-focus' ? { rotationX: 0, rotationY: Math.PI / 2 } : {}),
});

const classWeapons: Readonly<Record<PlayerClass, string>> = {
  warrior: 'warrior-forged-sword',
  paladin: 'paladin-sun-mace',
  hunter: 'hunter-thorn-crossbow',
  rogue: 'rogue-night-dagger',
  priest: 'priest-vigil-staff',
  shaman: 'shaman-storm-maul',
  dreamdancer: 'dreamdancer-staff',
  mage: 'mage-frostglass-staff',
  warlock: 'warlock-emberclaw-staff',
  druid: 'druid-antler-staff',
};
const classOffhands: Readonly<Partial<Record<PlayerClass, string>>> = {
  warrior: 'warrior-forged-shield',
  paladin: 'paladin-sun-shield',
  rogue: classWeapons.rogue,
  dreamdancer: 'dreamdancer-focus',
};
const dreamdancerStaffUpgrades: ReadonlySet<string> = new Set([
  'dreamdancer_moonthread_staff', 'dreamdancer_starlace_staff', 'dreamdancer_dawnveil_staff',
]);
const dreamdancerFocusUpgrades: ReadonlySet<string> = new Set([
  'dreamcatcher_silver_focus', 'dreamcatcher_nightglass_focus', 'dreamcatcher_dawnveil_focus',
]);
const swapSlots = new Map<AttachDef, { fit: Fit; starter?: string; keepWhenEmpty?: boolean }>();
function makeLayouts(fit: Fit) {
  const slot = (name: string, hand: 'hand_r' | 'hand_l', starter?: string, keepWhenEmpty = false) => {
    const attachment = grip(name, hand, fit);
    swapSlots.set(attachment, { fit, starter, keepWhenEmpty });
    return attachment;
  };
  const right = slot('iron-sword', 'hand_r');
  const left = slot('wooden-shield', 'hand_l');
  const warlockBook = slot('bound-spellbook', 'hand_l', undefined, true);
  const main = new Map<PlayerClass, AttachDef>();
  const offhand = new Map<PlayerClass, AttachDef>();
  for (const [cls, row] of Object.entries(CLASSES)) {
    const playerClass = cls as PlayerClass;
    const weapon = classWeapons[playerClass];
    main.set(playerClass, playerClass === 'hunter' ? grip(weapon, 'hand_r', fit) : slot(weapon, 'hand_r', row.startWeapon));
    const offhandWeapon = classOffhands[playerClass];
    if (offhandWeapon && row.startOffhand) {
      offhand.set(playerClass, slot(offhandWeapon, 'hand_l', row.startOffhand));
    }
  }
  return { right, left, warlockBook, main, offhand };
}
const layouts = { male: makeLayouts('male'), female: makeLayouts('female') };

/** Undefined means another rig; null means the slot has no supported model. */
export function faReleaseHumanAttachment(
  base: AttachDef,
  itemId: string | null | undefined,
): AttachDef | null | undefined {
  const slot = swapSlots.get(base);
  if (!slot) return undefined;
  const { fit, starter, keepWhenEmpty } = slot;
  const offhand = base.bone === 'hand_l';
  // The grimoire is a class prop in a free hand. Real offhands always win.
  if (!itemId) return keepWhenEmpty ? base : null;
  if (!Object.hasOwn(ITEMS, itemId)) return null;
  if (starter === itemId) return base;
  if (base === layouts[fit].main.get('dreamdancer') &&
      (dreamdancerStaffUpgrades.has(itemId) || isDreamdancerQuestWeapon(itemId))) return base;
  if (base === layouts[fit].offhand.get('dreamdancer') && dreamdancerFocusUpgrades.has(itemId)) return base;
  const item = ITEMS[itemId];
  if (item.kind === 'weapon') {
    const type = weaponTypeForItem(itemId);
    const model = type && ((item.hand === 'twohand' && twoHand[type]) || weapons[type]);
    return model ? grip(model, offhand ? 'hand_l' : 'hand_r', fit) : null;
  }
  if (
    offhand &&
    item.kind === 'armor' &&
    item.slot === 'offhand' &&
    'shield' in item &&
    item.shield
  )
    return grip('wooden-shield', 'hand_l', fit);
  if (offhand && item.kind === 'held_offhand')
    return keepWhenEmpty ? base : grip('bound-spellbook', 'hand_l', fit);
  return null;
}

export const FA_RELEASE_HUMAN_WEAPONS = [
  ...new Set([
    ...Object.values(weapons),
    ...Object.values(twoHand),
    'wooden-shield',
    'bound-spellbook',
    'hunting-crossbow',
    ...Object.values(classWeapons),
    ...Object.values(classOffhands),
  ]),
].map(url);

/** Shared CC0 body and movement with a class costume and matching held props. */
export function faReleaseHumanVisual(fit: Fit, key: string): VisualDef {
  const base = fit === 'female' ? FA_QUATERNIUS_FEMALE_VISUAL : FA_QUATERNIUS_MALE_VISUAL;
  const oneHand = /(?:warrior|paladin|shaman)/.test(key);
  const classLook = faReleaseClassLook(key, fit);
  // The existing hunter visual is a fixed crossbow: the axe stays in the real
  // inventory, while the ranged model represents this class in the world.
  const hunter = key === 'player_hunter' || key === 'player_hunter_female';
  const fitLayouts = layouts[fit];
  const main = (classLook && fitLayouts.main.get(classLook.cls)) ?? fitLayouts.right;
  const offhand =
    (classLook && fitLayouts.offhand.get(classLook.cls)) ??
    (classLook?.cls === 'warlock' ? fitLayouts.warlockBook : fitLayouts.left);
  return {
    ...base,
    url: key.startsWith('player_') ? releaseBodyUrl(base.url) : base.url,
    clips: { ...base.clips, attack: oneHand ? ['Sword_Attack'] : [] },
    faReleaseClass: classLook,
    attach: hunter ? [main] : [main, offhand],
    weaponSlots: hunter ? undefined : [0],
    offhandSlot: hunter ? undefined : 1,
  };
}

const r = (name: string) => grip(name, 'hand_r');
const l = (name: string) => grip(name, 'hand_l');
const npcProps: Record<NpcPropSet, AttachDef[]> = {
  none: [],
  staff: [r('ash-staff')],
  walking_staff: [r('ash-staff')],
  oak_stave: [r('ash-staff')],
  tome: [r('ash-staff'), l('bound-spellbook')],
  crossbow: [r('hunting-crossbow')],
  hammer: [r('iron-mace')],
  woodaxe: [r('iron-axe')],
  sword_shield: [r('iron-sword'), l('wooden-shield')],
  sword: [r('iron-sword')],
  scythe: [r('spear')],
  knife: [r('iron-dagger')],
  spear: [r('spear')],
  spear_shield: [r('spear'), l('wooden-shield')],
  hammer_shield: [r('iron-mace'), l('wooden-shield')],
  mallet: [r('iron-mace')],
  daggers: [r('iron-dagger'), l('iron-dagger')],
  axe: [r('iron-axe')],
  dark_staff: [r('ash-staff')],
  wand: [r('wand')],
};
const npcLayouts = Object.fromEntries(
  Object.entries(npcProps).map(([key, attach]) => [
    key,
    { attach, weaponSlots: undefined, offhandSlot: undefined },
  ]),
) as Record<NpcPropSet, WeaponLayoutOverride>;
export function faReleaseHumanNpcProps(prop: NpcPropSet): WeaponLayoutOverride {
  return npcLayouts[prop];
}
