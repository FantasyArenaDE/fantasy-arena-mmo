import { getLanguage } from './i18n';

const labels = {
  'auth.faCosmetics.beard.fa_curl': ['Geschwungener Schnurrbart', 'Curled moustache'],
  'auth.faCosmetics.beard.fa_duet': ['Schnurr- und Kinnbart', 'Moustache and goatee'],
  'auth.faCosmetics.beard.fa_long': ['Langer Spitzbart', 'Long pointed beard'],
  'auth.faCosmetics.beard.fa_chops': ['Breite Koteletten', 'Mutton chops'],
  'auth.faCosmetics.beard.fa_chinstrap': ['Kinnriemenbart', 'Chinstrap beard'],
  'auth.faCosmetics.beard.fa_boxed': ['Kurzer Vollbart', 'Short full beard'],
  'auth.faCosmetics.tattoo.fangs': ['Fangzähne', 'Fangs'],
  'auth.faCosmetics.tattoo.moon': ['Mondsichel', 'Crescent moon'],
  'auth.faCosmetics.tattoo.rune': ['Schläfenrune', 'Temple rune'],
  'auth.faCosmetics.tattoo.laurel': ['Lorbeer', 'Laurel'],
  'auth.faCosmetics.tattoo.sunburst': ['Sonnenkranz', 'Sunburst'],
  'auth.faCosmetics.tattoo.knot': ['Flechtknoten', 'Woven knot'],
  'auth.faCosmetics.scar.bridge': ['Nasenrückennarbe', 'Nose bridge scar'],
  'auth.faCosmetics.scar.jaw': ['Kiefernarbe', 'Jaw scar'],
  'auth.faCosmetics.scar.temple': ['Schläfennarbe', 'Temple scar'],
  'auth.faCosmetics.freckles.nose': ['Nasenrücken', 'Nose bridge'],
  'auth.faCosmetics.freckles.sun': ['Wangen und Nase', 'Cheeks and nose'],
  'auth.faCosmetics.freckles.sparse': ['Einzelne Punkte', 'Scattered spots'],
} as const;

/** The curated editor adds labels independently of upstream locale bundles. */
export function faReleaseCosmeticLabel(key: string): string | undefined {
  if (!Object.hasOwn(labels, key)) return undefined;
  const names = labels[key as keyof typeof labels];
  return names[getLanguage() === 'de_DE' ? 0 : 1];
}
