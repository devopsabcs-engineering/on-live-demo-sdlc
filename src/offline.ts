export type OfflineStatus =
  | "offlineReady"
  | "offlineUnavailable"
  | "offlineUpdateFailed"
  | "updateAvailable"
  | null;

export class OfflineShell {
  private waiting: ServiceWorker | null = null;
  private accepted = false;

  constructor(
    private readonly workers: ServiceWorkerContainer,
    private readonly changed: (status: OfflineStatus) => void,
    private readonly reload: () => void,
  ) {
    workers.addEventListener("controllerchange", () => {
      if (this.accepted) this.reload();
    });
  }

  async start(base: string): Promise<void> {
    try {
      const registration = await this.workers.register(`${base}sw.js`, {
        scope: base,
        updateViaCache: "none",
      });
      const inspect = () => {
        this.waiting = registration.waiting;
        if (this.waiting) this.changed("updateAvailable");
        else if (registration.active?.state === "activated") {
          this.changed("offlineReady");
        }
      };
      const installing = () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "redundant") {
            this.changed(
              this.workers.controller
                ? "offlineUpdateFailed"
                : "offlineUnavailable",
            );
          } else inspect();
        });
      };
      registration.addEventListener("updatefound", installing);
      installing();
      inspect();
    } catch {
      this.changed(
        this.workers.controller ? "offlineUpdateFailed" : "offlineUnavailable",
      );
    }
  }

  accept(): void {
    if (!this.waiting || this.accepted) return;
    this.accepted = true;
    this.waiting.postMessage({ type: "PINCH_ACCEPT_UPDATE" });
  }
}
