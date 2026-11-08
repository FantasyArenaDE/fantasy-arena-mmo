import {
  categorySections,
  matchSwatch,
  targetColor,
  type WocBuilderPage,
  type WocBuilderSection,
  type WocColorTarget,
  type WocFaceAppearance,
  type WocSwatch,
} from './woc_head_builder_model';

const swatch = (
  id: string,
  labelKey: string,
  hue: number,
  sat: number,
  light: number,
): WocSwatch => ({ id, labelKey, hue, sat, light });

const palettes: Readonly<Partial<Record<WocColorTarget, readonly WocSwatch[]>>> = {
  skin: [
    swatch('fa_bone', 'auth.jewelBone', 44, 0.26, 0.78),
    swatch('fa_copper', 'auth.jewelCopper', 14, 0.57, 0.51),
    swatch('fa_silver', 'auth.jewelSilver', 213, 0.15, 0.62),
    swatch('fa_verdigris', 'auth.outfitVerdigris', 151, 0.22, 0.54),
  ],
  eye: [
    swatch('fa_gold', 'auth.jewelGold', 51, 0.85, 0.59),
    swatch('fa_jade', 'auth.jewelJade', 149, 0.68, 0.44),
    swatch('fa_turquoise', 'auth.jewelTurquoise', 180, 0.77, 0.52),
    swatch('fa_ruby', 'auth.jewelRuby', 353, 0.69, 0.45),
    swatch('fa_silver', 'auth.jewelSilver', 214, 0.15, 0.72),
    swatch('fa_onyx', 'auth.outfitOnyx', 236, 0.18, 0.07),
  ],
};

/** Extend only the release builder. The normal picker writes the same HSL
 * triples for custom colours, original swatches and these presets. */
export function releaseColorSections(
  page: WocBuilderPage,
  appearance: WocFaceAppearance,
): WocBuilderSection[] {
  return categorySections(page, appearance).map((section) => {
    if (section.kind !== 'swatches') return section;
    const extra = palettes[section.target];
    if (!extra) return section;
    const { hue, sat, light } = targetColor(appearance, section.target);
    const hit = section.custom ? matchSwatch(extra, hue, sat, light) : null;
    return {
      ...section,
      custom: section.custom && !hit,
      swatches: [
        ...section.swatches,
        ...extra.map((color) => ({ ...color, selected: color.id === hit?.id })),
      ],
    };
  });
}
