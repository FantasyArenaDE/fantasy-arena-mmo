import { FA_RELEASE_BEARD_IDS, faReleaseBeardStyle } from '../render/characters/fa_release_beard_core';
import {
  FA_RELEASE_BROWS,
  FA_RELEASE_MOUTHS,
  FA_RELEASE_NOSES,
  faReleaseBrowId,
  faReleaseMouthId,
  faReleaseNoseId,
} from '../render/characters/fa_release_face_options';
import { FA_PROXY_HAIR_LABELS, faReleaseHairId, faReleaseHairStyles } from '../render/characters/fa_release_hair_core';
import {
  FA_RELEASE_EAR_PIERCING_IDS,
  FA_RELEASE_EAR_PIERCING_LABELS,
  FA_RELEASE_NOSE_PIERCING_IDS,
  faReleaseEarPiercingId,
  faReleaseNosePiercingId,
} from '../render/characters/fa_release_piercing_core';
import {
  BLUSH_SHADES,
  blushColor,
  EARRING_MATERIAL_IDS,
  EARRING_MATERIALS,
  LIP_SHADES,
  lipColor,
  type ModularAppearance,
  normalizeAppearance,
  SHADOW_SHADES,
  shadowColor,
} from '../render/characters/modular';
import {
  FA_BODY_TATTOOS,
  FA_FACE_SCARS,
  FA_FACE_TATTOOS,
  FA_FRECKLES,
  sanitizeAppearance,
} from '../world_api/appearance';
import { releaseColorSections } from './fa_release_color_options';
import {
  categoryLabelKey,
  categorySections,
  morphSlider,
  randomizeFace,
  readFace,
  resetFace,
  type WocBuilderCategory,
  type WocBuilderPage,
  type WocBuilderSection,
  type WocFaceAppearance,
  type WocOptionTarget,
} from './woc_head_builder_model';

export const FA_RELEASE_BUILDER_CATEGORIES: readonly WocBuilderCategory[] = [
  'bodyType',
  'face',
  'eyesBrows',
  'skinTone',
  'eyeColor',
  'hairstyle',
  'hairColor',
  'browColor',
  'facialHair',
  'piercings',
  'makeup',
  'tattoos',
  'faceMarks',
];

export function releaseCategoryLabelKey(page: WocBuilderPage): string {
  if (page === 'browColor') return 'auth.faLooks.browColor';
  if (page === 'facialHair') return 'auth.faLooks.beard';
  if (page === 'makeup') return 'auth.faLooks.makeup';
  if (page === 'tattoos') return 'auth.faLooks.tattoos';
  if (page === 'faceMarks') return 'auth.faLooks.faceMarks';
  return categoryLabelKey(page);
}

const hairLabels: Readonly<Record<string, string>> = {
  undercut: 'auth.hairSidepart',
  topknot: 'auth.faLooks.doubleBuns',
  bald: 'auth.hairBald',
  fa_buzz: 'auth.hairBuzz',
  fa_long: 'auth.wocHead.hair.long',
  fa_bob: 'auth.hairChinbob',
} as const;
const eyePresets = {
  default: { eyeSpacing: 0, eyeSize: 0, eyeTilt: 0 },
  almond: { eyeSpacing: 0.35, eyeSize: -0.25, eyeTilt: 0.9 },
  hooded: { eyeSpacing: -0.35, eyeSize: -0.85, eyeTilt: -0.3 },
} as const;
const eyeStyles = ['default', 'almond', 'hooded'] as const;

const presets = {
  soft: { chinWidth: 0.95, headNose: 'default' },
  classic: { chinWidth: 0.65, headNose: 'default' },
  defined: { chinWidth: 0.25, headNose: 'aquiline' },
} as const;
const facePresets = ['soft', 'classic', 'defined'] as const;

function choice<T extends string>(value: unknown, ids: readonly T[]): T | undefined {
  return ids.find((id) => id === value);
}

function options<T extends string>(
  target: WocOptionTarget,
  labelKey: string | null,
  ids: readonly T[],
  selected: string | undefined,
  labelOf: (id: T) => string,
  colorOf?: (id: T) => number | null,
): WocBuilderSection {
  return {
    kind: 'options',
    target,
    labelKey,
    options: ids.map((id) => ({
      id,
      labelKey: labelOf(id),
      selected: id === selected,
      color: colorOf?.(id) ?? undefined,
    })),
  };
}

function shadeLabel(id: string): string {
  if (id === 'none') return 'auth.makeupNone';
  return `auth.shade${id[0].toUpperCase()}${id.slice(1)}`;
}

function tattooLabel(id: string): string {
  return ['none', 'streaks', 'crest', 'bands', 'sigil'].includes(id)
    ? `auth.faLooks.tattoo.${id}`
    : `auth.faCosmetics.tattoo.${id}`;
}

export function releaseCategorySections(
  page: WocBuilderPage,
  appearance: WocFaceAppearance,
  stored: ModularAppearance,
): WocBuilderSection[] {
  switch (page) {
    case 'hairstyle':
      return [
        options(
          'hair',
          null,
          faReleaseHairStyles(appearance.gender),
          faReleaseHairId(appearance.gender, stored.headHair),
          (id) => FA_PROXY_HAIR_LABELS.get(id) ?? hairLabels[id],
        ),
      ];
    case 'face': {
      const nose = faReleaseNoseId(stored.headNose);
      const preset = facePresets.find((id) => {
        const candidate = presets[id];
        return (
          candidate.headNose === nose &&
          Math.abs(candidate.chinWidth - appearance.headShape.chinWidth) < 0.0001
        );
      });
      return [
        options(
          'facePreset',
          'auth.faLooks.facePreset',
          facePresets,
          preset,
          (id) => `auth.faLooks.preset.${id}`,
        ),
        options(
          'nose',
          'auth.wocBuilder.section.nose',
          FA_RELEASE_NOSES,
          nose,
          (id) => `auth.wocHead.nose.${id.replace(/^fa_/, '')}`,
        ),
        options(
          'mouth',
          'auth.wocBuilder.section.mouth',
          FA_RELEASE_MOUTHS,
          faReleaseMouthId(stored.headMouth),
          (id) => `auth.wocHead.mouth.${id.replace(/^fa_/, '')}`,
        ),
        morphSlider(appearance, 'chinWidth'),
      ];
    }
    case 'eyesBrows': {
      const { eyeSpacing, eyeSize, eyeTilt } = appearance.headShape;
      const eyeStyle = eyeStyles.find((id) => {
        const preset = eyePresets[id];
        return preset.eyeSpacing === eyeSpacing && preset.eyeSize === eyeSize && preset.eyeTilt === eyeTilt;
      });
      return [
        options('eyes', 'auth.wocBuilder.section.eyes', eyeStyles, eyeStyle, (id) => `auth.wocHead.eyes.${id}`),
        options(
          'brows',
          'auth.wocBuilder.section.brows',
          FA_RELEASE_BROWS,
          faReleaseBrowId(stored.headBrows),
          (id) => `auth.wocHead.brows.${id.replace(/^fa_/, '')}`,
        ),
        morphSlider(appearance, 'eyeSpacing'),
        morphSlider(appearance, 'eyeSize'),
        morphSlider(appearance, 'eyeTilt'),
        morphSlider(appearance, 'browHeight'),
      ];
    }
    case 'skinTone':
    case 'eyeColor':
    case 'hairColor':
    case 'browColor':
      return releaseColorSections(page, appearance);
    case 'facialHair':
      return [
        options(
          'beard',
          null,
          FA_RELEASE_BEARD_IDS,
          faReleaseBeardStyle(stored.headBeard),
          (id) => id.startsWith('fa_') ? `auth.faCosmetics.beard.${id}` : `auth.wocHead.beard.${id}`,
        ),
      ];
    case 'piercings':
      return [
        options(
          'piercing',
          'auth.faLooks.earJewelry',
          FA_RELEASE_EAR_PIERCING_IDS,
          faReleaseEarPiercingId(stored.headPiercing),
          (id) => FA_RELEASE_EAR_PIERCING_LABELS[id],
        ),
        options(
          'nosePiercing',
          'auth.faLooks.noseJewelry',
          FA_RELEASE_NOSE_PIERCING_IDS,
          faReleaseNosePiercingId(stored.headPiercing, stored.nosePiercing),
          (id) => (id === 'septum' ? 'auth.earSeptum' : 'auth.earNone'),
        ),
        options(
          'earringMaterial',
          'auth.jewelMaterial',
          EARRING_MATERIAL_IDS,
          stored.earringMaterial,
          (id) => `auth.jewel${id[0].toUpperCase()}${id.slice(1)}`,
          (id) => (id === 'default' ? null : EARRING_MATERIALS[id].color),
        ),
      ];
    case 'faceMarks':
      return [
        options('faceScar', 'auth.faLooks.scar', FA_FACE_SCARS, stored.faceScar ?? 'none', (id) => {
          if (id === 'none') return 'auth.makeupNone';
          return id === 'brow' || id === 'cheek'
            ? `auth.faLooks.scarStyle.${id}`
            : `auth.faCosmetics.scar.${id}`;
        }),
        options(
          'freckles',
          'auth.faLooks.freckles',
          FA_FRECKLES,
          stored.freckles ?? 'none',
          (id) => {
            if (id === 'none') return 'auth.makeupNone';
            return id === 'light' || id === 'dense'
              ? `auth.faLooks.freckleStyle.${id}`
              : `auth.faCosmetics.freckles.${id}`;
          },
        ),
      ];
    case 'share':
      return [{ kind: 'share', code: releaseDesignCode(stored) }];
    case 'makeup': {
      const look = normalizeAppearance(stored);
      return [
        options('lipstick', 'auth.lipstick', LIP_SHADES, look.lipstick, shadeLabel, lipColor),
        options('blush', 'auth.blush', BLUSH_SHADES, look.blush, shadeLabel, blushColor),
        options(
          'eyeshadow',
          'auth.eyeshadow',
          SHADOW_SHADES,
          look.eyeshadow,
          shadeLabel,
          shadowColor,
        ),
      ];
    }
    case 'tattoos':
      return [
        options(
          'faceTattoo',
          'auth.faLooks.faceTattoo',
          FA_FACE_TATTOOS,
          stored.faceTattoo ?? 'none',
          tattooLabel,
        ),
        options(
          'bodyTattoo',
          'auth.faLooks.bodyTattoo',
          FA_BODY_TATTOOS,
          stored.bodyTattoo ?? 'none',
          tattooLabel,
        ),
      ];
    default:
      return categorySections(page, appearance);
  }
}

/** Keep the other face morphs even when a preset or the chin slider is edited. */
function withChin(
  appearance: ModularAppearance,
  chinWidth: number,
): ModularAppearance['headShape'] {
  return { ...appearance.headShape, chinWidth };
}

/** These options use the CC0 catalog directly. In particular the Type B
 * proprietary head catalog has different nose IDs from the release rig. */
export function releaseOptionPatch(
  target: WocOptionTarget,
  id: string,
  stored: ModularAppearance,
): Partial<ModularAppearance> | undefined {
  switch (target) {
    case 'hair': {
      const hair = choice(id, faReleaseHairStyles(stored.gender));
      return hair ? { headHair: hair } : undefined;
    }
    case 'facePreset': {
      const key = choice(id, facePresets);
      if (!key) return;
      const preset = presets[key];
      return { headNose: preset.headNose, headShape: withChin(stored, preset.chinWidth) };
    }
    case 'nose':
      return { headNose: faReleaseNoseId(id) };
    case 'mouth':
      return { headMouth: faReleaseMouthId(id) };
    case 'eyes': {
      const key = choice(id, eyeStyles);
      return key ? { headShape: { ...stored.headShape, ...eyePresets[key] } } : undefined;
    }
    case 'brows':
      return { headBrows: faReleaseBrowId(id) };
    case 'beard':
      return { headBeard: faReleaseBeardStyle(id) };
    case 'piercing':
      return {
        headPiercing: faReleaseEarPiercingId(id),
        nosePiercing: faReleaseNosePiercingId(stored.headPiercing, stored.nosePiercing),
      };
    case 'nosePiercing':
      return { nosePiercing: id === 'septum' ? 'septum' : 'none' };
    case 'earringMaterial': {
      const material = choice(id, EARRING_MATERIAL_IDS);
      return material ? { earringMaterial: material } : undefined;
    }
    case 'faceScar':
      return { faceScar: choice(id, FA_FACE_SCARS) ?? 'none' };
    case 'freckles':
      return { freckles: choice(id, FA_FRECKLES) ?? 'none' };
    case 'lipstick':
      return { lipstick: choice(id, LIP_SHADES) ?? 'none' };
    case 'blush':
      return { blush: choice(id, BLUSH_SHADES) ?? 'none' };
    case 'eyeshadow':
      return { eyeshadow: choice(id, SHADOW_SHADES) ?? 'none' };
    case 'faceTattoo':
      return { faceTattoo: choice(id, FA_FACE_TATTOOS) ?? 'none' };
    case 'bodyTattoo':
      return { bodyTattoo: choice(id, FA_BODY_TATTOOS) ?? 'none' };
    default:
      return undefined;
  }
}

const editableFields = [
  'gender',
  'bodyScale',
  'headHair',
  'skinHue',
  'skinSat',
  'skinLight',
  'eyeHue',
  'eyeSat',
  'eyeLight',
  'hairHue',
  'hairSat',
  'hairLight',
  'browHue',
  'browSat',
  'browLight',
] as const;

/** Change only the fields the active control actually edited. A body switch
 * must retain the old style, even if that body's original WOC catalogue would
 * have replaced it. */
export function releaseFaceChanges(
  stored: ModularAppearance,
  before: WocFaceAppearance,
  after: WocFaceAppearance,
): Partial<ModularAppearance> {
  const patch = Object.fromEntries(
    editableFields
      .filter(
        (key) =>
          before[key] !== after[key] && (key !== 'headHair' || before.gender === after.gender),
      )
      .map((key) => [key, after[key]]),
  ) as Partial<ModularAppearance>;
  const morphs = ['chinWidth', 'eyeSpacing', 'eyeSize', 'eyeTilt', 'browHeight'] as const;
  const changedMorphs = morphs.filter((key) => before.headShape[key] !== after.headShape[key]);
  if (changedMorphs.length)
    patch.headShape = {
      ...stored.headShape,
      ...Object.fromEntries(changedMorphs.map((key) => [key, after.headShape[key]])),
    };
  return patch;
}

/** Reset or share the visible controls while keeping unrelated old options. */
export function resetReleaseLook(value: ModularAppearance): ModularAppearance {
  const face = readFace(value);
  return {
    ...value,
    ...releaseFaceChanges(value, face, resetFace(face)),
    bodyScale: 1,
    headHair: faReleaseHairId(value.gender, undefined),
    headNose: 'default',
    headMouth: 'default',
    headBrows: 'relaxed',
    headBeard: 'none',
    headPiercing: 'none',
    nosePiercing: 'none',
    earringMaterial: 'default',
    lipstick: 'none',
    blush: 'none',
    eyeshadow: 'none',
    faceTattoo: 'none',
    bodyTattoo: 'none',
    faceScar: 'none',
    freckles: 'none',
  };
}

export function randomizeReleaseLook(
  value: ModularAppearance,
  random: () => number,
): ModularAppearance {
  const face = readFace(value);
  const pick = <T>(choices: readonly T[]) =>
    choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
  return {
    ...resetReleaseLook(value),
    ...releaseFaceChanges(value, face, randomizeFace(face, random)),
    bodyScale: value.bodyScale,
    headHair: pick(faReleaseHairStyles(value.gender)),
    headNose: pick(FA_RELEASE_NOSES),
    headMouth: pick(FA_RELEASE_MOUTHS),
    headBrows: pick(FA_RELEASE_BROWS),
    headBeard: pick(FA_RELEASE_BEARD_IDS),
    headPiercing: pick(FA_RELEASE_EAR_PIERCING_IDS),
    nosePiercing: pick(FA_RELEASE_NOSE_PIERCING_IDS),
    earringMaterial: pick(EARRING_MATERIAL_IDS),
    faceScar: pick(FA_FACE_SCARS),
    freckles: pick(FA_FRECKLES),
    lipstick: pick(LIP_SHADES),
    blush: pick(BLUSH_SHADES),
    eyeshadow: pick(SHADOW_SHADES),
    faceTattoo: pick(FA_FACE_TATTOOS),
    bodyTattoo: pick(FA_BODY_TATTOOS),
  };
}

function sharedReleaseLook(value: ModularAppearance): Partial<ModularAppearance> {
  const { faceTattoo, bodyTattoo, faceScar, freckles, lipstick, blush, eyeshadow } = value;
  return {
    ...Object.fromEntries(editableFields.map((key) => [key, value[key]])),
    headHair: faReleaseHairId(value.gender, value.headHair),
    headNose: faReleaseNoseId(value.headNose),
    headMouth: faReleaseMouthId(value.headMouth),
    headBrows: faReleaseBrowId(value.headBrows),
    headBeard: faReleaseBeardStyle(value.headBeard),
    headPiercing: faReleaseEarPiercingId(value.headPiercing),
    nosePiercing: faReleaseNosePiercingId(value.headPiercing, value.nosePiercing),
    earringMaterial: value.earringMaterial,
    headShape: value.headShape,
    faceTattoo,
    bodyTattoo,
    faceScar,
    freckles,
    lipstick,
    blush,
    eyeshadow,
  };
}

export function releaseDesignCode(value: ModularAppearance): string {
  return 'FA1-' + btoa(JSON.stringify(sharedReleaseLook(value)));
}

export function importReleaseDesignCode(
  code: string,
  current: ModularAppearance,
): ModularAppearance | null {
  const clean = code.trim();
  if (clean.length > 4096 || !/^FA1-[A-Za-z0-9+/]+={0,2}$/.test(clean)) return null;
  try {
    const wire = sanitizeAppearance(JSON.parse(atob(clean.slice(4))));
    if (wire?.gender !== 'male' && wire?.gender !== 'female') return null;
    const normalized = normalizeAppearance({
      ...current,
      headBrows: 'relaxed',
      ...wire,
      // FA1 codes saved before materials were selectable used the default finish.
      earringMaterial: wire.earringMaterial ?? 'default',
      // A legacy code that supplies its ear slot can also encode its septum there.
      nosePiercing: wire.nosePiercing ?? (wire.headPiercing === undefined ? current.nosePiercing : undefined),
    });
    return {
      ...current,
      ...sharedReleaseLook(normalized),
    };
  } catch {
    return null;
  }
}
