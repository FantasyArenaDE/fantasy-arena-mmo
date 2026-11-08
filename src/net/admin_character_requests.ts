import type { AdminCharacterAction, AdminCharacterReply } from '../admin_character_wire';

export class AdminCharacterRequests {
  allowed = false;
  mapTeleportAllowed = false;
  private nextId = 0;
  private oneHitUntil = 0;

  constructor(private readonly now = () => performance.now()) {}

  oneHitActive(): boolean {
    return this.allowed && this.now() < this.oneHitUntil;
  }
  private pending?: {
    id: number;
    action: AdminCharacterAction;
    startedAt: number;
    timer: ReturnType<typeof setTimeout>;
    finish: (reply: AdminCharacterReply | null) => void;
  };

  clearActiveModes(): void {
    this.oneHitUntil = 0;
  }

  reset(): void {
    this.allowed = false;
    this.oneHitUntil = 0;
    this.mapTeleportAllowed = false;
    this.finish(null);
  }

  request(
    action: AdminCharacterAction,
    send: (payload: string) => void,
  ): Promise<AdminCharacterReply | null> {
    if (
      !this.allowed ||
      this.pending ||
      (action.kind === 'mapTeleport' && !this.mapTeleportAllowed)
    )
      return Promise.resolve(null);
    const id = ++this.nextId;
    return new Promise((finish) => {
      this.pending = { id, action, startedAt: this.now(), finish, timer: setTimeout(() => this.finish(null), 8_000) };
      try {
        send(JSON.stringify({ t: 'adminCharacter', id, action }));
      } catch {
        this.finish(null);
      }
    });
  }

  receive(reply: AdminCharacterReply): void {
    if (this.pending?.id !== reply.id) return;
    if (reply.status === 'forbidden') {
      this.allowed = false;
      this.oneHitUntil = 0;
    }
    if (reply.modes?.oneHit === false) this.oneHitUntil = 0;
    if (reply.status === 'ok' && reply.modes?.oneHit === true) {
      const { action, startedAt } = this.pending;
      if (action.kind === 'oneHit' || action.kind === 'god' ||
          action.kind === 'flightSpeed' || action.kind === 'runSpeed' ||
          (action.kind === 'flight' && action.value)) {
        // Mutations renew the server's 300-second mode lifetime. Read-only
        // state replies must never renew it. Starting at send time is conservative.
        this.oneHitUntil = startedAt + 300_000;
      }
    }
    this.finish(reply);
  }

  private finish(reply: AdminCharacterReply | null): void {
    const pending = this.pending;
    this.pending = undefined;
    if (!pending) return;
    clearTimeout(pending.timer);
    pending.finish(reply);
  }
}
