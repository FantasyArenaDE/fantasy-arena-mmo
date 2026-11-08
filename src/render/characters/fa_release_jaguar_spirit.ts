/** The pet and Zulgar's avatar must load the same spirit body in each profile. */
export function faJaguarSpiritUrl(original: string, enabled: boolean): string {
  return enabled ? 'models/creatures/fantasy-arena/jaguar-spirit.glb' : original;
}
