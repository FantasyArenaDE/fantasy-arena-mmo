import { adminCombatMode } from '../admin_character_modes';
import type { SimContext } from '../sim_context';
import type { DamageEventKind, Entity } from '../types';

const ONE_HIT_MIN_DAMAGE = 9_999_999_999;

export function adminOneHitApplies(
  ctx: SimContext,
  source: Entity | null,
  target: Entity,
): boolean {
  return (
    !!source &&
    source !== target &&
    source.kind === 'player' &&
    !target.dead &&
    target.ownerId !== source.id &&
    !target.templateId.startsWith('vision_') &&
    adminCombatMode(ctx, source, 'oneHit') &&
    ctx.isHostileTo(source, target)
  );
}

// Use the normal death cleanup and credit for the administrator's guaranteed hit.
export function applyAdminOneHit(
  ctx: SimContext,
  source: Entity | null,
  target: Entity,
  amount: number,
  school: string,
  ability: string | null,
  kind: DamageEventKind,
): number | null {
  if (
    !source ||
    amount < 0 ||
    (kind !== 'hit' && kind !== 'block') ||
    !adminOneHitApplies(ctx, source, target)
  ) return null;
  const lost = Math.max(0, target.hp);
  ctx.emit({
    type: 'damage',
    sourceId: source.id,
    targetId: target.id,
    amount: lost,
    oneHitAmount: Math.max(ONE_HIT_MIN_DAMAGE, amount, Math.ceil(lost)),
    crit: true,
    school,
    ability,
    kind: 'hit',
  });
  ctx.handleDeath(target, source, ability);
  return lost;
}
