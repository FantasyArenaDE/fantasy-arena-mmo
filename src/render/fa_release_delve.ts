export const FA_RELEASE_DELVE_URL = '/models/props/fantasy-arena/delve-entrance.glb';

/** Only the old delve frame is redirected; all other props keep their own source. */
export function faReleaseDelveSource(url: string, enabled: boolean): string {
  return enabled && url === '/models/dungeon/delve_entrance_2.glb' ? FA_RELEASE_DELVE_URL : url;
}
