import { expect, test } from "@playwright/test";

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
