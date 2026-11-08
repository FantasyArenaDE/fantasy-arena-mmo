import {
  DEEP_NIGHTMARE, DREAM_CHORUS, DREAM_COMFORT, DREAM_MOONREND, DREAM_SHROUD, DREAM_SPARK, DREAM_THREAD,
  DREAM_THREAD_CAP, DREAM_THREAD_DURATION, DREAM_VEIL, NIGHTMARE,
} from '../content/dreamdancer';
import type { ResolvedAbility } from '../resolved_ability';
import type { SimContext } from '../sim_context';
import type { Aura, Entity } from '../types';

export const DREAM_ARENA_FINISHER_WOUND = 'dream_arena_finisher_wound';
export const DREAM_ARENA_NIGHTMARE_ECHO = 'dream_arena_nightmare_echo';

function activeThread(caster: Entity): Aura | undefined {
  return caster.auras.find(aura => aura.kind === 'dream_thread' && aura.remaining > 0);
}

function fullThread(caster: Entity): Aura | undefined {
  const thread = activeThread(caster);
  return thread?.stacks === DREAM_THREAD_CAP ? thread : undefined;
}

function requiresFullThread(id: string): boolean {
  return id === NIGHTMARE || id === DEEP_NIGHTMARE || id === DREAM_VEIL;
}

export function dreamThreadCanCast(
  ctx: SimContext,
  caster: Entity,
  target: Entity | null,
  id: string,
  spec: string | null,
): boolean {
  if (id === DREAM_THREAD) {
    return target !== null && (ctx.isHostileTo(caster, target) || spec === 'dreamkeeper');
  }
  if (!requiresFullThread(id)) return true;
  return target !== null && fullThread(caster)?.dreamTargetId === target.id;
}

export function bindDreamThread(ctx: SimContext, caster: Entity, target: Entity): void {
  const current = activeThread(caster);
  if (current?.dreamTargetId === target.id) {
    current.remaining = DREAM_THREAD_DURATION;
    return;
  }
  clearDreamThread(ctx, caster);
  ctx.applyAura(caster, {
    id: DREAM_THREAD, name: 'Dream Thread', kind: 'dream_thread', school: 'arcane',
    remaining: DREAM_THREAD_DURATION, duration: DREAM_THREAD_DURATION,
    sourceId: caster.id, value: 0, stacks: 0, dreamTargetId: target.id, undispellable: true,
  });
}

export function buildDreamThread(caster: Entity, target: Entity, id: string, amount: number): void {
  if (amount <= 0 || target.dead || (id !== DREAM_SPARK && id !== DREAM_COMFORT)) return;
  addBoundStrand(caster, target);
}

function addBoundStrand(caster: Entity, target: Entity): void {
  const thread = activeThread(caster);
  if (thread?.dreamTargetId !== target.id) return;
  thread.stacks = Math.min(DREAM_THREAD_CAP, (thread.stacks ?? 0) + 1);
}

function arenaDreamThreadTarget(ctx: SimContext, caster: Entity): Entity | undefined {
  const match = ctx.arenaMatches.get(caster.id);
  if (match?.state !== 'active' || match.format !== '2v2') return;
  const targetId = activeThread(caster)?.dreamTargetId;
  const target = targetId === undefined ? undefined : ctx.entities.get(targetId);
  if (target && !target.dead && !match.defeated.has(target.id) && ctx.arenaMatches.get(target.id) === match &&
      ctx.isHostileTo(caster, target)) return target;
}

export function buildArenaMoonrendStrand(ctx: SimContext, caster: Entity, target: Entity): void {
  if (arenaDreamThreadTarget(ctx, caster) === target) addBoundStrand(caster, target);
}

export function rewardDreamChorus(
  caster: Entity,
  boundWasHealed: boolean,
  effectiveTargets: number,
  ability: ResolvedAbility,
): void {
  if (ability.def.id !== DREAM_CHORUS || effectiveTargets < 2 || !boundWasHealed) return;
  const thread = activeThread(caster);
  if (!thread || caster.resourceType !== 'mana') return;
  thread.stacks = Math.min(DREAM_THREAD_CAP, (thread.stacks ?? 0) + 1);
  const refund = effectiveTargets >= 3 ? ability.cost : Math.floor(ability.cost / 2);
  caster.resource = Math.min(caster.maxResource, caster.resource + refund);
}

export function clearDreamThread(ctx: SimContext, caster: Entity): void {
  const index = caster.auras.findIndex(aura => aura.kind === 'dream_thread');
  if (index < 0) return;
  const [thread] = caster.auras.splice(index, 1);
  ctx.emit({ type: 'aura', targetId: caster.id, name: thread.name, gained: false });
}

export function commitDreamThread(
  ctx: SimContext,
  caster: Entity,
  ability: ResolvedAbility,
): ResolvedAbility {
  const id = ability.def.id;
  if (requiresFullThread(id)) {
    const thread = fullThread(caster);
    const bound = thread ? arenaDreamThreadTarget(ctx, caster) : undefined;
    if (thread && bound) {
      const meta = ctx.players.get(caster.id);
      const spec = meta && ctx.playerMods(meta).spec;
      if (spec === 'nightweaver' || spec === 'veilweaver') {
        // Spending strands retains the target in 2v2. Only the next three
        // successful builders on that same opponent can open another window.
        thread.stacks = 0;
        thread.remaining = DREAM_THREAD_DURATION;
        const effects = [...ability.effects];
        if (id === DREAM_VEIL) {
          const impact = ctx.resolvedAbility(NIGHTMARE, caster.id)?.effects.find(effect => effect.type === 'directDamage');
          if (impact) effects.unshift(impact);
        } else if (id === DEEP_NIGHTMARE &&
            bound.auras.some(aura => aura.id === DREAM_MOONREND && aura.sourceId === caster.id && aura.remaining > 0)) {
          const moonrend = ctx.resolvedAbility(DREAM_MOONREND, caster.id)?.effects.find(effect => effect.type === 'dot');
          if (moonrend) effects.push({
            type: 'dot', auraId: DREAM_ARENA_NIGHTMARE_ECHO,
            total: Math.round(moonrend.total * 2.4), duration: 4.5, interval: 1.5,
          });
        }
        return {
          ...ability,
          effects: [...effects, {
            type: 'debuffTargetSource', kind: 'mortal_wound', value: 0.4, duration: 6,
            auraId: DREAM_ARENA_FINISHER_WOUND, auraName: 'Dream Thread',
          }],
        };
      }
    }
    clearDreamThread(ctx, caster);
  } else if (id === DREAM_SHROUD) {
    const thread = fullThread(caster);
    const bound = thread?.dreamTargetId === undefined ? undefined : ctx.entities.get(thread.dreamTargetId);
    if (!bound || bound.dead) return ability;
    clearDreamThread(ctx, caster);
    return {
      ...ability,
      effects: ability.effects.map(effect => effect.type === 'absorb'
        ? { ...effect, amount: effect.amount * 2 }
        : effect),
    };
  }
  return ability;
}
