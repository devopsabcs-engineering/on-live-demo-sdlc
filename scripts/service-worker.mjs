export function serviceWorkerRuntime({ base, cacheName, cachePrefix, assets }) {
  const { caches, clients, location } = globalThis;
  const root = new URL(base, location.origin).href;
  const shell = new Set(
    assets.map((asset) => new URL(asset, location.origin).href),
  );

  globalThis.addEventListener("install", (event) => {
    event.waitUntil(
      (async () => {
        try {
          const cache = await caches.open(cacheName);
          for (const asset of shell) {
            const response = await fetch(
              new globalThis.Request(asset, { cache: "reload" }),
            );
            if (
              !response.ok ||
              response.redirected ||
              response.type === "opaque"
            ) {
              throw new Error(`Incomplete Pinch shell: ${asset}`);
            }
            await cache.put(asset, response);
          }
        } catch (error) {
          await caches.delete(cacheName);
          throw error;
        }
      })(),
    );
  });

  globalThis.addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(cacheName);
        for (const asset of shell) {
          if (!(await cache.match(asset)))
            throw new Error("Incomplete Pinch shell");
        }
        await clients.claim();
        await Promise.all(
          (await caches.keys())
            .filter(
              (name) => name.startsWith(cachePrefix) && name !== cacheName,
            )
            .map((name) => caches.delete(name)),
        );
      })(),
    );
  });

  globalThis.addEventListener("message", (event) => {
    if (event.data?.type !== "PINCH_ACCEPT_UPDATE") return;
    event.waitUntil(
      (async () => {
        const source = event.source;
        if (
          !source ||
          !(await clients.get(source.id)) ||
          !source.url.startsWith(root)
        )
          return;
        await globalThis.skipWaiting();
      })(),
    );
  });

  globalThis.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== "GET" || url.origin !== location.origin) return;
    const navigation =
      request.mode === "navigate" &&
      (url.pathname === base || url.pathname === `${base}index.html`);
    if (!navigation && (!shell.has(url.href) || request.headers.has("range")))
      return;
    event.respondWith(
      (async () => {
        const cache = await caches.open(cacheName);
        const cached = await cache.match(
          navigation ? `${root}index.html` : request,
        );
        return cached ?? fetch(request);
      })(),
    );
  });
}
