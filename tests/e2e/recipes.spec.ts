import { expect, test, type Page } from "@playwright/test";
import { inspectRendered, tabTo } from "./acceptance-helpers";

const key = "pinch:v1:document";
async function fillRecipe(page: Page, title = "My dinner") {
  await page.locator("#recipe-name").fill(title);
  await page.locator("#base-servings").fill("4");
  await page
    .locator("#ingredient-lines")
    .fill("250 g flour\n300 ml milk\n2 eggs\nsalt to taste");
  await page.locator("#step-lines").fill("1. Mix\n2) Bake");
}
async function storedBytes(page: Page) {
  return page.evaluate((documentKey) => localStorage.getItem(documentKey), key);
}

for (const locale of ["en", "fr"] as const) {
  for (const theme of ["light", "dark"] as const) {
    test(`keyboard temporary consent remains explicitly unsaved: ${locale}/${theme}`, async ({
      page,
    }, testInfo) => {
      await page.addInitScript(
        ({ locale, theme }) => {
          Object.defineProperty(navigator, "language", {
            value: locale === "fr" ? "fr-FR" : "en-US",
          });
          localStorage.setItem(
            "pinch:v1:document",
            JSON.stringify({
              schemaVersion: 1,
              userRecipes: [],
              shopping: [],
              preferences: { locale, theme, units: "metric" },
            }),
          );
          Storage.prototype.getItem = () => {
            throw new DOMException("Denied", "SecurityError");
          };
        },
        { locale, theme },
      );
      await page.goto("./");
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const bytes = await page.evaluate(
        () => localStorage["pinch:v1:document"],
      );
      await tabTo(page, "#new-recipe");
      await page.keyboard.press("Enter");
      await page.keyboard.type("Keyboard temporary");
      await page.keyboard.press("Tab");
      await page.keyboard.press("ControlOrMeta+A");
      await page.keyboard.type("4");
      await page.keyboard.press("Tab");
      await page.keyboard.type("salt to taste");
      await page.keyboard.press("Tab");
      await page.keyboard.type("Serve");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");
      await expect(page.locator("#library button")).toHaveCount(3);
      const order = await tabTo(page, "#temporary-session");
      await inspectRendered(
        page,
        testInfo,
        `temporary-consent-${locale}-${theme}`,
      );
      await page.keyboard.press("Enter");
      await expect(page.locator("#storage-warning")).toContainText(
        locale === "fr" ? "Session temporaire" : "Temporary session",
      );
      await tabTo(page, "#recipe-form button[type=submit]");
      await page.keyboard.press("Enter");
      await expect(page.locator("#recipe-title")).toHaveText(
        "Keyboard temporary",
      );
      expect(await page.evaluate(() => localStorage["pinch:v1:document"])).toBe(
        bytes,
      );
      await testInfo.attach("temporary-tab-order", {
        body: JSON.stringify(order),
        contentType: "application/json",
      });
      await page.reload();
      await expect(page.locator("#library button")).toHaveCount(3);
    });

    test(`AC2.2 preserved malformed lines and unknown counts: ${locale}/${theme}`, async ({
      page,
    }) => {
      const raw = [
        "salt to taste",
        "1/0 cup milk",
        "1-2 cups flour",
        "1 - 2 cups flour",
        "1, cups flour",
        "1. cups flour",
        "-1 cup flour",
        "1e3 g flour",
        "1 cup",
        "1000001 g flour",
        "999999999999999999999999 g flour",
      ];
      await page.goto("./");
      await page.locator("#locale").selectOption(locale);
      await page.locator("#theme").selectOption(theme);
      await page.locator("#new-recipe").click();
      await fillRecipe(page, "Preserved inputs");
      await page
        .locator("#ingredient-lines")
        .fill([...raw, "3 scoops flour"].join("\n"));
      await page.locator("#recipe-form button[type=submit]").click();
      const recipes = JSON.parse((await storedBytes(page)) ?? "{}").userRecipes;
      for (const servings of [8, 1, 4]) {
        await page.locator("#target-servings").fill(String(servings));
        await page.locator("#target-servings").press("Tab");
        for (const units of ["imperial", "metric"]) {
          await page.locator("#units").selectOption(units);
          for (const [index, line] of raw.entries()) {
            await expect(
              page.locator("#recipe-ingredients li").nth(index),
            ).toHaveText(line);
          }
          await expect(
            page.locator("#recipe-ingredients li").last().locator("span"),
          ).toHaveText([
            servings === 8 ? "6" : servings === 1 ? "3/4" : "3",
            "scoops flour",
          ]);
          expect(
            JSON.parse((await storedBytes(page)) ?? "{}").userRecipes,
          ).toEqual(recipes);
        }
      }
    });

    test(`field error matrix preserves drafts and focuses each invalid field: ${locale}/${theme}`, async ({
      page,
    }) => {
      const messages =
        locale === "en"
          ? {
              title: "Enter a title of 1 to 200 characters.",
              servings: "Enter a whole number of servings from 1 to 24.",
              ingredients:
                "Enter 1 to 200 nonempty ingredient lines, at most 500 characters each.",
              steps:
                "Enter 1 to 100 nonempty steps, at most 2,000 characters each.",
            }
          : {
              title: "Saisissez un titre de 1 à 200 caractères.",
              servings: "Saisissez un nombre entier de portions de 1 à 24.",
              ingredients:
                "Saisissez 1 à 200 lignes d'ingrédients non vides, de 500 caractères maximum chacune.",
              steps:
                "Saisissez 1 à 100 étapes non vides, de 2 000 caractères maximum chacune.",
            };
      await page.goto("./");
      await page.locator("#locale").selectOption(locale);
      await page.locator("#theme").selectOption(theme);
      await page.locator("#new-recipe").click();
      const bytes = await storedBytes(page);
      const cases = [
        {
          field: "recipe-name",
          error: "title-error",
          message: messages.title,
          values: ["", " ", "x".repeat(201)],
        },
        {
          field: "base-servings",
          error: "base-error",
          message: messages.servings,
          values: ["", "0", "25", "1.5", "-1"],
        },
        {
          field: "ingredient-lines",
          error: "ingredients-error",
          message: messages.ingredients,
          values: [
            "",
            " \n ",
            "x".repeat(501),
            Array(201).fill("salt").join("\n"),
          ],
        },
        {
          field: "step-lines",
          error: "steps-error",
          message: messages.steps,
          values: [
            "",
            " \n ",
            "x".repeat(2001),
            Array(101).fill("Mix").join("\n"),
            "1. ",
          ],
        },
      ];
      for (const entry of cases) {
        for (const value of entry.values) {
          await fillRecipe(page);
          await page.locator(`#${entry.field}`).fill(value);
          const draft = await page
            .locator("#recipe-form input, #recipe-form textarea")
            .evaluateAll((elements) =>
              elements.map((element) => (element as HTMLInputElement).value),
            );
          await page.locator("#recipe-form button[type=submit]").click();
          await expect(page.locator(`#${entry.field}`)).toBeFocused();
          await expect(page.locator(`#${entry.field}`)).toHaveAttribute(
            "aria-invalid",
            "true",
          );
          await expect(page.locator(`#${entry.field}`)).toHaveAttribute(
            "aria-describedby",
            entry.error,
          );
          await expect(page.locator(`#${entry.error}`)).toHaveText(
            entry.message,
          );
          expect(
            await page
              .locator("#recipe-form input, #recipe-form textarea")
              .evaluateAll((elements) =>
                elements.map((element) => (element as HTMLInputElement).value),
              ),
          ).toEqual(draft);
          expect(await storedBytes(page)).toBe(bytes);
          await expect(page.locator("#library button")).toHaveCount(3);
        }
      }
    });
  }
}

test("three samples scale from base, convert without drift, and reload without duplicate seeds", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator("#library button")).toHaveCount(3);
  await expect(page.locator("#recipe-title")).toHaveText("Pancakes");
  await expect(page.locator("#recipe-ingredients li").first()).toContainText(
    "250 g",
  );
  await page.locator("#target-servings").fill("8");
  await page.locator("#target-servings").press("Tab");
  await expect(page.locator("#recipe-ingredients li").first()).toContainText(
    "500 g",
  );
  await expect(page.locator("#recipe-ingredients li").nth(1)).toContainText(
    "600 ml",
  );
  await expect(
    page.locator("#recipe-ingredients li").nth(2).locator("span"),
  ).toHaveText(["4", "eggs"]);
  await page.locator("#target-servings").fill("1");
  await page.locator("#target-servings").press("Tab");
  await expect(
    page.locator("#recipe-ingredients li").nth(2).locator("span"),
  ).toHaveText(["1/2", "eggs"]);
  await page.locator("#target-servings").fill("8");
  await page.locator("#target-servings").press("Tab");
  await page.locator("#units").selectOption("imperial");
  await expect(page.locator("#recipe-ingredients li").first()).toContainText(
    "oz",
  );
  await page.locator("#locale").selectOption("fr");
  await expect(page.locator("#recipe-title")).toHaveText("Crêpes");
  await expect(page.locator("#target-servings")).toHaveValue("8");
  await expect(page.locator("#units")).toHaveValue("imperial");
  await expect(page.locator("#recipe-ingredients li").first()).toContainText(
    "farine",
  );
  await page.locator("#units").selectOption("metric");
  await expect(page.locator("#recipe-ingredients li").first()).toContainText(
    "500 g",
  );
  await page.locator("#target-servings").fill("1.5");
  await page.locator("#target-servings").press("Tab");
  await expect(page.locator("#target-servings")).toHaveValue("8");
  await expect(page.locator("#target-error")).toContainText("nombre entier");
  await page.reload();
  await expect(page.locator("#library button")).toHaveCount(3);
  await expect(page.locator("#target-servings")).toHaveValue("4");
  const bytes = await storedBytes(page);
  expect(bytes).not.toContain("sample-");
});

test("create, edit and cancel preserve selection and persist exact user content", async ({
  page,
}) => {
  await page.goto("./");
  await page.locator("#new-recipe").click();
  await expect(page.locator("#recipe-name")).toBeFocused();
  await fillRecipe(page);
  await page.locator("#recipe-form button[type=submit]").click();
  await expect(page.locator("#recipe-title")).toHaveText("My dinner");
  await expect(page.locator("#recipe-steps li")).toHaveText(["Mix", "Bake"]);
  const before = await storedBytes(page);
  await page.locator("#edit-recipe").click();
  await page.locator("#recipe-name").fill("Cancelled change");
  await page.locator("#cancel-editor").click();
  await expect(page.locator("#edit-recipe")).toBeFocused();
  await expect(page.locator("#recipe-title")).toHaveText("My dinner");
  expect(await storedBytes(page)).toBe(before);
  await page.locator("#edit-recipe").click();
  await page.locator("#recipe-name").fill("My supper");
  await page.locator("#locale").selectOption("fr");
  await expect(page.locator("#recipe-name")).toHaveValue("My supper");
  await page.locator("#recipe-form button[type=submit]").click();
  await expect(page.locator("#library button")).toHaveCount(4);
  await expect(page.locator("#recipe-title")).toHaveText("My supper");
  await page.reload();
  await expect(page.locator("#recipe-title")).toHaveText("Crêpes");
  await page.getByRole("button", { name: "My supper", exact: true }).click();
  await expect(page.locator("#recipe-ingredients li").first()).toContainText(
    "flour",
  );
  await expect(page.locator("#recipe-steps li")).toHaveText(["Mix", "Bake"]);
});

test("editing a sample creates a user copy and cancellation never changes the sample", async ({
  page,
}) => {
  await page.goto("./");
  await page.locator("#edit-recipe").click();
  await page.locator("#recipe-name").fill("Pancake copy");
  await page.locator("#recipe-form button[type=submit]").click();
  await expect(page.locator("#library button")).toHaveCount(4);
  await page.getByRole("button", { name: "Pancakes", exact: true }).click();
  await expect(page.locator("#recipe-title")).toHaveText("Pancakes");
  await expect(page.locator("#recipe-ingredients li").first()).toContainText(
    "250 g",
  );
  await page.locator("#new-recipe").click();
  await fillRecipe(page, "Never saved");
  await page.locator("#cancel-editor").click();
  await expect(page.locator("#recipe-title")).toHaveText("Pancakes");
  await expect(page.locator("#library button")).toHaveCount(4);
});

test("field errors localize in an open editor, focus invalid fields and preserve raw drafts", async ({
  page,
}) => {
  await page.goto("./");
  await page.locator("#new-recipe").click();
  await page.locator("#recipe-form button[type=submit]").click();
  await expect(page.locator("#recipe-name")).toBeFocused();
  await expect(page.locator("#recipe-name")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.locator("#locale").selectOption("fr");
  await expect(page.locator("#title-error")).toContainText("Saisissez");
  await fillRecipe(page);
  await page.locator("#base-servings").fill("25");
  const bytes = await storedBytes(page);
  await page.locator("#recipe-form button[type=submit]").click();
  await expect(page.locator("#base-servings")).toBeFocused();
  expect(await storedBytes(page)).toBe(bytes);
  await page.locator("#base-servings").fill("4");
  await page.locator("#ingredient-lines").fill("a".repeat(501));
  await page.locator("#recipe-form button[type=submit]").click();
  await expect(page.locator("#ingredient-lines")).toBeFocused();
  await expect(page.locator("#ingredient-lines")).toHaveValue("a".repeat(501));
  expect(await storedBytes(page)).toBe(bytes);
});

test("untrusted user content is literal text, never markup", async ({
  page,
}) => {
  await page.goto("./");
  await page.locator("#new-recipe").click();
  const literal = "<img src=x onerror=alert(1)>";
  await fillRecipe(page, literal);
  await page.locator("#ingredient-lines").fill(literal);
  await page.locator("#step-lines").fill(literal);
  await page.locator("#recipe-form button[type=submit]").click();
  await expect(page.locator("#recipe-title")).toHaveText(literal);
  await expect(page.locator("#recipe-ingredients")).toHaveText(literal);
  await expect(page.locator("#recipe-steps")).toHaveText(literal);
  await page.locator("#add-shopping").click();
  await page.locator("#add-shopping").click();
  await expect(page.locator("#shopping-list li")).toHaveCount(1);
  await expect(page.locator("#shopping-list label")).toHaveText(literal);
  await expect(page.locator("img")).toHaveCount(0);
  await page.locator("#locale").selectOption("fr");
  await expect(page.locator("#recipe-title")).toHaveText(literal);
});

test("quota failures retain preferences, recipe selection, stored bytes and drafts for retry", async ({
  page,
}) => {
  await page.goto("./");
  await page.locator("#theme").selectOption("light");
  const bytes = await storedBytes(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Object.defineProperty(window, "restoreStorage", {
      value: () => {
        Storage.prototype.setItem = original;
      },
    });
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page.locator("#theme").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("#theme")).toHaveValue("light");
  await page.locator("#new-recipe").click();
  await fillRecipe(page);
  await page.locator("#recipe-form button[type=submit]").click();
  await expect(page.locator("#status")).toContainText("storage is full");
  await expect(page.locator("#recipe-title")).toHaveText("Pancakes");
  await expect(page.locator("#recipe-name")).toHaveValue("My dinner");
  expect(await storedBytes(page)).toBe(bytes);
  await page.evaluate(() => {
    if (
      "restoreStorage" in window &&
      typeof window.restoreStorage === "function"
    )
      window.restoreStorage();
  });
  await page.locator("#recipe-form button[type=submit]").click();
  await expect(page.locator("#recipe-title")).toHaveText("My dinner");
});

for (const raw of ["broken-json", '{"schemaVersion":2}']) {
  test(`retains corrupt/unsupported bytes: ${raw}`, async ({ page }) => {
    await page.addInitScript(
      ({ documentKey, bytes }) => localStorage.setItem(documentKey, bytes),
      { documentKey: key, bytes: raw },
    );
    await page.goto("./");
    await expect(page.locator("#storage-warning")).not.toBeEmpty();
    await page.locator("#new-recipe").click();
    await fillRecipe(page);
    await page.locator("#recipe-form button[type=submit]").click();
    await expect(page.locator("#editor")).toBeVisible();
    await expect(page.locator("#library button")).toHaveCount(3);
    expect(await storedBytes(page)).toBe(raw);
  });
}

test("denied storage requires an explicitly unsaved temporary session", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get: () => {
        throw new DOMException("Denied", "SecurityError");
      },
    });
  });
  await page.goto("./");
  await expect(page.locator("#storage-warning")).toContainText(
    "storage is unavailable",
  );
  await page.locator("#new-recipe").click();
  await fillRecipe(page);
  await page.locator("#recipe-form button[type=submit]").click();
  await expect(page.locator("#library button")).toHaveCount(3);
  await page.locator("#temporary-session").click();
  await page.locator("#recipe-form button[type=submit]").click();
  await expect(page.locator("#recipe-title")).toHaveText("My dinner");
  await expect(page.locator("#storage-warning")).toContainText(
    "Temporary session",
  );
  await page.reload();
  await expect(page.locator("#library button")).toHaveCount(3);
});

test("cross-tab changes block stale writes without losing the draft", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await page.locator("#new-recipe").click();
  await fillRecipe(page);
  const other = await context.newPage();
  await other.goto("./");
  await other.locator("#theme").selectOption("dark");
  const changedBytes = await storedBytes(other);
  await expect(page.locator("#storage-warning")).toContainText("another tab");
  await page.locator("#recipe-form button[type=submit]").click();
  await expect(page.locator("#recipe-name")).toHaveValue("My dinner");
  await expect(page.locator("#library button")).toHaveCount(3);
  expect(await storedBytes(page)).toBe(changedBytes);
  await other.close();
});

test("recipe and editor reflow in both languages and themes with keyboard focus", async ({
  page,
}) => {
  await page.goto("./");
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const locale of ["en", "fr"]) {
      await page.locator("#locale").selectOption(locale);
      for (const theme of ["light", "dark"]) {
        await page.locator("#theme").selectOption(theme);
        await page.locator("#new-recipe").click();
        await expect(page.locator("#recipe-name")).toBeFocused();
        await fillRecipe(page, "X".repeat(200));
        await page.locator("#recipe-form button[type=submit]").click();
        await page.locator("#add-shopping").click();
        const dimensions = await page.evaluate(() => ({
          client: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
        await page.locator("#edit-recipe").click();
        const editorDimensions = await page.evaluate(() => ({
          client: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        expect(editorDimensions.scroll).toBeLessThanOrEqual(
          editorDimensions.client,
        );
        await page.locator("#cancel-editor").click();
        await expect(page.locator("#edit-recipe")).toBeFocused();
      }
    }
  }
});

test("shopping adds scaled snapshots, reopens checked rows and persists keyboard checklist changes", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator("#shopping-empty")).toBeVisible();
  await expect(page.locator("#clear-checked")).toBeDisabled();
  await page.locator("#target-servings").fill("8");
  await page.locator("#target-servings").press("Tab");
  await page.locator("#add-shopping").click();
  await page.locator("#add-shopping").click();
  const rows = page.locator("#shopping-list li");
  await expect(rows.nth(0)).toHaveText("1,000 g flour");
  await expect(rows.nth(1)).toHaveText("1,200 ml milk");
  await expect(rows.nth(2)).toHaveText("8 eggs");
  const count = await rows.count();
  const checkbox = page.locator("#shopping-list input").first();
  await checkbox.focus();
  await checkbox.press("Space");
  await expect(checkbox).toBeChecked();
  await expect(checkbox).toBeFocused();
  await page.reload();
  await expect(checkbox).toBeChecked();
  await checkbox.focus();
  await checkbox.press("Space");
  await expect(checkbox).not.toBeChecked();
  await page.reload();
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await page.locator("#add-shopping").click();
  await expect(checkbox).not.toBeChecked();
  await expect(rows.nth(0)).toHaveText("1,250 g flour");
  await expect(rows).toHaveCount(count);
  await checkbox.check();
  await page.locator("#clear-checked").click();
  await expect(page.locator("#add-shopping")).toBeFocused();
  await expect(rows).toHaveCount(count - 1);
  await expect(rows.first()).toHaveText("1,500 ml milk");
  await page.reload();
  await expect(rows).toHaveCount(count - 1);
  for (const remaining of await page.locator("#shopping-list input").all())
    await remaining.check();
  await page.locator("#clear-checked").click();
  await expect(page.locator("#shopping-empty")).toBeVisible();
  await page.locator("#locale").selectOption("fr");
  await expect(page.locator("#shopping-empty")).toHaveText(
    "Votre liste de courses est vide.",
  );
});

test("shopping keeps add-time units and literal language names when preferences and servings change", async ({
  page,
}) => {
  await page.goto("./");
  await page.locator("#units").selectOption("imperial");
  await page.locator("#add-shopping").click();
  const firstSnapshot = await storedBytes(page);
  await page.locator("#units").selectOption("metric");
  await page.locator("#target-servings").fill("8");
  await page.locator("#target-servings").press("Tab");
  await expect(page.locator("#shopping-list li").first()).toContainText(
    "oz flour",
  );
  await page.locator("#add-shopping").click();
  await expect(
    page.getByRole("checkbox", { name: "500 g flour", exact: true }),
  ).toBeVisible();
  await page.locator("#locale").selectOption("fr");
  await expect(page.locator("#shopping-list li").first()).toContainText(
    "oz flour",
  );
  await page.locator("#add-shopping").click();
  await expect(
    page.getByRole("checkbox", { name: "500 g farine", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "600 ml lait", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "500 g flour", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("#shopping-list li").first()).toContainText(
    "oz flour",
  );
  const preserved = await page.evaluate((documentKey) => {
    const saved = JSON.parse(localStorage.getItem(documentKey) ?? "{}");
    return saved.shopping[0];
  }, key);
  expect(preserved).toEqual(JSON.parse(firstSnapshot ?? "{}").shopping[0]);
});

test("shopping stores unrounded quantities and remains independent of recipe edits", async ({
  page,
}) => {
  await page.goto("./");
  await page.locator("#new-recipe").click();
  await fillRecipe(page, "Precision");
  await page
    .locator("#ingredient-lines")
    .fill("1/3 g flour\nsalt to taste\n SALT  to TASTE");
  await page.locator("#recipe-form button[type=submit]").click();
  await page.locator("#add-shopping").click();
  await page.locator("#add-shopping").click();
  await expect(page.locator("#shopping-list li")).toHaveCount(2);
  expect(
    JSON.parse((await storedBytes(page)) ?? "{}").shopping[0].quantity,
  ).toBe(2 / 3);
  await expect(page.locator("#shopping-list li").first()).toHaveText(
    "< 1 g flour",
  );
  await page.locator("#edit-recipe").click();
  await page.locator("#ingredient-lines").fill("2 g sugar");
  await page.locator("#recipe-form button[type=submit]").click();
  await expect(page.locator("#shopping-list li").first()).toHaveText(
    "< 1 g flour",
  );
  await page.reload();
  expect(
    JSON.parse((await storedBytes(page)) ?? "{}").shopping[0].quantity,
  ).toBe(2 / 3);
});

test("shopping quota failures revert check, add and clear atomically and allow retry", async ({
  page,
}) => {
  await page.goto("./");
  await page.locator("#add-shopping").click();
  const checkbox = page.locator("#shopping-list input").first();
  await checkbox.check();
  const bytes = await storedBytes(page);
  const labels = await page.locator("#shopping-list label").allTextContents();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Object.defineProperty(window, "restoreShoppingStorage", {
      value: () => {
        Storage.prototype.setItem = original;
      },
    });
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await checkbox.focus();
  await checkbox.press("Space");
  await expect(checkbox).toBeChecked();
  await expect(checkbox).toBeFocused();
  await page.locator("#clear-checked").click();
  await expect(page.locator("#shopping-list label")).toHaveText(labels);
  await page.locator("#add-shopping").click();
  await expect(checkbox).toBeChecked();
  await expect(page.locator("#shopping-list label")).toHaveText(labels);
  await expect(page.locator("#status")).toContainText("No change was saved");
  expect(await storedBytes(page)).toBe(bytes);
  await page.evaluate(() => {
    if (
      "restoreShoppingStorage" in window &&
      typeof window.restoreShoppingStorage === "function"
    )
      window.restoreShoppingStorage();
  });
  await page.locator("#add-shopping").click();
  await expect(checkbox).not.toBeChecked();
  await expect(page.locator("#shopping-list li").first()).toHaveText(
    "500 g flour",
  );
});

for (const limit of ["quantity", "rows"]) {
  test(`shopping ${limit} limit rejects all changes and preserves durable bytes`, async ({
    page,
  }) => {
    await page.goto("./");
    await page.locator("#add-shopping").click();
    await page.evaluate(
      ({ documentKey, exceeded }) => {
        const saved = JSON.parse(localStorage.getItem(documentKey) ?? "{}");
        if (exceeded === "quantity") {
          saved.shopping[1].quantity = 1_000_000;
          saved.shopping[0].checked = true;
        } else {
          saved.shopping = Array.from({ length: 1000 }, (_, index) => ({
            kind: "text",
            id: `item-${index}`,
            raw: `ingredient ${index}`,
            checked: true,
          }));
        }
        localStorage.setItem(documentKey, JSON.stringify(saved));
      },
      { documentKey: key, exceeded: limit },
    );
    await page.reload();
    const bytes = await storedBytes(page);
    const labels = await page.locator("#shopping-list label").allTextContents();
    await page.locator("#add-shopping").click();
    await expect(page.locator("#status")).toContainText("No change was saved");
    await expect(page.locator("#shopping-list label")).toHaveText(labels);
    await expect(page.locator("#shopping-list input").first()).toBeChecked();
    expect(await storedBytes(page)).toBe(bytes);
  });
}
