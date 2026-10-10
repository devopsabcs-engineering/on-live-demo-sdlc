export interface CookWakeLock {
  readonly released: boolean;
  release(): Promise<void>;
  addEventListener(type: "release", listener: () => void): void;
}

export interface CookCapabilities {
  requestWakeLock?: () => Promise<CookWakeLock>;
  requestFullscreen?: () => Promise<void>;
  ownsFullscreen: () => boolean;
  hasFullscreen: () => boolean;
  exitFullscreen: () => Promise<void>;
}

export class CookSession {
  active = false;
  visible = true;
  wakeUnavailable = false;
  fullscreenUnavailable = false;
  private generation = 0;
  private wakeLock: CookWakeLock | null = null;
  private fullscreenOwned = false;
  private fullscreenBusy = false;
  private readonly capabilities: CookCapabilities;
  private readonly changed: () => void;

  constructor(capabilities: CookCapabilities, changed: () => void) {
    this.capabilities = capabilities;
    this.changed = changed;
  }

  open(visible: boolean): void {
    if (this.active) return;
    this.active = true;
    this.visible = visible;
    this.generation += 1;
    this.wakeUnavailable = false;
    this.fullscreenUnavailable = false;
    this.acquireFullscreen();
    if (visible) this.acquireWakeLock();
    this.changed();
  }

  close(): void {
    if (!this.active) return;
    this.active = false;
    this.generation += 1;
    this.releaseWakeLock();
    void this.releaseFullscreen();
    this.changed();
  }

  setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    this.generation += 1;
    if (!visible) {
      this.releaseWakeLock();
      void this.releaseFullscreen();
    } else if (this.active) this.acquireWakeLock();
    this.changed();
  }

  private acquireWakeLock(): void {
    const generation = this.generation;
    const request = this.capabilities.requestWakeLock;
    if (!request) {
      this.wakeUnavailable = true;
      return;
    }
    this.wakeUnavailable = false;
    try {
      void request().then(
        (lock) => {
          if (!this.current(generation)) {
            void lock.release().catch(() => undefined);
            return;
          }
          this.wakeLock = lock;
          this.wakeUnavailable = lock.released;
          lock.addEventListener("release", () => {
            if (this.wakeLock !== lock) return;
            this.wakeLock = null;
            this.wakeUnavailable = true;
            this.changed();
          });
          this.changed();
        },
        () => {
          if (!this.current(generation)) return;
          this.wakeUnavailable = true;
          this.changed();
        },
      );
    } catch {
      this.wakeUnavailable = true;
    }
  }

  private current(generation: number): boolean {
    return this.active && this.visible && generation === this.generation;
  }

  private releaseWakeLock(): void {
    const lock = this.wakeLock;
    this.wakeLock = null;
    if (lock) void lock.release().catch(() => undefined);
  }

  private acquireFullscreen(): void {
    const request = this.capabilities.requestFullscreen;
    if (
      !this.visible ||
      !request ||
      this.fullscreenBusy ||
      this.capabilities.hasFullscreen()
    ) {
      this.fullscreenUnavailable = true;
      return;
    }
    const generation = this.generation;
    this.fullscreenBusy = true;
    try {
      void request().then(
        async () => {
          this.fullscreenOwned = this.capabilities.ownsFullscreen();
          if (!this.current(generation)) await this.releaseFullscreen();
          else {
            this.fullscreenUnavailable = !this.fullscreenOwned;
            this.changed();
          }
          this.fullscreenBusy = false;
        },
        () => {
          this.fullscreenBusy = false;
          if (!this.current(generation)) return;
          this.fullscreenUnavailable = true;
          this.changed();
        },
      );
    } catch {
      this.fullscreenBusy = false;
      this.fullscreenUnavailable = true;
    }
  }

  private async releaseFullscreen(): Promise<void> {
    if (!this.fullscreenOwned) return;
    this.fullscreenOwned = false;
    if (!this.capabilities.ownsFullscreen()) return;
    this.fullscreenBusy = true;
    try {
      await this.capabilities.exitFullscreen();
    } catch {
      this.fullscreenUnavailable = true;
    } finally {
      this.fullscreenBusy = false;
    }
  }
}

export function cookStep(index: number, delta: number, total: number): number {
  return Math.max(0, Math.min(total - 1, index + delta));
}

export function swipeStep(horizontal: number, vertical: number): number {
  return Math.abs(horizontal) >= 60 &&
    Math.abs(horizontal) > Math.abs(vertical) * 1.5
    ? horizontal < 0
      ? 1
      : -1
    : 0;
}
