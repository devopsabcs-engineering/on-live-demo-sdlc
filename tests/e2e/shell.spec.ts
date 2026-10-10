import { expect, test } from "@playwright/test";

test("acceptance: theme contrast, named targets and reduced-motion reflow", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  for (const locale of ["en", "fr"]) {
    await page.locator("#locale").selectOption(locale);
    for (const theme of ["light", "dark"]) {
      await page.locator("#theme").selectOption(theme);
      const ratios = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        const luminance = (token: string) => {
          const hex = style.getPropertyValue(token).trim().slice(1);
          const channels = [0, 2, 4].map((offset) => {
            const value =
              Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
            return value <= 0.04045
              ? value / 12.92
              : ((value + 0.055) / 1.055) ** 2.4;
          });
          return (
            channels[0]! * 0.2126 +
            channels[1]! * 0.7152 +
            channels[2]! * 0.0722
          );
        };
        return [
          ["--ink", "--canvas", 4.5],
          ["--ink", "--surface", 4.5],
          ["--muted", "--canvas", 4.5],
          ["--muted", "--surface", 4.5],
          ["--action-ink", "--action", 4.5],
          ["--action", "--surface", 4.5],
          ["--border", "--surface", 3],
          ["--border", "--canvas", 3],
          ["--focus", "--surface", 3],
          ["--focus", "--canvas", 3],
        ].map(([foreground, background, minimum]) => {
          const first = luminance(String(foreground));
          const second = luminance(String(background));
          return {
            foreground,
            background,
            minimum: Number(minimum),
            ratio:
              (Math.max(first, second) + 0.05) /
              (Math.min(first, second) + 0.05),
          };
        });
      });
      for (const pair of ratios)
        expect(
          pair.ratio,
          `${theme}: ${pair.foreground}/${pair.background}`,
        ).toBeGreaterThanOrEqual(pair.minimum);
      await page.locator("#add-shopping").click();
      await page.locator("#new-recipe").click();
      await page.locator("#recipe-form button[type=submit]").click();
      await expect(page.locator("#recipe-name")).toBeFocused();
      await expect(page.locator("#recipe-name")).toHaveAttribute(
        "aria-describedby",
        "title-error",
      );
      await expect(page.locator("#title-error")).not.toBeEmpty();
      for (const width of [360, 768, 1440]) {
        await page.setViewportSize({ width, height: 800 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        for (const control of await page
          .locator(
            "button:visible, select:visible, input:visible, textarea:visible",
          )
          .all()) {
          await expect(control).toHaveAccessibleName(/\S/);
          const bounds = await control.boundingBox();
          expect(bounds).not.toBeNull();
          expect(bounds!.width).toBeGreaterThanOrEqual(44);
          expect(bounds!.height).toBeGreaterThanOrEqual(44);
          expect(bounds!.x).toBeGreaterThanOrEqual(0);
          expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
        }
      }
      await page.locator("#recipe-name").focus();
      await page.keyboard.press("Tab");
      expect(
        await page
          .locator("#base-servings")
          .evaluate((element) => getComputedStyle(element).outlineStyle),
      ).toBe("solid");
      expect(
        await page
          .locator("#base-servings")
          .evaluate((element) =>
            Number.parseFloat(getComputedStyle(element).transitionDuration),
          ),
      ).toBeLessThanOrEqual(0.00001);
      await page.locator("#cancel-editor").click();
    }
  }
});

test("acceptance: keyboard workbench flow without fullscreen or wake lock", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      value: undefined,
    });
    Object.defineProperty(navigator, "wakeLock", { value: undefined });
  });
  await page.goto("./");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  await page.locator("#new-recipe").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.type("Keyboard supper");
  await page.keyboard.press("Tab");
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("4");
  await page.keyboard.press("Tab");
  await page.keyboard.type("250 g flour");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Mix\nServe");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.locator("#recipe-title")).toHaveText("Keyboard supper");
  await page.locator("#increase-servings").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#target-servings")).toHaveValue("5");
  await page.locator("#units").focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Tab");
  await expect(page.locator("#units")).toHaveValue("imperial");
  await page.locator("#add-shopping").focus();
  await page.keyboard.press("Enter");
  await page.locator("#shopping-list input").focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#shopping-list input")).toBeChecked();
  await page.locator("#clear-checked").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#shopping-list li")).toHaveCount(0);
  await page.locator("#start-cooking").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#cook-step")).toHaveText("Serve");
  await page.keyboard.press("Escape");
  await expect(page.locator("#start-cooking")).toBeFocused();
  const download = page.waitForEvent("download");
  await page.locator("#export-data").focus();
  await page.keyboard.press("Enter");
  expect((await download).suggestedFilename()).toBe("pinch-v1.json");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.locator("#reset-data").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#recipe-title")).toHaveText("Keyboard supper");
});

test("switches and persists language and theme preferences", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page).toHaveTitle(/Pinch/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.locator("#locale").selectOption("fr");
  await page.locator("#theme").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "recettes",
  );

  await page.reload();
  await expect(page.locator("#locale")).toHaveValue("fr");
  await expect(page.locator("#theme")).toHaveValue("dark");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});

test("keeps the shell within mobile, tablet, and desktop widths", async ({
  page,
}) => {
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./");
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    await expect(page.locator("#locale")).toBeVisible();
    await expect(page.locator("#theme")).toBeVisible();
  }
});

test("exposes a keyboard skip link and named preference controls", async ({
  page,
}) => {
  await page.goto("./");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await expect(page.locator("#locale")).toHaveAccessibleName("Language");
  await expect(page.locator("#theme")).toHaveAccessibleName("Appearance");
});

test("tracks system appearance until an explicit theme is selected", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("./");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.locator("#theme").selectOption("light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
