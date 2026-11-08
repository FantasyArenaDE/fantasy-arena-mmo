import type { AdminCharacterModes } from '../admin_character_wire';
import { isRooted, isStunned } from './combat/cc';
import {
  dungeonAt,
  isArenaPos,
  isBgPos,
  isDelvePos,
  isRiftPos,
  isYumiMazePos,
  zoneAt,
} from './data';
import { deckCeilingAt } from './deck_ceiling';
import { sheetCeilingAt } from './ground_sheet_queries';
import type { SimContext } from './sim_context';
import {
  DT,
  type Entity,
  type MoveInput,
  normAngle,
  RUN_SPEED,
  TURN_SPEED,
  type Vec3,
} from './types';
import { groundHeightAtBody } from './world';

interface Modes extends AdminCharacterModes {
  anchor?: Vec3;
  position?: Vec3;
  expiresAt: number;
}

const active = new WeakMap<Entity, Modes>();
const defaults: AdminCharacterModes = {
  flight: false,
  flightSpeed: 1,
  runSpeed: 1,
  god: false,
  oneHit: false,
};

export function adminModes(e: Entity): Readonly<AdminCharacterModes> {
  const modes = active.get(e);
  return modes
    ? {
        flight: modes.flight,
        flightSpeed: modes.flightSpeed,
        runSpeed: modes.runSpeed,
        god: modes.god,
        oneHit: modes.oneHit,
      }
    : defaults;
}

export function setAdminMode<K extends keyof AdminCharacterModes>(
  ctx: SimContext,
  e: Entity,
  key: K,
  value: AdminCharacterModes[K],
): void {
  const modes = active.get(e) ?? { ...defaults, expiresAt: 0 };
  modes.expiresAt = ctx.time + 300;
  if (key === 'flight' && value === true && !modes.flight) {
    modes.anchor = { ...e.pos };
    modes.position = e.pos;
  }
  const state: AdminCharacterModes = modes;
  state[key] = value;
  active.set(e, modes);
}

export function adminOverworld(pos: Vec3): boolean {
  const { x, z } = pos;
  return (
    !isArenaPos(x) &&
    !isBgPos(x) &&
    !isDelvePos(x) &&
    !isRiftPos(x) &&
    !isYumiMazePos(x) &&
    !dungeonAt(x) &&
    zoneAt(x, z).worldPvp !== 'ffa'
  );
}

export function adminModesAllowed(ctx: SimContext, e: Entity): boolean {
  return (
    !e.dead &&
    !e.jailed &&
    !e.pvpFlag &&
    !e.ferryRide &&
    !ctx.duels.has(e.id) &&
    !ctx.players.get(e.id)?.mountRace &&
    adminOverworld(e.pos)
  );
}

export function adminCombatMode(ctx: SimContext, e: Entity, key: 'god' | 'oneHit'): boolean {
  const modes = active.get(e);
  return !!modes?.[key] && modes.expiresAt > ctx.time &&
    (key === 'oneHit' ? !e.dead && !e.jailed : adminModesAllowed(ctx, e));
}

export function adminRunMultiplier(ctx: SimContext, e: Entity): number {
  const modes = active.get(e);
  return modes && modes.runSpeed !== 1 && modes.expiresAt > ctx.time && adminModesAllowed(ctx, e)
    ? modes.runSpeed
    : 1;
}

export function adminFlightAnchor(e: Entity): Vec3 | undefined {
  const modes = active.get(e);
  return modes?.position === e.pos ? modes.anchor : undefined;
}

export function landAdminFlight(ctx: SimContext, e: Entity): void {
  const modes = active.get(e);
  if (!modes?.flight) return;
  const anchor = adminFlightAnchor(e);
  discardAdminFlight(e);
  if (!anchor || e.dead) return;
  e.pos = ctx.groundPos(e.pos.x, e.pos.z);
  e.prevPos = { ...e.pos };
  e.fallStartY = e.pos.y;
  e.onGround = true;
  e.jumping = false;
  e.vx = e.vy = e.vz = 0;
  ctx.rebucket(e);
}

export function discardAdminFlight(e: Entity): void {
  const modes = active.get(e);
  if (!modes?.flight) return;
  modes.flight = false;
  delete modes.anchor;
  delete modes.position;
}

export function clearAdminModes(ctx: SimContext, e: Entity): void {
  landAdminFlight(ctx, e);
  active.delete(e);
}

export function expireAdminModes(ctx: SimContext, e: Entity): void {
  const modes = active.get(e);
  if (modes && (e.dead || modes.expiresAt <= ctx.time)) clearAdminModes(ctx, e);
}

export function hasAdminFlight(e: Entity): boolean {
  return active.get(e)?.flight === true;
}

export function adminFlightBlocked(e: Entity): boolean {
  return (
    !!e.mountKey ||
    !!e.mountCastRemaining ||
    !!e.carriedBy ||
    !!e.ferryRide ||
    e.chargeTargetId !== null ||
    e.followTargetId !== null ||
    !!e.leap ||
    !!e.valkyrsCalling ||
    !!e.climb ||
    !!e.bracing ||
    isRooted(e) ||
    isStunned(e)
  );
}

export function stepAdminFlight(
  ctx: SimContext,
  e: Entity,
  input: MoveInput,
  seed: number,
  resolve: (x: number, z: number) => { x: number; z: number },
  blocked: boolean,
): boolean {
  const modes = active.get(e);
  if (!modes?.anchor) return false;
  if (modes.position !== e.pos) {
    discardAdminFlight(e);
    return false;
  }
  if (blocked || adminFlightBlocked(e) || e.inCombat || !adminModesAllowed(ctx, e)) {
    landAdminFlight(ctx, e);
    return false;
  }
  const turn = Number(input.turnLeft) - Number(input.turnRight);
  e.facing = normAngle(e.facing + turn * TURN_SPEED * DT);
  const forward = Number(input.forward) - Number(input.back);
  const strafe = Number(input.strafeRight) - Number(input.strafeLeft);
  const speed = RUN_SPEED * modes.flightSpeed;
  const scale = (speed * DT) / Math.max(1, Math.hypot(forward, strafe));
  const dx = (forward * Math.sin(e.facing) - strafe * Math.cos(e.facing)) * scale;
  const dz = (forward * Math.cos(e.facing) + strafe * Math.sin(e.facing)) * scale;
  const next = resolve(e.pos.x + dx, e.pos.z + dz);
  const vertical = Number(input.jump || input.surface) - Number(input.dive);
  const floor = groundHeightAtBody(next.x, next.z, seed, e.pos.y);
  const ceiling = Math.min(
    sheetCeilingAt(next.x, next.z, seed, e.pos.y),
    deckCeilingAt(seed, next.x, next.z, e.pos.y),
  );
  const minY = floor + 0.5;
  const maxY = Math.min(floor + 1000, ceiling - 2);
  if (
    minY <= maxY &&
    floor < e.pos.y + 0.5 &&
    adminOverworld({ ...next, y: e.pos.y })
  ) {
    const y = Math.max(minY, Math.min(maxY, e.pos.y + vertical * speed * DT));
    e.vx = (next.x - e.pos.x) / DT;
    e.vy = (y - e.pos.y) / DT;
    e.vz = (next.z - e.pos.z) / DT;
    e.pos = { ...next, y };
    modes.position = e.pos;
  } else {
    e.vx = e.vy = e.vz = 0;
  }
  e.fallStartY = e.pos.y;
  e.onGround = false;
  e.jumping = false;
  return true;
}
