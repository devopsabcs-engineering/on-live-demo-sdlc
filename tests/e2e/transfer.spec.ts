import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const key = "pinch:v1:document";
const transferDocument = {
  schemaVersion: 1,
  userRecipes: [
    {
      id: "user-transfer",
      title: "Soupe <b>maison</b>",
      baseServings: 4,
      ingredients: [
        {
          kind: "parsed",
          raw: "1/3 g farine",
          quantity: 1 / 3,
          unit: "g",
          name: "farine",
        },
        { kind: "text", raw: "sel au goût" },
      ],
      steps: ["Mélanger <img src=x onerror=alert(1)>", "Servir"],
    },
  ],
  shopping: [
    {
      kind: "parsed",
      id: "item-transfer",
      quantity: 1 / 3,
      unit: "g",
      name: "farine",
      checked: true,
    },
  ],
  preferences: { locale: "fr", theme: "dark", units: "imperial" },
};

async function seed(page: Page, raw = JSON.stringify(transferDocument)) {
  await page.goto("./");
  await page.evaluate(
    ({ key, raw }) => {
      localStorage.setItem(key, raw);
      localStorage.setItem("foreign-app", "keep");
    },
    { key, raw },
  );
  await page.reload();
}

async function stored(page: Page) {
  return page.evaluate((key) => localStorage.getItem(key), key);
}

async function upload(page: Page, raw: string | Buffer) {
  await page.locator("#import-file").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: typeof raw === "string" ? Buffer.from(raw, "utf8") : raw,
  });
}

async function download(page: Page) {
  const ready = page.waitForEvent("download");
  await page.locator("#export-data").click();
  const downloaded = await ready;
  const path = await downloaded.path();
  if (!path) throw Error("Download has no local path");
  return {
    name: downloaded.suggestedFilename(),
    raw: await readFile(path, "utf8"),
  };
}

test("schema-v1 download imports into a clean profile without duplicate samples or executable markup", async ({
  page,
  browser,
}) => {
  await seed(page);
  const exported = await download(page);
  expect(exported.name).toBe("pinch-v1.json");
  expect(JSON.parse(exported.raw)).toEqual(transferDocument);
  expect(exported.raw).not.toContain("sample-");
  const clean = await browser.newContext({ locale: "en-US" });
  try {
    const target = await clean.newPage();
    await target.goto(page.url());
    target.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("Replace all Pinch");
      await dialog.accept();
    });
    await upload(target, exported.raw);
    await expect(target.locator("#status")).toContainText("remplacées");
    expect(JSON.parse((await stored(target)) ?? "")).toEqual(transferDocument);
    await expect(target.locator("#library button")).toHaveCount(4);
    await expect(target.locator("#locale")).toHaveValue("fr");
    await expect(target.locator("#theme")).toHaveValue("dark");
    await expect(target.locator("#units")).toHaveValue("imperial");
    await expect(target.locator("#shopping-list input")).toBeChecked();
    await target
      .getByRole("button", {
        name: transferDocument.userRecipes[0]?.title ?? "",
        exact: true,
      })
      .click();
    await expect(target.locator("#recipe-steps li").first()).toHaveText(
      transferDocument.userRecipes[0]?.steps[0] ?? "",
    );
    await expect(target.locator("img, b")).toHaveCount(0);
    await target.reload();
    await expect(target.locator("#library button")).toHaveCount(4);
    expect(JSON.parse((await stored(target)) ?? "")).toEqual(transferDocument);
  } finally {
    await clean.close();
  }
});

for (const locale of ["en", "fr"] as const) {
  test(`${locale}: cancelling import and reset leaves bytes, preferences, selection and draft untouched`, async ({
    page,
  }) => {
    await seed(
      page,
      JSON.stringify({
        ...transferDocument,
        preferences: { ...transferDocument.preferences, locale },
      }),
    );
    await page
      .getByRole("button", {
        name: transferDocument.userRecipes[0]?.title ?? "",
        exact: true,
      })
      .click();
    await page.locator("#target-servings").fill("8");
    await page.locator("#target-servings").press("Tab");
    await page.locator("#edit-recipe").click();
    await page.locator("#recipe-name").fill("Unsaved draft");
    const before = await stored(page);
    const messages: string[] = [];
    page.on("dialog", async (dialog) => {
      messages.push(dialog.message());
      await dialog.dismiss();
    });
    await upload(page, JSON.stringify({ ...transferDocument, shopping: [] }));
    await expect.poll(() => messages.length).toBe(1);
    await page.locator("#reset-data").click();
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain(
      locale === "fr" ? "Remplacer toutes" : "Replace all",
    );
    expect(messages[1]).toContain(
      locale === "fr" ? "Effacer toutes" : "Clear all",
    );
    expect(await stored(page)).toBe(before);
    await expect(page.locator("#recipe-title")).toHaveText(
      transferDocument.userRecipes[0]?.title ?? "",
    );
    await expect(page.locator("#target-servings")).toHaveValue("8");
    await expect(page.locator("#recipe-name")).toHaveValue("Unsaved draft");
    await expect(page.locator("#editor")).toBeVisible();
    await expect(page.locator("#locale")).toHaveValue(locale);
    await expect(page.locator("#shopping-list input")).toBeChecked();
  });
}

const invalid = [
  ["JSON", "{"],
  ["version", JSON.stringify({ ...transferDocument, schemaVersion: 2 })],
  ["extras", JSON.stringify({ ...transferDocument, samples: [] })],
  [
    "duplicate IDs",
    JSON.stringify({
      ...transferDocument,
      userRecipes: [
        ...transferDocument.userRecipes,
        ...transferDocument.userRecipes,
      ],
    }),
  ],
  [
    "numeric value",
    JSON.stringify({
      ...transferDocument,
      shopping: [{ ...transferDocument.shopping[0], quantity: -1 }],
    }),
  ],
  [
    "raw mismatch",
    JSON.stringify({
      ...transferDocument,
      userRecipes: [
        {
          ...transferDocument.userRecipes[0],
          ingredients: [
            {
              kind: "parsed",
              raw: "1 g flour",
              quantity: 2,
              unit: "g",
              name: "flour",
            },
          ],
        },
      ],
    }),
  ],
  [
    "field limit",
    JSON.stringify({
      ...transferDocument,
      userRecipes: [
        { ...transferDocument.userRecipes[0], title: "x".repeat(201) },
      ],
    }),
  ],
];
for (const [name, raw] of invalid) {
  test(`rejects ${name} before confirmation without replacing data`, async ({
    page,
  }) => {
    await seed(page);
    const before = await stored(page);
    let confirmations = 0;
    page.on("dialog", async (dialog) => {
      confirmations++;
      await dialog.dismiss();
    });
    await upload(page, raw ?? "");
    await expect(page.locator("#status")).toContainText(
      "document est invalide",
    );
    expect(confirmations).toBe(0);
    expect(await stored(page)).toBe(before);
    await expect(page.locator("#library button")).toHaveCount(4);
    await expect(page.locator("#locale")).toHaveValue("fr");
  });
}

test("rejects oversized UTF-8 before reading and rejects unreadable or malformed UTF-8", async ({
  page,
}) => {
  await seed(page);
  const before = await stored(page);
  await page.evaluate(() => {
    const original = File.prototype.arrayBuffer;
    Object.defineProperty(window, "restoreFileRead", {
      value: () => {
        File.prototype.arrayBuffer = original;
      },
    });
    File.prototype.arrayBuffer = () => Promise.reject(Error("read denied"));
  });
  await upload(page, "é".repeat(1024 * 1024 + 1));
  await expect(page.locator("#status")).toContainText("limite est dépassée");
  await upload(page, JSON.stringify(transferDocument));
  await expect(page.locator("#status")).toContainText("illisible en UTF-8");
  await page.evaluate(() => {
    if (
      "restoreFileRead" in window &&
      typeof window.restoreFileRead === "function"
    )
      window.restoreFileRead();
  });
  await upload(page, Buffer.from([0xff, 0xfe]));
  await expect(page.locator("#status")).toContainText("illisible en UTF-8");
  expect(await stored(page)).toBe(before);
});

test("valid import write failure and reset removal failure retain state and drafts", async ({
  page,
}) => {
  await seed(page);
  await page
    .getByRole("button", {
      name: transferDocument.userRecipes[0]?.title ?? "",
      exact: true,
    })
    .click();
  await page.locator("#edit-recipe").click();
  await page.locator("#recipe-name").fill("Keep this draft");
  const before = await stored(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
    Storage.prototype.removeItem = () => {
      throw new DOMException("Denied", "SecurityError");
    };
  });
  page.on("dialog", async (dialog) => dialog.accept());
  await upload(
    page,
    JSON.stringify({ ...transferDocument, shopping: [], userRecipes: [] }),
  );
  await expect(page.locator("#status")).toContainText("stockage est plein");
  await page.locator("#reset-data").click();
  await expect(page.locator("#status")).toContainText(
    "stockage est indisponible",
  );
  expect(await stored(page)).toBe(before);
  await expect(page.locator("#recipe-title")).toHaveText(
    transferDocument.userRecipes[0]?.title ?? "",
  );
  await expect(page.locator("#recipe-name")).toHaveValue("Keep this draft");
  await expect(page.locator("#shopping-list input")).toBeChecked();
  await expect(page.locator("#locale")).toHaveValue("fr");
});

for (const raw of ["broken-json\n é", '{"schemaVersion":99,"keep":"é"}']) {
  test(`raw recovery download survives failed removal and confirmed reset: ${raw}`, async ({
    page,
  }) => {
    await seed(page, raw);
    await expect(page.locator("#export-data")).toHaveText(
      "Export raw recovery data",
    );
    const exported = await download(page);
    expect(exported.name).toBe("pinch-recovery.json");
    expect(exported.raw).toBe(raw);
    expect(await stored(page)).toBe(raw);
    await page.evaluate(() => {
      const original = Storage.prototype.removeItem;
      Object.defineProperty(window, "restoreRemoval", {
        value: () => {
          Storage.prototype.removeItem = original;
        },
      });
      Storage.prototype.removeItem = () => {
        throw Error("denied");
      };
    });
    page.on("dialog", async (dialog) => dialog.accept());
    await page.locator("#reset-data").click();
    await expect(page.locator("#status")).toContainText(
      "storage is unavailable",
    );
    await expect(page.locator("#storage-warning")).not.toBeEmpty();
    expect((await download(page)).raw).toBe(raw);
    await page.evaluate(() => {
      if (
        "restoreRemoval" in window &&
        typeof window.restoreRemoval === "function"
      )
        window.restoreRemoval();
    });
    await page.locator("#reset-data").click();
    await expect(page.locator("#status")).toContainText(
      "First-use defaults restored",
    );
    expect(await stored(page)).toBeNull();
    await expect(page.locator("#storage-warning")).toBeEmpty();
    await expect(page.locator("#library button")).toHaveCount(3);
    expect(await page.evaluate(() => localStorage.getItem("foreign-app"))).toBe(
      "keep",
    );
    await page.locator("#theme").selectOption("light");
    await expect(page.locator("#status")).toContainText("Preferences saved");
  });
}

test("confirmed reset restores first-use defaults, closes drafts and leaves foreign data untouched", async ({
  page,
}) => {
  await seed(page);
  await page.locator("#edit-recipe").click();
  await page.locator("#recipe-name").fill("Discard on confirmed reset");
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Effacer toutes");
    await dialog.accept();
  });
  await page.locator("#reset-data").click();
  await expect(page.locator("#status")).toContainText(
    "First-use defaults restored",
  );
  await expect(page.locator("#reset-data")).toBeFocused();
  await expect(page.locator("#editor")).toBeHidden();
  await expect(page.locator("#recipe-name")).toHaveValue("");
  await expect(page.locator("#library button")).toHaveCount(3);
  await expect(page.locator("#shopping-list li")).toHaveCount(0);
  await expect(page.locator("#locale")).toHaveValue("en");
  await expect(page.locator("#theme")).toHaveValue("system");
  await expect(page.locator("#units")).toHaveValue("metric");
  await expect(page.locator("#recipe-title")).toHaveText("Pancakes");
  expect(await stored(page)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("foreign-app"))).toBe(
    "keep",
  );
  await page.reload();
  await expect(page.locator("#library button")).toHaveCount(3);
});

test("French browser reset defaults and mobile transfer controls remain accessible", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    locale: "fr-CA",
    viewport: { width: 360, height: 740 },
  });
  try {
    const page = await context.newPage();
    await page.goto(baseURL ?? "");
    await page.locator("#theme").selectOption("dark");
    page.once("dialog", async (dialog) => dialog.accept());
    await page.locator("#reset-data").click();
    await expect(page.locator("#locale")).toHaveValue("fr");
    await expect(page.locator("#status")).toContainText(
      "Paramètres initiaux restaurés",
    );
    for (const id of ["export-data", "import-data", "reset-data"]) {
      const button = page.locator(`#${id}`);
      await expect(button).toHaveAccessibleName(/\S/);
      const bounds = await button.boundingBox();
      expect(bounds?.width).toBeGreaterThanOrEqual(44);
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});
