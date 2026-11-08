import { WORLD_MAX_X, WORLD_MAX_Z, WORLD_MIN_X, WORLD_MIN_Z } from '../../../sim/data';
import type { AdminCharacterConnection } from '../../admin_self_panel';
import type { ContinentRect } from '../../continent_map_view';

interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface Surface {
  rect: ContinentRect;
  bounds: Bounds;
}

const WORLD = { minX: WORLD_MIN_X, maxX: WORLD_MAX_X, minZ: WORLD_MIN_Z, maxZ: WORLD_MAX_Z };

export function mapTeleportPoint({ rect, bounds }: Surface, x: number, y: number) {
  const u = (x - rect.mx) / rect.w;
  const v = (y - rect.my) / rect.h;
  if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) return null;
  return {
    x: bounds.maxX - (bounds.maxX - bounds.minX) * u,
    z: bounds.maxZ - (bounds.maxZ - bounds.minZ) * v,
  };
}

export class AdminMapTeleport {
  private surface: Surface | null = null;
  private connection: AdminCharacterConnection | null = null;

  connect(connection: AdminCharacterConnection | null): void {
    this.connection = connection;
  }

  clear(): void {
    this.surface = null;
  }

  continent(rect: ContinentRect): void {
    this.surface = { rect, bounds: WORLD };
  }

  zone(bounds: Bounds, size: number): void {
    this.surface = { rect: { mx: 0, my: 0, w: size, h: size }, bounds };
  }

  get available(): boolean {
    return this.connection?.canAccess() === true && this.connection.canTeleportOnMap?.() === true;
  }

  claims(event: MouseEvent): boolean {
    return (
      this.available &&
      !!this.surface &&
      event.button === 0 &&
      (!('pointerType' in event) || !event.pointerType || event.pointerType === 'mouse') &&
      event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      !event.metaKey
    );
  }

  click(canvas: HTMLCanvasElement, event: MouseEvent, feedback: (ok: boolean) => void): boolean {
    if (!this.claims(event) || !this.surface || !this.connection) return false;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const target = mapTeleportPoint(
      this.surface,
      ((event.clientX - rect.left) / rect.width) * canvas.width,
      ((event.clientY - rect.top) / rect.height) * canvas.height,
    );
    if (!target) {
      feedback(false);
      return true;
    }
    void this.connection.request({ kind: 'mapTeleport', ...target }).then(
      (reply) => feedback(reply?.status === 'ok'),
      () => feedback(false),
    );
    return true;
  }
}
