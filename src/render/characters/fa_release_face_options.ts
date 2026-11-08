// IDs for the curated CC0 rigs. The fa_ prefix keeps previously stored WOC
// IDs that the release renderer never drew on their original fallback.
export const FA_RELEASE_NOSES = ['default', 'broad', 'aquiline', 'fa_button', 'fa_soft'] as const;
export const FA_RELEASE_MOUTHS = ['default', 'full', 'smirk', 'fa_thin', 'fa_narrow', 'fa_cupids_bow', 'fa_rounded'] as const;
export const FA_RELEASE_BROWS = ['relaxed', 'fa_slim', 'fa_arched', 'fa_straight', 'fa_soft_arch', 'fa_rounded'] as const;

export type FaReleaseNose = (typeof FA_RELEASE_NOSES)[number];
export type FaReleaseMouth = (typeof FA_RELEASE_MOUTHS)[number];
export type FaReleaseBrow = (typeof FA_RELEASE_BROWS)[number];

export const faReleaseNoseId = (value: unknown): FaReleaseNose =>
  FA_RELEASE_NOSES.find((id) => id === value) ?? 'default';

export const faReleaseMouthId = (value: unknown): FaReleaseMouth =>
  FA_RELEASE_MOUTHS.find((id) => id === value) ?? 'default';

export const faReleaseBrowId = (value: unknown): FaReleaseBrow =>
  FA_RELEASE_BROWS.find((id) => id === value) ?? 'relaxed';
