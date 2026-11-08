export const ADMIN_CHARACTER_PERMISSION = 'character.self.manage';
export const ADMIN_GOLD_LIMIT = 100_000;
export const ADMIN_ITEM_LIMIT = 20;

export type AdminCharacterAction =
  | { kind: 'state' | 'players' | 'log' | 'heal' | 'resource' | 'cooldowns' | 'adventurersState' }
  | { kind: 'level'; value: -1 | 1 }
  | { kind: 'gold'; value: number }
  | { kind: 'giveItem'; itemId: string; count: number }
  | { kind: 'flight' | 'god' | 'oneHit' | 'adventurers'; value: boolean }
  | { kind: 'flightSpeed' | 'runSpeed'; value: number }
  | { kind: 'visit' | 'summon'; value: number }
  | { kind: 'mapTeleport'; x: number; z: number };

export interface AdminCharacterModes {
  flight: boolean;
  flightSpeed: number;
  runSpeed: number;
  god: boolean;
  oneHit: boolean;
}

export interface AdminCharacterPlayer {
  pid: number;
  name: string;
  level: number;
}

export interface AdminCharacterLogEntry {
  kind: Exclude<AdminCharacterAction['kind'], 'state' | 'players' | 'log' | 'adventurersState'>;
  at: number;
  itemId?: string;
  count?: number;
}

export interface AdminCharacterReply {
  t: 'adminCharacter';
  id: number;
  status: 'ok' | 'blocked' | 'forbidden' | 'busy' | 'saveFailed' | 'invalidItem' | 'bagFull' | 'savePending';
  modes?: AdminCharacterModes;
  players?: AdminCharacterPlayer[];
  log?: AdminCharacterLogEntry[];
  adventurers?: AdminAdventurersState;
}

export interface AdminAdventurersState {
  enabled: boolean;
  active: number;
}

export function readAdminAdventurersState(raw: unknown): AdminAdventurersState | undefined {
  if (!raw || typeof raw !== 'object' || !('enabled' in raw) || !('active' in raw)) return;
  const { enabled, active } = raw;
  if (typeof enabled !== 'boolean' || typeof active !== 'number' ||
    !Number.isSafeInteger(active) || active < 0 || (!enabled && active !== 0)) return;
  return { enabled, active };
}

export function parseAdminCharacterAction(raw: unknown): AdminCharacterAction | null {
  if (!raw || typeof raw !== 'object' || !('kind' in raw)) return null;
  const { kind } = raw;
  const value = 'value' in raw ? raw.value : undefined;
  switch (kind) {
    case 'state':
    case 'players':
    case 'log':
    case 'heal':
    case 'resource':
    case 'cooldowns':
    case 'adventurersState':
      return { kind };
    case 'level':
      return value === -1 || value === 1 ? { kind, value } : null;
    case 'giveItem': {
      const itemId = 'itemId' in raw ? raw.itemId : undefined;
      const count = 'count' in raw ? raw.count : undefined;
      return typeof itemId === 'string' && itemId.length >= 1 && itemId.length <= 128 &&
        typeof count === 'number' && Number.isInteger(count) && count >= 1 && count <= ADMIN_ITEM_LIMIT
        ? { kind, itemId, count } : null;
    }
    case 'gold':
      return typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 1 &&
        value <= ADMIN_GOLD_LIMIT
        ? { kind, value }
        : null;
    case 'flight':
    case 'god':
    case 'oneHit':
    case 'adventurers':
      return typeof value === 'boolean' ? { kind, value } : null;
    case 'flightSpeed':
    case 'runSpeed':
      return value === 1 || value === 1.5 || value === 2 || value === 3 ? { kind, value } : null;
    case 'mapTeleport': {
      const x = 'x' in raw ? raw.x : undefined;
      const z = 'z' in raw ? raw.z : undefined;
      return typeof x === 'number' &&
        Number.isFinite(x) &&
        typeof z === 'number' &&
        Number.isFinite(z)
        ? { kind, x, z }
        : null;
    }
    case 'visit':
    case 'summon':
      return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
        ? { kind, value }
        : null;
    default:
      return null;
  }
}
