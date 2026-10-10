import { describe, expect, it } from "vitest";
import {
  createDefaultDocument,
  MAX_DOCUMENT_BYTES,
  parseDocument,
} from "../../src/preferences";
import { parseLine } from "../../src/domain/quantities";

describe("shell preferences", () => {
  it("uses French only when the browser locale begins with fr", () => {
    expect(createDefaultDocument("fr-CA").preferences.locale).toBe("fr");
    expect(createDefaultDocument("en-GB").preferences.locale).toBe("en");
    expect(createDefaultDocument("FR").preferences.locale).toBe("fr");
  });

  it("starts with system theme and metric units", () => {
    expect(createDefaultDocument("en-US").preferences).toEqual({
      locale: "en",
      theme: "system",
      units: "metric",
    });
  });

  it("reads valid preferences without discarding stored collections", () => {
    const existing = {
      schemaVersion: 1,
      userRecipes: [
        {
          id: "user-kept",
          title: "Soup",
          baseServings: 4,
          ingredients: [{ kind: "text", raw: "salt" }],
          steps: ["Stir"],
        },
      ],
      shopping: [
        { kind: "text", id: "item-kept", raw: "salt", checked: false },
      ],
      preferences: { locale: "fr", theme: "dark", units: "imperial" },
    };

    expect(parseDocument(JSON.stringify(existing))).toEqual(existing);
  });

  it("rejects malformed, unsupported, or invalid preference documents", () => {
    expect(parseDocument("not json")).toBeNull();
    expect(parseDocument(JSON.stringify({ schemaVersion: 2 }))).toBeNull();
    expect(
      parseDocument(
        JSON.stringify({
          schemaVersion: 1,
          userRecipes: [],
          shopping: [],
          preferences: { locale: "de", theme: "system", units: "metric" },
        }),
      ),
    ).toBeNull();
  });
});

describe("exact full-document schema", () => {
  const recipe = {
    id: "user-valid",
    title: "Dinner",
    baseServings: 4,
    ingredients: [parseLine("250 g flour"), parseLine("salt to taste")],
    steps: ["Mix"],
  };
  const item = {
    kind: "parsed",
    id: "item-valid",
    name: "flour",
    unit: "g",
    quantity: 250,
    checked: true,
  };
  const valid = {
    ...createDefaultDocument("en"),
    userRecipes: [recipe],
    shopping: [item],
  };
  const parse = (value: unknown) => parseDocument(JSON.stringify(value));

  it("round-trips complete recipe, shopping and preference data", () => {
    expect(parse(valid)).toEqual(valid);
  });
  it("rejects extra properties at every boundary", () => {
    for (const value of [
      { ...valid, extra: true },
      { ...valid, preferences: { ...valid.preferences, extra: true } },
      { ...valid, userRecipes: [{ ...recipe, extra: true }] },
      {
        ...valid,
        userRecipes: [
          {
            ...recipe,
            ingredients: [{ ...parseLine("250 g flour"), extra: true }],
          },
        ],
      },
      { ...valid, shopping: [{ ...item, extra: true }] },
    ])
      expect(parse(value)).toBeNull();
  });
  it("rejects inconsistent raw, kind, quantity, unit and name", () => {
    const ingredient = parseLine("250 g flour");
    for (const change of [
      { quantity: 500 },
      { unit: "kg" },
      { name: "milk" },
      { raw: "salt" },
      { kind: "text" },
      { quantity: Infinity },
    ])
      expect(
        parse({
          ...valid,
          userRecipes: [
            { ...recipe, ingredients: [{ ...ingredient, ...change }] },
          ],
        }),
      ).toBeNull();
    expect(
      parse({
        ...valid,
        userRecipes: [
          { ...recipe, ingredients: [{ kind: "text", raw: "250 g flour" }] },
        ],
      }),
    ).toBeNull();
  });
  it("rejects duplicate/reserved IDs, invalid fields, collection and byte limits", () => {
    for (const userRecipes of [
      [recipe, recipe],
      [{ ...recipe, id: "sample-pancakes" }],
      [{ ...recipe, baseServings: 1.5 }],
      [{ ...recipe, title: " " }],
      [{ ...recipe, title: "a".repeat(201) }],
      [{ ...recipe, ingredients: [] }],
      [{ ...recipe, steps: [" "] }],
      Array.from({ length: 101 }, (_, index) => ({
        ...recipe,
        id: `user-${index}`,
      })),
    ])
      expect(parse({ ...valid, userRecipes })).toBeNull();
    for (const shopping of [
      [item, item],
      [{ ...item, quantity: -1 }],
      [{ ...item, quantity: 1_000_001 }],
      [{ ...item, quantity: Infinity }],
      [{ ...item, checked: 1 }],
      [{ ...item, unit: ["g"] }],
      [{ ...item, name: "a".repeat(501) }],
      [{ kind: "text", id: "item-text", checked: false, raw: "a".repeat(501) }],
      Array.from({ length: 1001 }, (_, index) => ({
        ...item,
        id: `item-${index}`,
      })),
    ])
      expect(parse({ ...valid, shopping })).toBeNull();
    expect(parseDocument(" ".repeat(MAX_DOCUMENT_BYTES + 1))).toBeNull();
  });
});
