import vm from "node:vm";
import { inflateSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import {
  createIcon,
  createShell,
  type ShellBundle,
} from "../../scripts/pwa.mjs";
import { OfflineShell } from "../../src/offline";

const base = "/ai-sdlc-labs-pinch/";
const origin = "https://pinch.test";
function bundle(content = "shell"): ShellBundle {
  return {
    "index.html": { type: "asset", fileName: "index.html", source: content },
    "assets/main-hash.js": {
      type: "chunk",
      fileName: "assets/main-hash.js",
      code: content,
    },
    "assets/main-hash.css": {
      type: "asset",
      fileName: "assets/main-hash.css",
      source: content,
    },
  };
}

function workerFixture() {
  const shell = createShell(bundle(), base);
  const stores = new Map<string, Map<string, Response>>();
  const handlers = new Map<string, (event: Record<string, unknown>) => void>();
  const requestKey = (request: string | Request) =>
    typeof request === "string" ? request : request.url;
  const caches = {
    open: vi.fn(async (name: string) => {
      let store = stores.get(name);
      if (!store) {
        store = new Map();
        stores.set(name, store);
      }
      const data = store;
      return {
        match: async (request: string | Request) =>
          data.get(requestKey(request))?.clone(),
        put: async (request: string | Request, response: Response) => {
          data.set(requestKey(request), response.clone());
        },
      };
    }),
    keys: async () => [...stores.keys()],
    delete: vi.fn(async (name: string) => stores.delete(name)),
  };
  const fetch = vi.fn(async () => new Response("shell"));
  const clients = {
    claim: vi.fn(async () => undefined),
    get: vi.fn(async () => ({ id: "pinch" })),
  };
  const skipWaiting = vi.fn(async () => undefined);
  vm.runInNewContext(shell.files.get("sw.js") as string, {
    URL,
    Request,
    fetch,
    caches,
    clients,
    skipWaiting,
    location: { origin },
    addEventListener: (
      type: string,
      handler: (event: Record<string, unknown>) => void,
    ) => handlers.set(type, handler),
  });
  async function invoke(type: string, detail: Record<string, unknown> = {}) {
    let promise: Promise<unknown> | undefined;
    let response: Promise<Response> | undefined;
    handlers.get(type)?.({
      ...detail,
      waitUntil: (pending: Promise<unknown>) => {
        promise = pending;
      },
      respondWith: (pending: Promise<Response>) => {
        response = pending;
      },
    });
    await promise;
    return response ? await response : undefined;
  }
  return { ...shell, stores, caches, fetch, clients, skipWaiting, invoke };
}

describe("emitted offline shell", () => {
  it("includes actual emitted files, local manifest and decoded PNG dimensions", () => {
    const { files, config } = createShell(bundle(), base);
    expect(config.assets).toEqual(
      [...files.keys()]
        .filter((name) => name !== "sw.js")
        .sort()
        .map((name) => `${base}${name}`),
    );
    const manifest = JSON.parse(files.get("manifest.webmanifest") as string);
    expect(manifest).toMatchObject({
      id: base,
      start_url: base,
      scope: base,
      display: "standalone",
    });
    for (const size of [192, 512]) {
      const icon = createIcon(size);
      expect([...icon.subarray(0, 8)]).toEqual([
        137, 80, 78, 71, 13, 10, 26, 10,
      ]);
      expect(icon.readUInt32BE(16)).toBe(size);
      expect(icon.readUInt32BE(20)).toBe(size);
      const compressedSize = icon.readUInt32BE(33);
      expect(inflateSync(icon.subarray(41, 41 + compressedSize)).length).toBe(
        (size * 3 + 1) * size,
      );
    }
  });
  it("versions content deterministically and isolates different base scopes", () => {
    const first = createShell(bundle(), base).config;
    expect(createShell(bundle(), base).config.cacheName).toBe(first.cacheName);
    expect(createShell(bundle("new"), base).config.cacheName).not.toBe(
      first.cacheName,
    );
    expect(createShell(bundle(), "/other-pinch/").config.cachePrefix).not.toBe(
      first.cachePrefix,
    );
    expect(() => createShell(bundle(), "https://remote.test/")).toThrow();
    expect(() => createShell({}, base)).toThrow("Missing emitted");
  });
});

describe("transactional generated worker", () => {
  it("finishes every install response before activation and never skips waiting implicitly", async () => {
    const fixture = workerFixture();
    await fixture.invoke("install");
    expect(fixture.stores.get(fixture.config.cacheName)?.size).toBe(
      fixture.config.assets.length,
    );
    expect(fixture.clients.claim).not.toHaveBeenCalled();
    expect(fixture.skipWaiting).not.toHaveBeenCalled();
  });
  for (const failure of ["http", "network", "write", "redirect"] as const) {
    it(`removes only the incomplete new cache after ${failure} failure`, async () => {
      const fixture = workerFixture();
      const old = `${fixture.config.cachePrefix}previous`;
      fixture.stores.set(
        old,
        new Map([[`${origin}${base}index.html`, new Response("old")]]),
      );
      fixture.stores.set("foreign", new Map());
      if (failure === "network")
        fixture.fetch.mockRejectedValueOnce(new Error("Offline"));
      if (failure === "http")
        fixture.fetch.mockResolvedValueOnce(
          new Response("missing", { status: 404 }),
        );
      if (failure === "redirect") {
        const response = new Response("wrong shell");
        Object.defineProperty(response, "redirected", { value: true });
        fixture.fetch.mockResolvedValueOnce(response);
      }
      if (failure === "write")
        fixture.caches.open.mockRejectedValueOnce(new Error("Quota"));
      await expect(fixture.invoke("install")).rejects.toThrow();
      expect(fixture.stores.has(fixture.config.cacheName)).toBe(false);
      expect(
        await fixture.stores
          .get(old)
          ?.get(`${origin}${base}index.html`)
          ?.text(),
      ).toBe("old");
      expect(fixture.stores.has("foreign")).toBe(true);
      expect(fixture.clients.claim).not.toHaveBeenCalled();
    });
  }
  it("retains previous caches if activation completeness or claiming fails", async () => {
    const fixture = workerFixture();
    const old = `${fixture.config.cachePrefix}old`;
    fixture.stores.set(old, new Map());
    await expect(fixture.invoke("activate")).rejects.toThrow("Incomplete");
    expect(fixture.stores.has(old)).toBe(true);
    await fixture.invoke("install");
    fixture.clients.claim.mockRejectedValueOnce(new Error("Claim failed"));
    await expect(fixture.invoke("activate")).rejects.toThrow("Claim failed");
    expect(fixture.stores.has(old)).toBe(true);
  });
  it("cleans only this base's obsolete Pinch caches after complete activation", async () => {
    const fixture = workerFixture();
    const old = `${fixture.config.cachePrefix}old`;
    const foreign = ["foreign-app", "pinch-shell-_other-pinch_-old"];
    for (const name of [old, ...foreign]) fixture.stores.set(name, new Map());
    await fixture.invoke("install");
    await fixture.invoke("activate");
    expect(fixture.clients.claim).toHaveBeenCalledOnce();
    expect([...fixture.stores.keys()].sort()).toEqual(
      [...foreign, fixture.config.cacheName].sort(),
    );
  });
  it("accepts only an explicit message from a live base-scoped client", async () => {
    const fixture = workerFixture();
    await fixture.invoke("message", { data: { type: "other" } });
    await fixture.invoke("message", {
      data: { type: "PINCH_ACCEPT_UPDATE" },
      source: { id: "foreign", url: `${origin}/other/` },
    });
    expect(fixture.skipWaiting).not.toHaveBeenCalled();
    await fixture.invoke("message", {
      data: { type: "PINCH_ACCEPT_UPDATE" },
      source: { id: "pinch", url: `${origin}${base}` },
    });
    expect(fixture.skipWaiting).toHaveBeenCalledOnce();
  });
  it("serves only known assets and base-root navigation; never intercepts third parties or documents", async () => {
    const fixture = workerFixture();
    await fixture.invoke("install");
    fixture.fetch.mockRejectedValue(new Error("Offline"));
    const navigation = {
      url: `${origin}${base}?launch=1`,
      method: "GET",
      mode: "navigate",
      headers: new Headers(),
    };
    expect(
      await (await fixture.invoke("fetch", { request: navigation }))?.text(),
    ).toBe("shell");
    expect(
      await (
        await fixture.invoke("fetch", {
          request: new Request(`${origin}${base}assets/main-hash.js`),
        })
      )?.text(),
    ).toBe("shell");
    for (const url of [
      `${origin}/other/`,
      `${origin}${base}backup.json`,
      "https://third.test/resource",
      `${origin}${base}assets/main-hash.js?unknown=1`,
    ]) {
      expect(
        await fixture.invoke("fetch", { request: new Request(url) }),
      ).toBeUndefined();
    }
    expect(
      await fixture.invoke("fetch", {
        request: new Request(`${origin}${base}index.html`, { method: "POST" }),
      }),
    ).toBeUndefined();
  });
});

function clientFixture(waiting = true) {
  const worker = Object.assign(new EventTarget(), {
    state: "installed",
    postMessage: vi.fn(),
  });
  const registration = Object.assign(new EventTarget(), {
    waiting: waiting ? worker : null,
    installing: null as typeof worker | null,
    active: { state: "activated" },
  });
  const workers = Object.assign(new EventTarget(), {
    register: vi.fn(async () => registration),
    controller: { state: "activated" } as object | null,
  });
  const changed = vi.fn();
  const reload = vi.fn();
  const shell = new OfflineShell(
    workers as unknown as ServiceWorkerContainer,
    changed,
    reload,
  );
  return { shell, workers, registration, worker, changed, reload };
}

describe("explicit client update lifecycle", () => {
  it("registers at the base and reloads only after acceptance, never just controller change", async () => {
    const fixture = clientFixture();
    await fixture.shell.start(base);
    expect(fixture.workers.register).toHaveBeenCalledWith(`${base}sw.js`, {
      scope: base,
      updateViaCache: "none",
    });
    expect(fixture.changed).toHaveBeenCalledWith("updateAvailable");
    fixture.workers.dispatchEvent(new Event("controllerchange"));
    expect(fixture.reload).not.toHaveBeenCalled();
    fixture.shell.accept();
    fixture.shell.accept();
    expect(fixture.worker.postMessage).toHaveBeenCalledOnce();
    expect(fixture.worker.postMessage).toHaveBeenCalledWith({
      type: "PINCH_ACCEPT_UPDATE",
    });
    fixture.workers.dispatchEvent(new Event("controllerchange"));
    expect(fixture.reload).toHaveBeenCalledOnce();
  });
  it("reports first-install failure versus retained prior offline shell", async () => {
    for (const controlled of [false, true]) {
      const fixture = clientFixture(false);
      fixture.workers.controller = controlled ? {} : null;
      fixture.workers.register.mockRejectedValueOnce(new Error("Denied"));
      await fixture.shell.start(base);
      expect(fixture.changed).toHaveBeenCalledWith(
        controlled ? "offlineUpdateFailed" : "offlineUnavailable",
      );
      fixture.shell.accept();
      expect(fixture.worker.postMessage).not.toHaveBeenCalled();
    }
  });
  it("notifies about a newly waiting worker or failed install without reloading", async () => {
    const fixture = clientFixture(false);
    await fixture.shell.start(base);
    fixture.registration.installing = fixture.worker;
    fixture.registration.dispatchEvent(new Event("updatefound"));
    fixture.registration.waiting = fixture.worker;
    fixture.worker.dispatchEvent(new Event("statechange"));
    expect(fixture.changed).toHaveBeenCalledWith("updateAvailable");
    fixture.worker.state = "redundant";
    fixture.worker.dispatchEvent(new Event("statechange"));
    expect(fixture.changed).toHaveBeenCalledWith("offlineUpdateFailed");
    expect(fixture.reload).not.toHaveBeenCalled();
  });
});
