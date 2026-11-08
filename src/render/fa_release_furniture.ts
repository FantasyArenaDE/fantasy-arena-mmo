/** Only these exact furniture/banner assets are routed to original FA models. */
const FURNITURE_NAMES = [
  'banner_shield_green',
  'bed_decorated',
  'bed_b_double',
  'bed_b_single',
  'bed_a_stacked',
  'bed_a_single',
  'bed_floor',
  'chair',
  'stool',
  'stool_round',
  'table_round_small',
  'table_round_medium',
  'table_long_tablecloth',
  'shelf_large',
  'shelf_small',
  'shelf_small_books',
  'shelf_small_candles',
  'bar_straight_a',
  'bar_straight_b',
  'bar_straight_c',
  'bartop_a_medium',
  'crate_large',
  'crate_small',
] as const;

export const FA_RELEASE_FURNITURE: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    FURNITURE_NAMES.map((name) => [
      `/models/dungeon/${name}.glb`,
      `/models/props/fantasy-arena/furniture/${name}.glb`,
    ]),
  ),
);

export function faReleaseFurnitureSource(url: string, enabled: boolean): string {
  return enabled && Object.hasOwn(FA_RELEASE_FURNITURE, url) ? FA_RELEASE_FURNITURE[url] : url;
}
