import type { VisualDef } from './manifest';

const ROOT = 'models/creatures/fantasy-arena';
/** Release bodies keep the encounter's existing clips, attachments and phase rules. */
export const CRYPT_RELEASE_BODIES: Readonly<Record<string, string>> = {
  'models/creatures/woc_crypt_ossuary_warrior.glb': 'crypt-warrior',
  'models/creatures/woc_crypt_ossuary_cutthroat.glb': 'crypt-cutthroat',
  'models/creatures/woc_crypt_bone_brute.glb': 'crypt-bone-brute',
  'models/creatures/woc_crypt_gravecaller_adept.glb': 'crypt-adept',
  'models/creatures/woc_crypt_gravecaller_necromancer.glb': 'crypt-necromancer',
  'models/creatures/woc_crypt_hollow_chorister.glb': 'crypt-chorister',
  'models/creatures/woc_crypt_cantor_ilvane.glb': 'crypt-cantor',
  'models/creatures/woc_crypt_gargoyle.glb': 'crypt-gargoyle',
  'models/creatures/woc_crypt_knellwyrm.glb': 'crypt-knellwyrm',
  'models/creatures/woc_crypt_lady_bonechill.glb': 'crypt-lady-bonechill',
  'models/creatures/woc_crypt_ossuary_drake.glb': 'crypt-ossuary-drake',
  'models/creatures/woc_crypt_rime_egg_sac.glb': 'crypt-rime-egg-sac',
};

export function faReleaseCryptAssets(
  visuals: Record<string, VisualDef>,
  enabled: boolean,
): Record<string, VisualDef> {
  if (!enabled) return visuals;
  return Object.fromEntries(Object.entries(visuals).map(([key, def]) => {
    const replacement = CRYPT_RELEASE_BODIES[def.url.replace(/^\/+/, '')];
    return [key, replacement
      ? { ...def, url: `${ROOT}/${replacement}.glb`, authoredAtlas: false }
      : def];
  }));
}
