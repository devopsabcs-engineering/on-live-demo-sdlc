import { expect, test, type Page } from "@playwright/test";

interface CookHarness {
  wakeCalls: number;
  wakeReleased: number;
  fullscreenCalls: number;
  fullscreenExits: number;
  activation: boolean[];
  visibility(visible: boolean): void;
  resolveWake(index: number): void;
  rejectWake(index: number): void;
  resolveFullscreen(index: number): void;
  rejectFullscreen(index: number): void;
  externalFullscreen(): void;
}

declare global {
  interface Window {
    cookHarness: CookHarness;
  }
}

test("native fullscreen remains progressive and exits with the cooking dialog", async ({
  page,
}) => {
  await page.goto("./");
  await page.locator("#start-cooking").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.fullscreenElement === document.documentElement ||
          document
            .querySelector("#cook-feedback")
            ?.textContent?.includes("Fullscreen is unavailable"),
      ),
    )
    .toBe(true);
  await page.locator("#close-cooking").click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement))
    .toBeNull();
  await expect(page.locator("#start-cooking")).toBeFocused();
});

async function capabilities(
  page: Page,
  mode: "absent" | "denied" | "controlled",
) {
  await page.addInitScript((selected) => {
    let visible = true;
    let fullscreen: Element | null = null;
    const wakeRequests: {
      resolve: (lock: unknown) => void;
      reject: (reason: Error) => void;
    }[] = [];
    const fullscreenRequests: {
      resolve: () => void;
      reject: (reason: Error) => void;
    }[] = [];
    const harness: CookHarness = {
      wakeCalls: 0,
      wakeReleased: 0,
      fullscreenCalls: 0,
      fullscreenExits: 0,
      activation: [],
      visibility: (next) => {
        visible = next;
        document.dispatchEvent(new Event("visibilitychange"));
      },
      resolveWake: (index) => {
        let released = false;
        const lock = new EventTarget();
        Object.defineProperties(lock, {
          released: { get: () => released },
          release: {
            value: async () => {
              released = true;
              harness.wakeReleased += 1;
              lock.dispatchEvent(new Event("release"));
            },
          },
        });
        wakeRequests[index]?.resolve(lock);
      },
      rejectWake: (index) => wakeRequests[index]?.reject(new Error("Denied")),
      resolveFullscreen: (index) => {
        fullscreen = document.documentElement;
        fullscreenRequests[index]?.resolve();
        document.dispatchEvent(new Event("fullscreenchange"));
      },
      rejectFullscreen: (index) =>
        fullscreenRequests[index]?.reject(new Error("Denied")),
      externalFullscreen: () => {
        fullscreen = document.body;
      },
    };
    window.cookHarness = harness;
    Object.defineProperty(document, "visibilityState", {
      get: () => (visible ? "visible" : "hidden"),
    });
    Object.defineProperty(document, "fullscreenElement", {
      get: () => fullscreen,
    });
    Object.defineProperty(document, "exitFullscreen", {
      value: async () => {
        fullscreen = null;
        harness.fullscreenExits += 1;
        document.dispatchEvent(new Event("fullscreenchange"));
      },
    });
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      value:
        selected === "absent"
          ? undefined
          : () => {
              harness.fullscreenCalls += 1;
              harness.activation.push(navigator.userActivation.isActive);
              if (selected === "denied")
                return Promise.reject(new Error("Denied"));
              return new Promise<void>((resolve, reject) =>
                fullscreenRequests.push({ resolve, reject }),
              );
            },
    });
    Object.defineProperty(navigator, "wakeLock", {
      value:
        selected === "absent"
          ? undefined
          : {
              request: () => {
                harness.wakeCalls += 1;
                if (selected === "denied")
                  return Promise.reject(new Error("Denied"));
                return new Promise((resolve, reject) =>
                  wakeRequests.push({ resolve, reject }),
                );
              },
            },
    });
  }, mode);
}

async function swipe(
  page: Page,
  horizontal: number,
  vertical = 0,
  cancel = false,
) {
  await page.locator("#cook-scroll").evaluate(
    (element, movement) => {
      element.dispatchEvent(
        new PointerEvent("pointerdown", {
          pointerId: 1,
          isPrimary: true,
          button: 0,
          clientX: 160,
          clientY: 300,
        }),
      );
      element.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerId: 1,
          clientX: 160 + movement.horizontal,
          clientY: 300 + movement.vertical,
        }),
      );
      element.dispatchEvent(
        new PointerEvent(movement.cancel ? "pointercancel" : "pointerup", {
          pointerId: 1,
          clientX: 160 + movement.horizontal,
          clientY: 300 + movement.vertical,
        }),
      );
    },
    { horizontal, vertical, cancel },
  );
}

for (const locale of ["en", "fr"] as const) {
  for (const mode of ["absent", "denied"] as const) {
    test(`${locale}: keyboard, focus and bounded swipes survive ${mode} capabilities`, async ({
      page,
    }) => {
      await capabilities(page, mode);
      await page.goto("./");
      await page.locator("#locale").selectOption(locale);
      await page.locator("#start-cooking").focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.locator("#close-cooking")).toBeFocused();
      await expect(page.locator("#cook-previous")).toBeDisabled();
      await expect(page.locator("#cook-progress")).toHaveText(
        locale === "en" ? "Step 1 of 3" : "Étape 1 sur 3",
      );
      await expect(page.locator("#cook-feedback")).toContainText(
        locale === "en" ? "screen may sleep" : "veille",
      );
      await expect(page.locator("#cook-feedback")).toContainText(
        locale === "en"
          ? "Fullscreen is unavailable"
          : "plein écran est indisponible",
      );
      await expect(page.locator("#close-cooking")).toHaveAccessibleName(
        locale === "en" ? "Close cooking" : "Fermer la cuisson",
      );
      for (let index = 0; index < 8; index += 1) {
        await page.keyboard.press(index < 4 ? "Tab" : "Shift+Tab");
        expect(
          await page.evaluate(
            () => document.activeElement?.closest("#cook-dialog") !== null,
          ),
        ).toBe(true);
      }
      await page.locator("#close-cooking").focus();
      await page.keyboard.press("ArrowLeft");
      await expect(page.locator("#cook-previous")).toBeDisabled();
      await swipe(page, -100, 100);
      await swipe(page, -100, 0, true);
      await expect(page.locator("#cook-previous")).toBeDisabled();
      await page.keyboard.press("ArrowRight");
      await expect(page.locator("#cook-progress")).toContainText("2");
      await swipe(page, -100);
      await expect(page.locator("#cook-next")).toBeDisabled();
      await page.keyboard.press("ArrowRight");
      await swipe(page, -100);
      await expect(page.locator("#cook-progress")).toHaveText(
        locale === "en" ? "Step 3 of 3" : "Étape 3 sur 3",
      );
      await page.locator("#cook-previous").click();
      await page.locator("#cook-previous").click();
      await expect(page.locator("#cook-next")).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).not.toBeVisible();
      await expect(page.locator("#start-cooking")).toBeFocused();
    });
  }
}

test("locale changes in the open dialog keep the step and selection; closing never alters quantities", async ({
  page,
}) => {
  await capabilities(page, "absent");
  await page.goto("./");
  await page.locator("#target-servings").fill("8");
  await page.locator("#target-servings").press("Tab");
  await page.locator("#units").selectOption("imperial");
  await page.locator("#start-cooking").click();
  await page.locator("#cook-next").click();
  await page.locator("#cook-locale").selectOption("fr");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Crêpes");
  await expect(page.locator("#cook-progress")).toHaveText("Étape 2 sur 3");
  await expect(page.locator("#cook-step")).toHaveText(
    "Chauffer une poêle légèrement huilée à feu moyen.",
  );
  await expect(page.locator("#cook-feedback")).toContainText("veille");
  await page.locator("#close-cooking").click();
  await expect(page.locator("#start-cooking")).toBeFocused();
  await expect(page.locator("#target-servings")).toHaveValue("8");
  await expect(page.locator("#units")).toHaveValue("imperial");
  await page.locator("#start-cooking").click();
  await expect(page.locator("#cook-progress")).toHaveText("Étape 1 sur 3");
});

test("late requests on close, rapid reopen and stale denial cannot leak or disturb the new session", async ({
  page,
}) => {
  await capabilities(page, "controlled");
  await page.goto("./");
  await page.locator("#start-cooking").click();
  expect(await page.evaluate(() => window.cookHarness.activation)).toEqual([
    true,
  ]);
  await page.locator("#close-cooking").click();
  await page.locator("#start-cooking").click();
  await page.evaluate(() => {
    window.cookHarness.resolveWake(1);
    window.cookHarness.resolveFullscreen(0);
    window.cookHarness.resolveWake(0);
  });
  await expect
    .poll(() => page.evaluate(() => window.cookHarness.wakeReleased))
    .toBe(1);
  await expect
    .poll(() => page.evaluate(() => window.cookHarness.fullscreenExits))
    .toBe(1);
  expect(await page.evaluate(() => window.cookHarness.fullscreenCalls)).toBe(1);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("#cook-feedback")).not.toContainText("sleep");
  await page.locator("#close-cooking").click();
  await expect
    .poll(() => page.evaluate(() => window.cookHarness.wakeReleased))
    .toBe(2);
  await page.locator("#start-cooking").click();
  await page.locator("#close-cooking").click();
  await page.locator("#start-cooking").click();
  await page.evaluate(() => {
    window.cookHarness.rejectWake(2);
    window.cookHarness.rejectFullscreen(1);
    window.cookHarness.resolveWake(3);
  });
  await expect(page.locator("#cook-feedback")).not.toContainText("sleep");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator("#close-cooking").click();
  await expect
    .poll(() => page.evaluate(() => window.cookHarness.wakeReleased))
    .toBe(3);
});

test("background cleans pending and acquired resources, resumes wake lock only, and preserves external fullscreen", async ({
  page,
}) => {
  await capabilities(page, "controlled");
  await page.goto("./");
  await page.locator("#start-cooking").click();
  await page.evaluate(() => {
    window.cookHarness.visibility(false);
    window.cookHarness.resolveWake(0);
    window.cookHarness.resolveFullscreen(0);
  });
  await expect
    .poll(() => page.evaluate(() => window.cookHarness.wakeReleased))
    .toBe(1);
  await expect
    .poll(() => page.evaluate(() => window.cookHarness.fullscreenExits))
    .toBe(1);
  await page.evaluate(() => window.cookHarness.visibility(true));
  await expect
    .poll(() => page.evaluate(() => window.cookHarness.wakeCalls))
    .toBe(2);
  await page.evaluate(() => window.cookHarness.resolveWake(1));
  await page.evaluate(() => window.cookHarness.visibility(false));
  await expect
    .poll(() => page.evaluate(() => window.cookHarness.wakeReleased))
    .toBe(2);
  await page.evaluate(() => window.cookHarness.visibility(true));
  await page.evaluate(() => window.cookHarness.rejectWake(2));
  await expect(page.locator("#cook-feedback")).toContainText(
    "screen may sleep",
  );
  expect(await page.evaluate(() => window.cookHarness.fullscreenCalls)).toBe(1);
  await page.locator("#close-cooking").click();
  await page.evaluate(() => {
    window.cookHarness.visibility(false);
    window.cookHarness.visibility(true);
    window.cookHarness.externalFullscreen();
  });
  expect(await page.evaluate(() => window.cookHarness.wakeCalls)).toBe(3);
  await page.locator("#start-cooking").click();
  await page.locator("#close-cooking").click();
  expect(await page.evaluate(() => window.cookHarness.fullscreenCalls)).toBe(1);
  expect(await page.evaluate(() => window.cookHarness.fullscreenExits)).toBe(1);
});

test("acquired fullscreen and wake lock release on native cancel and page lifecycle suspension", async ({
  page,
}) => {
  await capabilities(page, "controlled");
  await page.goto("./");
  await page.locator("#start-cooking").click();
  await page.evaluate(() => {
    window.cookHarness.resolveWake(0);
    window.cookHarness.resolveFullscreen(0);
  });
  await page
    .locator("#cook-dialog")
    .evaluate((element) =>
      element.dispatchEvent(new Event("cancel", { cancelable: true })),
    );
  await expect(page.locator("#start-cooking")).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => window.cookHarness.wakeReleased))
    .toBe(1);
  await expect
    .poll(() => page.evaluate(() => window.cookHarness.fullscreenExits))
    .toBe(1);
  await page.locator("#start-cooking").click();
  await page.evaluate(() => {
    window.cookHarness.resolveWake(1);
    window.cookHarness.resolveFullscreen(1);
  });
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect
    .poll(() => page.evaluate(() => window.cookHarness.wakeReleased))
    .toBe(2);
  await expect
    .poll(() => page.evaluate(() => window.cookHarness.fullscreenExits))
    .toBe(2);
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await expect
    .poll(() => page.evaluate(() => window.cookHarness.wakeCalls))
    .toBe(3);
  await page.evaluate(() => window.cookHarness.resolveWake(2));
  await page.locator("#close-cooking").click();
  await expect
    .poll(() => page.evaluate(() => window.cookHarness.wakeReleased))
    .toBe(3);
});

for (const viewport of [
  { width: 360, height: 800 },
  { width: 768, height: 900 },
  { width: 1440, height: 900 },
]) {
  test(`large literal single-step dialog reflows and scrolls at ${viewport.width}px in both locales/themes`, async ({
    page,
    context,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await capabilities(page, "absent");
    await page.goto("./");
    await page.locator("#new-recipe").click();
    await expect(page.locator("#start-cooking")).toBeDisabled();
    await page.locator("#recipe-name").fill("<img src=x onerror=alert(1)>");
    await page.locator("#ingredient-lines").fill("salt");
    const literal =
      "<img src=x onerror=alert(1)> " + "Stir gently. ".repeat(140);
    await page.locator("#step-lines").fill(literal);
    await page.locator("#recipe-form button[type=submit]").click();
    for (const locale of ["en", "fr"]) {
      for (const theme of ["light", "dark"]) {
        await page.locator("#locale").selectOption(locale);
        await page.locator("#theme").selectOption(theme);
        await page.locator("#start-cooking").click();
        await expect(page.locator("#cook-step")).toHaveText(literal);
        await expect(page.locator("#cook-dialog img")).toHaveCount(0);
        await expect(page.locator("#cook-previous")).toBeDisabled();
        await expect(page.locator("#cook-next")).toBeDisabled();
        const bounds = await page.locator("#cook-dialog").boundingBox();
        expect(bounds?.width).toBe(viewport.width);
        expect(bounds?.height).toBe(viewport.height);
        expect(
          await page
            .locator("#cook-dialog")
            .evaluate((element) => element.scrollWidth <= element.clientWidth),
        ).toBe(true);
        for (const control of [
          "#close-cooking",
          "#cook-locale",
          "#cook-previous",
          "#cook-next",
        ]) {
          const box = await page.locator(control).boundingBox();
          expect(box?.height).toBeGreaterThanOrEqual(44);
          expect(box?.x).toBeGreaterThanOrEqual(0);
          expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
            viewport.width,
          );
        }
        await page.screenshot({
          path: testInfo.outputPath(`cook-${locale}-${theme}.png`),
        });
        await page.locator("#cook-scroll").focus();
        await page.keyboard.press("PageDown");
        await expect
          .poll(() =>
            page
              .locator("#cook-scroll")
              .evaluate((element) => element.scrollTop),
          )
          .toBeGreaterThan(0);
        await expect(page.locator("#close-cooking")).toBeVisible();
        await page.locator("#close-cooking").click();
      }
    }
    await page.setViewportSize({ width: 360, height: 400 });
    await page.locator("#start-cooking").click();
    await expect(page.locator("#close-cooking")).toBeVisible();
    await page.locator("#cook-scroll").evaluate((element) => {
      element.scrollTop = 0;
    });
    const client = await context.newCDPSession(page);
    await client.send("Emulation.setTouchEmulationEnabled", { enabled: true });
    const scroll = await page.locator("#cook-scroll").boundingBox();
    if (!scroll) throw new Error("Cook scroll area is missing");
    const start = scroll.y + scroll.height - 10;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 160, y: start }],
    });
    for (let index = 1; index <= 5; index += 1) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: 160, y: start - (index * (scroll.height - 20)) / 5 },
        ],
      });
    }
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(() =>
        page.locator("#cook-scroll").evaluate((element) => element.scrollTop),
      )
      .toBeGreaterThan(0);
    await expect(page.locator("#cook-progress")).toHaveText("Étape 1 sur 1");
    await client.detach();
    await page.locator("#close-cooking").click();
  });
}
