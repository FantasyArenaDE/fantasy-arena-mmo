/** The quest prop is also used as the Healing Tide Totem creature. Keep its
 * logical identity, but use our original model in the release build. */
export function faReleaseQuestTotemSource(url: string, enabled: boolean): string {
  if (enabled && url.replace(/^\/+/, '') === 'models/quest/ogre_war_totem.glb') {
    return 'models/quest/fantasy-arena/war-totem.glb';
  }
  return url;
}
