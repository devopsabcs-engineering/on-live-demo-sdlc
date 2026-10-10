import { readFile, readdir, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import type { OutputBundle } from "rollup";
import { expect, test, type Page } from "@playwright/test";
import { createShell } from "../../scripts/pwa.mjs";

const base = "/ai-sdlc-labs-pinch/";
const documentKey = "pinch:v1:document";

async function installed(page: Page, url = "./") {
  await page.goto(url);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        );
      });
    }
  });
  await expect(
    page.locator("body > .offline-notice .offline-status"),
  ).toContainText("offline");
}

test("built Chromium shell is installable with local PNGs, emitted assets and base-scoped identity", async ({
  page,
  context,
}) => {
  const requests: string[] = [];
  context.on("request", (request) => requests.push(request.url()));
  await installed(page);
  const cdp = await context.newCDPSession(page);
  const manifest = await cdp.send("Page.getAppManifest");
  expect(manifest.errors).toEqual([]);
  const parsed = JSON.parse(manifest.data);
  expect(parsed).toMatchObject({
    name: "Pinch",
    id: base,
    start_url: base,
    scope: base,
    display: "standalone",
  });
  await expect
    .poll(
      async () =>
        (await cdp.send("Page.getInstallabilityErrors")).installabilityErrors,
    )
    .toEqual([]);
  const shell = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const names = (await caches.keys()).filter((name) =>
      name.startsWith("pinch-shell-"),
    );
    const assets = await (await caches.open(names[0] ?? "missing")).keys();
    const icons = await Promise.all(
      [192, 512].map(async (size) => {
        const bitmap = await createImageBitmap(
          await (await fetch(`icons/pinch-${size}.png`)).blob(),
        );
        const dimensions = [bitmap.width, bitmap.height];
        bitmap.close();
        return dimensions;
      }),
    );
    return {
      scope: registration.scope,
      worker: navigator.serviceWorker.controller?.scriptURL,
      assets: assets.map((asset) => asset.url),
      icons,
    };
  });
  const origin = new URL(page.url()).origin;
  expect(shell.scope).toBe(`${origin}${base}`);
  expect(shell.worker).toBe(`${origin}${base}sw.js`);
  expect(shell.icons).toEqual([
    [192, 192],
    [512, 512],
  ]);
  const emitted = await readdir(resolve("dist"), { recursive: true });
  const expected: string[] = [];
  for (const file of emitted) {
    if (file !== "sw.js" && (await stat(resolve("dist", file))).isFile())
      expected.push(`${origin}${base}${file.replaceAll("\\", "/")}`);
  }
  expect(shell.assets.sort()).toEqual(expected.sort());
  expect(requests.every((url) => url.startsWith(`${origin}${base}`))).toBe(
    true,
  );
});

for (const locale of ["en", "fr"] as const) {
  test(`${locale}: built-site offline reload supports every local flow without third-party requests`, async ({
    page,
    context,
  }) => {
    const requests: string[] = [];
    const errors: string[] = [];
    context.on("request", (request) => requests.push(request.url()));
    page.on("pageerror", (error) => errors.push(error.message));
    await installed(page);
    await page.evaluate(() => localStorage.setItem("foreign-app", "keep"));
    const cacheNames = await page.evaluate(() => caches.keys());
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("#library button")).toHaveCount(3);
    await page.locator("#locale").selectOption(locale);
    await page.locator("#theme").selectOption("dark");
    await page.locator("#new-recipe").click();
    await page.locator("#recipe-name").fill("Offline recipe");
    await page.locator("#base-servings").fill("2");
    await page
      .locator("#ingredient-lines")
      .fill("100 g flour\n250 ml milk\nsalt to taste");
    await page.locator("#step-lines").fill("Mix\nServe");
    await page.locator("#recipe-form button[type=submit]").click();
    await page.locator("#edit-recipe").click();
    await page
      .locator("#ingredient-lines")
      .fill("200 g flour\n250 ml milk\nsalt to taste");
    await page.locator("#recipe-form button[type=submit]").click();
    await page.locator("#target-servings").fill("4");
    await page.locator("#target-servings").press("Tab");
    await expect(page.locator("#recipe-ingredients")).toContainText("400 g");
    await page.locator("#units").selectOption("imperial");
    await expect(page.locator("#recipe-ingredients")).toContainText("oz");
    await page.locator("#add-shopping").click();
    await expect(page.locator("#shopping-list input")).toHaveCount(3);
    await page.locator("#shopping-list input").first().check();
    await page.locator("#clear-checked").click();
    await expect(page.locator("#shopping-list input")).toHaveCount(2);
    await page.locator("#start-cooking").click();
    await expect(page.locator("#cook-step")).toHaveText("Mix");
    await page.locator("#cook-next").click();
    await expect(page.locator("#cook-step")).toHaveText("Serve");
    await page.locator("#close-cooking").click();
    const downloading = page.waitForEvent("download");
    await page.locator("#export-data").click();
    const downloaded = await downloading;
    const path = await downloaded.path();
    if (!path) throw new Error("Missing local JSON download");
    const backup = await readFile(path);
    const before = await page.evaluate(
      (key) => localStorage.getItem(key),
      documentKey,
    );
    await page.reload();
    await expect(page.locator("#library button")).toHaveCount(4);
    await expect(page.locator("#locale")).toHaveValue(locale);
    await expect(page.locator("#theme")).toHaveValue("dark");
    await expect(page.locator("#units")).toHaveValue("imperial");
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#reset-data").click();
    await expect(page.locator("#library button")).toHaveCount(3);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), documentKey),
    ).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem("foreign-app"))).toBe(
      "keep",
    );
    expect(await page.evaluate(() => caches.keys())).toEqual(cacheNames);
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#import-file").setInputFiles({
      name: "offline.json",
      mimeType: "application/json",
      buffer: backup,
    });
    await expect(page.locator("#library button")).toHaveCount(4);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), documentKey),
    ).toBe(before);
    await page.reload();
    await page
      .getByRole("button", { name: "Offline recipe", exact: true })
      .click();
    await expect(page.locator("#recipe-steps li").last()).toHaveText("Serve");
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
    }
    expect(errors).toEqual([]);
    const origin = new URL(page.url()).origin;
    expect(requests.every((url) => url.startsWith(`${origin}${base}`))).toBe(
      true,
    );
  });
}

async function updateServer() {
  const output: OutputBundle = {};
  for (const name of await readdir(resolve("dist"), { recursive: true })) {
    if (name === "sw.js" || !(await stat(resolve("dist", name))).isFile())
      continue;
    const fileName = name.replaceAll("\\", "/");
    output[fileName] = {
      type: "asset",
      fileName,
      source: await readFile(resolve("dist", name)),
    } as OutputBundle[string];
  }
  function version(label: string) {
    const index = output["index.html"];
    if (!index || index.type !== "asset")
      throw new Error("Missing built index");
    return createShell(
      {
        ...output,
        "index.html": {
          ...index,
          source: String(index.source).replace(
            "<body>",
            `<body data-build="${label}">`,
          ),
        },
      },
      base,
    );
  }
  const previous = version("previous");
  const next = version("next");
  let mode: "previous" | "failed" | "next" = "previous";
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    const name = path === base ? "index.html" : path.slice(base.length);
    if (!path.startsWith(base)) {
      response.writeHead(404).end();
      return;
    }
    if (mode === "failed" && name === "index.html") {
      response.writeHead(503).end("Interrupted update");
      return;
    }
    const source = (mode === "previous" ? previous : next).files.get(name);
    if (source === undefined) {
      response.writeHead(404).end();
      return;
    }
    const type = name.endsWith(".js")
      ? "text/javascript"
      : name.endsWith(".css")
        ? "text/css"
        : name.endsWith(".png")
          ? "image/png"
          : name.endsWith(".webmanifest")
            ? "application/manifest+json"
            : "text/html";
    response.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-store",
    });
    response.end(source);
  });
  await new Promise<void>((accept) => server.listen(0, "127.0.0.1", accept));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test server address");
  return {
    url: `http://127.0.0.1:${address.port}${base}`,
    previous,
    next,
    setMode: (value: typeof mode) => {
      mode = value;
    },
    close: () =>
      new Promise<void>((accept, reject) => {
        server.close((error) => (error ? reject(error) : accept()));
        server.closeAllConnections();
      }),
  };
}

test("failed real-worker update retains the old offline shell; waiting updates activate only after explicit acceptance", async ({
  page,
  context,
}) => {
  const server = await updateServer();
  try {
    await installed(page, server.url);
    await page.evaluate(async () => {
      await caches.open("foreign-app-cache");
      await caches.open("pinch-shell-_other-pinch_-old");
    });
    server.setMode("failed");
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.ready).update();
    });
    await expect(
      page.locator("body > .offline-notice .offline-status"),
    ).toContainText("previous offline");
    expect(await page.evaluate(() => caches.keys())).toContain(
      server.previous.config.cacheName,
    );
    expect(await page.evaluate(() => caches.keys())).not.toContain(
      server.next.config.cacheName,
    );
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("body")).toHaveAttribute(
      "data-build",
      "previous",
    );
    await expect(page.locator("#library button")).toHaveCount(3);
    await context.setOffline(false);
    await page.locator("#new-recipe").click();
    await page.locator("#recipe-name").fill("Unsaved draft");
    server.setMode("next");
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.ready).update();
    });
    const update = page.locator("body > .offline-notice .accept-update");
    await expect(update).toBeVisible();
    await expect(page.locator("#recipe-name")).toHaveValue("Unsaved draft");
    await expect(page.locator("body")).toHaveAttribute(
      "data-build",
      "previous",
    );
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain(
        "Unsaved recipe edits and cooking progress",
      );
      await dialog.dismiss();
    });
    await update.click();
    await expect(page.locator("#recipe-name")).toHaveValue("Unsaved draft");
    expect(await page.evaluate(() => caches.keys())).toContain(
      server.previous.config.cacheName,
    );
    await page.locator("#cancel-editor").click();
    await page.locator("#start-cooking").click();
    await page.locator("#cook-next").click();
    const step = await page.locator("#cook-step").textContent();
    const cookUpdate = page.locator("#cook-dialog .accept-update");
    await expect(cookUpdate).toBeVisible();
    await page.locator("#cook-locale").selectOption("fr");
    await expect(cookUpdate).toHaveAccessibleName("Mettre à jour Pinch");
    await page.locator("#cook-locale").selectOption("en");
    await expect(page.locator("#cook-step")).toHaveText(step ?? "");
    await expect(page.locator("body")).toHaveAttribute(
      "data-build",
      "previous",
    );
    page.once("dialog", (dialog) => dialog.accept());
    await cookUpdate.click();
    await expect(page.locator("body")).toHaveAttribute("data-build", "next");
    await expect
      .poll(() => page.evaluate(() => caches.keys()))
      .toEqual(
        expect.arrayContaining([
          server.next.config.cacheName,
          "foreign-app-cache",
          "pinch-shell-_other-pinch_-old",
        ]),
      );
    await expect
      .poll(() => page.evaluate(() => caches.keys()))
      .not.toContain(server.previous.config.cacheName);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("body")).toHaveAttribute("data-build", "next");
    await expect(page.locator("#library button")).toHaveCount(3);
  } finally {
    await server.close();
  }
});
