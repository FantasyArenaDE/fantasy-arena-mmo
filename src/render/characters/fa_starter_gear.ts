/** Local preview only: logical item paths and their grip metadata remain unchanged. */
export const FA_STARTER_GEAR: Readonly<Record<string, string>> = {
  'models/weapons/sword_starter.glb': 'models/weapons/fantasy-arena/iron-sword.glb',
  'models/weapons/shield_starter.glb': 'models/weapons/fantasy-arena/wooden-shield.glb',
  'models/weapons/dagger_starter.glb': 'models/weapons/fantasy-arena/iron-dagger.glb',
  'models/weapons/hammer_starter.glb': 'models/weapons/fantasy-arena/iron-mace.glb',
  'models/weapons/axe_starter.glb': 'models/weapons/fantasy-arena/iron-axe.glb',
  'models/weapons/staff_starter.glb': 'models/weapons/fantasy-arena/ash-staff.glb',
  'models/weapons/crossbow_starter.glb': 'models/weapons/fantasy-arena/hunting-crossbow.glb',
  'models/weapons/spellbook_starter.glb': 'models/weapons/fantasy-arena/bound-spellbook.glb',
};

export function faStarterGearAllowed(dev: boolean, hostname: string, search: string): boolean {
  return (
    dev &&
    ['localhost', '127.0.0.1', '[::1]'].includes(hostname.toLowerCase()) &&
    new URLSearchParams(search).get('fa-starter-gear') === '1'
  );
}

export function faStarterGearEnabled(): boolean {
  return (
    import.meta.env?.DEV === true &&
    typeof window !== 'undefined' &&
    faStarterGearAllowed(true, window.location.hostname, window.location.search)
  );
}

export function faStarterGearSource(url: string, enabled: boolean): string {
  if (!enabled) return url;
  const logical = url.startsWith('/') ? url.slice(1) : url;
  return Object.hasOwn(FA_STARTER_GEAR, logical) ? FA_STARTER_GEAR[logical] : url;
}
