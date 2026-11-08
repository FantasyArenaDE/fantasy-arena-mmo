import { stealthDetectionRadius } from './threat';
import { type Entity, PLAYER_INTEREST_RADIUS } from './types';

/** The visibility inputs shared by snapshot admission and manual target selection. */
export interface StealthObservationWorld {
  readonly entities: ReadonlyMap<number, Entity>;
  isHostileTo(attacker: Entity, target: Entity): boolean;
  partyOf(pid: number): { readonly members: readonly number[] } | null;
  duelFor(pid: number): { readonly a: number; readonly b: number } | null;
}

export const SUMMON_COMBAT_REVEAL_SECONDS = 5;

export function summonIsFighting(entity: Entity): boolean {
  return (
    entity.inCombat ||
    entity.combatTimer < SUMMON_COMBAT_REVEAL_SECONDS ||
    entity.guardianState !== undefined
  );
}

export function stealthSubject(
  entity: Entity,
  entities: ReadonlyMap<number, Entity>,
): Entity | null {
  if (entity.kind === 'player') return entity.stealthed ? entity : null;
  // An idle living summon trails its owner. A stationary corpse keeps its
  // existing visibility, including when its combat timer stops ticking.
  if (entity.dead || entity.ownerId === null || summonIsFighting(entity)) return null;
  const owner = entities.get(entity.ownerId);
  return owner?.kind === 'player' && owner.stealthed ? owner : null;
}

function canObserveSubject(
  world: StealthObservationWorld,
  viewer: Entity,
  subject: Entity,
  distanceSq?: number,
): boolean {
  if (world.isHostileTo(viewer, subject)) return false;
  const duel = world.duelFor(viewer.id);
  const duelingEachOther = duel !== null && (duel.a === subject.id || duel.b === subject.id);
  if (world.partyOf(viewer.id)?.members.includes(subject.id) && !duelingEachOther) return true;
  // Dead viewers must not bypass hostility and detect living enemies.
  if (viewer.dead) return false;
  const d2 =
    distanceSq ?? (subject.pos.x - viewer.pos.x) ** 2 + (subject.pos.z - viewer.pos.z) ** 2;
  const radius = stealthDetectionRadius(viewer, subject, PLAYER_INTEREST_RADIUS);
  return d2 <= radius * radius;
}

export function canObserveUnderStealth(
  world: StealthObservationWorld,
  viewer: Entity,
  entity: Entity,
  distanceSq: number,
): boolean {
  const subject = stealthSubject(entity, world.entities);
  return (
    subject === null ||
    (subject !== entity && subject.id === viewer.id) ||
    canObserveSubject(world, viewer, subject, subject === entity ? distanceSq : undefined)
  );
}

/** Manual targeting must not reveal an idle summon omitted by the snapshot. */
export function summonConcealedFrom(
  world: StealthObservationWorld,
  viewer: Entity,
  entity: Entity,
): boolean {
  if (entity.kind === 'player') return false;
  const owner = stealthSubject(entity, world.entities);
  return owner !== null && owner.id !== viewer.id && !canObserveSubject(world, viewer, owner);
}
