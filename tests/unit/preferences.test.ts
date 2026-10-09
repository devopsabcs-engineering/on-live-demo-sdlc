import { describe, expect, it } from "vitest";
import { createDefaultDocument, parseDocument } from "../../src/preferences";

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
      userRecipes: [{ id: "user-kept" }],
      shopping: [{ id: "item-kept" }],
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
