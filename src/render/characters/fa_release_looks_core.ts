import {
  blushColor,
  browColor,
  eyeColor,
  hairColor,
  lipColor,
  type ModularAppearance,
  normalizeAppearance,
  shadowColor,
  skinColor,
} from './modular';
import { faReleaseHairId } from './fa_release_hair_core';
import { faReleaseBeardStyle } from './fa_release_beard_core';
export { faReleaseHairId, type FaReleaseHairId } from './fa_release_hair_core';
import type { WocHeadAppearanceInput } from './woc_head_look_core';

export function faReleaseLook(fit: 'male' | 'female', app: WocHeadAppearanceInput) {
  const normalized = normalizeAppearance((app ?? null) as Partial<ModularAppearance> | null);
  const hair = faReleaseHairId(fit, app?.headHair);
  return {
    hair,
    markings: {
      faceTattoo: normalized.faceTattoo,
      bodyTattoo: normalized.bodyTattoo,
      faceScar: normalized.faceScar,
      freckles: normalized.freckles,
      beard: faReleaseBeardStyle(app?.headBeard),
      beardColor: hairColor(normalized),
      lipstick: lipColor(normalized.lipstick),
      blush: blushColor(normalized.blush),
      eyeshadow: shadowColor(normalized.eyeshadow),
    },
    colors: {
      skin: skinColor(normalized),
      eye: eyeColor(normalized),
      hair: hairColor(normalized),
      brow: browColor(normalized),
    },
  };
}

export function faReleaseLookSignature(
  fit: 'male' | 'female',
  app: WocHeadAppearanceInput,
): string {
  return faReleaseDrawnLookSignature(faReleaseLook(fit, app));
}

export function faReleaseDrawnLookSignature(look: ReturnType<typeof faReleaseLook>): string {
  const { hair, colors, markings } = look;
  return [
    hair,
    colors.skin,
    colors.eye,
    colors.hair,
    colors.brow,
    markings.faceTattoo,
    markings.bodyTattoo,
    markings.faceScar,
    markings.freckles,
    markings.beard,
    markings.lipstick,
    markings.blush,
    markings.eyeshadow,
  ].join('-');
}
