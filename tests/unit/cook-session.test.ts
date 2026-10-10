import { describe, expect, it, vi } from "vitest";
import {
  CookSession,
  cookStep,
  swipeStep,
  type CookWakeLock,
} from "../../src/cook-session";

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function wakeLock() {
  let released = false;
  let listener: () => void = () => undefined;
  const lock: CookWakeLock = {
    get released() {
      return released;
    },
    release: vi.fn(async () => {
      released = true;
      listener();
    }),
    addEventListener: (_type, callback) => {
      listener = callback;
    },
  };
  return lock;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function fixture() {
  let fullscreen: "cook" | "other" | null = null;
  const lock = wakeLock();
  const capabilities = {
    requestWakeLock: vi.fn(async () => lock),
    requestFullscreen: vi.fn(async () => {
      fullscreen = "cook";
    }),
    ownsFullscreen: () => fullscreen === "cook",
    hasFullscreen: () => fullscreen !== null,
    exitFullscreen: vi.fn(async () => {
      fullscreen = null;
    }),
  };
  const changed = vi.fn();
  return {
    session: new CookSession(capabilities, changed),
    capabilities,
    lock,
    changed,
    setFullscreen: (value: typeof fullscreen) => {
      fullscreen = value;
    },
  };
}

describe("cooking navigation", () => {
  it("bounds all navigation including single-step recipes", () => {
    expect(cookStep(0, -1, 3)).toBe(0);
    expect(cookStep(2, 1, 3)).toBe(2);
    expect(cookStep(1, -1, 3)).toBe(0);
    expect(cookStep(0, 1, 1)).toBe(0);
  });
  it("accepts deliberate horizontal swipes, not vertical/diagonal scroll or taps", () => {
    expect(swipeStep(-80, 10)).toBe(1);
    expect(swipeStep(80, 10)).toBe(-1);
    expect(swipeStep(59, 0)).toBe(0);
    expect(swipeStep(-80, 70)).toBe(0);
    expect(swipeStep(0, 120)).toBe(0);
  });
});

describe("cooking capabilities", () => {
  it("holds the fullscreen guard through asynchronous exit and handles exit failure", async () => {
    const { session, capabilities } = fixture();
    const exiting = deferred<void>();
    capabilities.exitFullscreen.mockReturnValueOnce(exiting.promise);
    session.open(true);
    await flush();
    session.close();
    session.open(true);
    expect(capabilities.requestFullscreen).toHaveBeenCalledOnce();
    exiting.reject(new Error("Browser already exited"));
    await flush();
    expect(session.active).toBe(true);
    expect(session.fullscreenUnavailable).toBe(true);
    session.close();
  });

  it("acquires synchronously from open, releases on close, and never requests while inactive", async () => {
    const { session, capabilities, lock } = fixture();
    session.open(true);
    expect(capabilities.requestFullscreen).toHaveBeenCalledOnce();
    expect(capabilities.requestWakeLock).toHaveBeenCalledOnce();
    await flush();
    session.close();
    await flush();
    expect(lock.release).toHaveBeenCalledOnce();
    expect(capabilities.exitFullscreen).toHaveBeenCalledOnce();
    session.setVisible(false);
    session.setVisible(true);
    expect(capabilities.requestWakeLock).toHaveBeenCalledOnce();
  });

  it("releases in the background and reacquires only wake lock on resume", async () => {
    const { session, capabilities, lock } = fixture();
    const resumed = wakeLock();
    capabilities.requestWakeLock
      .mockResolvedValueOnce(lock)
      .mockResolvedValueOnce(resumed);
    session.open(true);
    await flush();
    session.setVisible(false);
    await flush();
    expect(lock.release).toHaveBeenCalledOnce();
    expect(capabilities.exitFullscreen).toHaveBeenCalledOnce();
    session.setVisible(true);
    session.setVisible(true);
    await flush();
    expect(capabilities.requestWakeLock).toHaveBeenCalledTimes(2);
    expect(capabilities.requestFullscreen).toHaveBeenCalledOnce();
    session.close();
    expect(resumed.release).toHaveBeenCalledOnce();
  });

  it.each(["close", "background"])(
    "cleans up late successes after %s",
    async (end) => {
      const { session, capabilities, setFullscreen } = fixture();
      const pendingLock = deferred<CookWakeLock>();
      const pendingFullscreen = deferred<void>();
      capabilities.requestWakeLock.mockReturnValue(pendingLock.promise);
      capabilities.requestFullscreen.mockReturnValue(pendingFullscreen.promise);
      session.open(true);
      if (end === "close") session.close();
      else session.setVisible(false);
      const lateLock = wakeLock();
      setFullscreen("cook");
      pendingLock.resolve(lateLock);
      pendingFullscreen.resolve();
      await flush();
      expect(lateLock.release).toHaveBeenCalledOnce();
      expect(capabilities.exitFullscreen).toHaveBeenCalledOnce();
    },
  );

  it("does not let stale wake successes or rejections overwrite a resumed session", async () => {
    const { session, capabilities } = fixture();
    const pending = deferred<CookWakeLock>();
    const resumed = wakeLock();
    capabilities.requestWakeLock
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(resumed);
    session.open(true);
    session.setVisible(false);
    session.setVisible(true);
    await flush();
    const stale = wakeLock();
    pending.resolve(stale);
    await flush();
    expect(stale.release).toHaveBeenCalledOnce();
    expect(resumed.release).not.toHaveBeenCalled();
    expect(session.wakeUnavailable).toBe(false);
    session.close();
    expect(resumed.release).toHaveBeenCalledOnce();
  });

  it("serializes fullscreen across rapid close/reopen and releases the old request", async () => {
    const { session, capabilities, setFullscreen } = fixture();
    const pending = deferred<void>();
    capabilities.requestFullscreen.mockReturnValueOnce(pending.promise);
    session.open(true);
    session.close();
    session.open(true);
    expect(capabilities.requestFullscreen).toHaveBeenCalledOnce();
    expect(session.fullscreenUnavailable).toBe(true);
    setFullscreen("cook");
    pending.resolve();
    await flush();
    expect(capabilities.exitFullscreen).toHaveBeenCalledOnce();
    expect(session.active).toBe(true);
    session.close();
  });

  it("never exits someone else's fullscreen, even after ownership changes", async () => {
    const { session, capabilities, setFullscreen } = fixture();
    setFullscreen("other");
    session.open(true);
    await flush();
    session.close();
    expect(capabilities.requestFullscreen).not.toHaveBeenCalled();
    expect(capabilities.exitFullscreen).not.toHaveBeenCalled();
    setFullscreen(null);
    session.open(true);
    await flush();
    setFullscreen("other");
    session.close();
    expect(capabilities.exitFullscreen).not.toHaveBeenCalled();
  });

  it("reports absent APIs without blocking cooking", () => {
    const session = new CookSession(
      {
        hasFullscreen: () => false,
        ownsFullscreen: () => false,
        exitFullscreen: async () => undefined,
      },
      vi.fn(),
    );
    session.open(true);
    expect(session.active).toBe(true);
    expect(session.wakeUnavailable).toBe(true);
    expect(session.fullscreenUnavailable).toBe(true);
  });

  it("reports denial and synchronous failures without throwing", async () => {
    const { session, capabilities } = fixture();
    capabilities.requestWakeLock.mockRejectedValueOnce(new Error("Denied"));
    capabilities.requestFullscreen.mockRejectedValueOnce(new Error("Denied"));
    session.open(true);
    await flush();
    expect(session.wakeUnavailable).toBe(true);
    expect(session.fullscreenUnavailable).toBe(true);
    session.close();
    capabilities.requestWakeLock.mockImplementationOnce(() => {
      throw new Error("Denied");
    });
    capabilities.requestFullscreen.mockImplementationOnce(() => {
      throw new Error("Denied");
    });
    expect(() => session.open(true)).not.toThrow();
    expect(session.wakeUnavailable).toBe(true);
    expect(session.fullscreenUnavailable).toBe(true);
  });

  it("ignores late denials after reopening and reports browser-released wake locks", async () => {
    const { session, capabilities } = fixture();
    const pending = deferred<CookWakeLock>();
    const resumed = wakeLock();
    capabilities.requestWakeLock
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(resumed);
    session.open(true);
    session.close();
    session.open(true);
    await flush();
    pending.reject(new Error("Late denial"));
    await flush();
    expect(session.wakeUnavailable).toBe(false);
    await resumed.release();
    expect(session.wakeUnavailable).toBe(true);
  });

  it("does not acquire a wake lock on hidden open", async () => {
    const { session, capabilities } = fixture();
    session.open(false);
    expect(capabilities.requestWakeLock).not.toHaveBeenCalled();
    expect(capabilities.requestFullscreen).not.toHaveBeenCalled();
    session.setVisible(true);
    await flush();
    expect(capabilities.requestWakeLock).toHaveBeenCalledOnce();
  });
});
