import type { Sim } from '../sim/sim';
import { DT, type Entity, type MoveInput, normAngle, RUN_SPEED, TURN_SPEED } from '../sim/types';
import { groundHeightAtBody } from '../sim/world';

export function createAdminSelfPreview(sim: Sim) {
  if (!sim.devCommands) throw new Error('Admin preview requires a local development simulation');
  let flight = false;
  let flightSpeed = 1;
  let runSpeed = 1;
  const ground = (player: Entity) =>
    groundHeightAtBody(player.pos.x, player.pos.z, sim.cfg.seed, player.pos.y);

  function setFlight(on: boolean): void {
    const player = sim.player;
    if (on === flight || player.dead) return;
    flight = on;
    player.pos.y = ground(player) + (on ? 2 : 0);
    player.fallStartY = player.pos.y;
    player.onGround = !on;
    player.jumping = false;
    player.vx = player.vy = player.vz = 0;
    Object.assign(player.prevPos, player.pos);
  }

  function stepFlight(player: Entity, input: MoveInput): boolean {
    if (!flight) return false;
    if (player.dead) {
      flight = false;
      return false;
    }

    const turn = Number(input.turnLeft) - Number(input.turnRight);
    player.facing = normAngle(player.facing + turn * TURN_SPEED * DT);
    const forward = Number(input.forward) - Number(input.back);
    const strafe = Number(input.strafeRight) - Number(input.strafeLeft);
    const scale = (RUN_SPEED * flightSpeed) / Math.max(1, Math.hypot(forward, strafe));
    const sin = Math.sin(player.facing);
    const cos = Math.cos(player.facing);
    const vx = (forward * sin - strafe * cos) * scale;
    const vz = (forward * cos + strafe * sin) * scale;
    player.pos.x += vx * DT;
    player.pos.z += vz * DT;
    const floor = ground(player);
    const vertical = Number(input.jump || input.surface) - Number(input.dive);
    const y = Math.max(floor + 0.5, Math.min(floor + 60, player.pos.y + vertical * scale * DT));
    player.vx = vx;
    player.vy = (y - player.pos.y) / DT;
    player.vz = vz;
    player.pos.y = y;
    player.fallStartY = y;
    player.onGround = false;
    return true;
  }

  sim.setLocalPreviewMotion({ runMultiplier: () => runSpeed, step: stepFlight });
  return {
    player: () => sim.player,
    copper: () => sim.copper,
    command: (command: string) => sim.chat(command),
    flight: () => flight,
    setFlight,
    setFlightSpeed: (speed: number) => {
      flightSpeed = Math.max(1, Math.min(3, speed));
    },
    setRunSpeed: (speed: number) => {
      runSpeed = Math.max(1, Math.min(3, speed));
    },
  };
}

export type AdminSelfPreview = ReturnType<typeof createAdminSelfPreview>;
