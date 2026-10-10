import { describe, expect, it } from "vitest";
import { getSample, sampleIds } from "../../src/data/samples";
import { validateDraft } from "../../src/domain/recipes";

describe("immutable bilingual samples", () => {
  it("has exactly the three stable samples with equal numeric ingredients and step counts", () => {
    expect(sampleIds).toEqual([
      "sample-pancakes",
      "sample-soup",
      "sample-salad",
    ]);
    for (const id of sampleIds) {
      const en = getSample(id, "en")!;
      const fr = getSample(id, "fr")!;
      expect(en.steps.length).toBe(fr.steps.length);
      expect(en.baseServings).toBe(fr.baseServings);
      expect(
        en.ingredients.map((entry) =>
          entry.kind === "parsed" ? [entry.quantity, entry.unit] : null,
        ),
      ).toEqual(
        fr.ingredients.map((entry) =>
          entry.kind === "parsed" ? [entry.quantity, entry.unit] : null,
        ),
      );
      expect(en.title).not.toBe(fr.title);
    }
  });
  it("returns editable snapshots without exposing bundled assets to mutation", () => {
    const first = getSample("sample-pancakes", "en")!;
    first.title = "Changed";
    first.steps[0] = "Changed";
    first.ingredients[0] = { kind: "text", raw: "Changed" };
    expect(getSample("sample-pancakes", "en")!.title).toBe("Pancakes");
    expect(getSample("sample-pancakes", "en")!.ingredients[0]).toMatchObject({
      quantity: 250,
    });
    for (const locale of ["en", "fr"] as const) {
      for (const id of sampleIds) {
        const sample = getSample(id, locale)!;
        expect(
          validateDraft(
            {
              title: sample.title,
              baseServings: String(sample.baseServings),
              ingredients: sample.ingredients
                .map((entry) => entry.raw)
                .join("\n"),
              steps: sample.steps.join("\n"),
            },
            "user-copy",
          ).ok,
        ).toBe(true);
      }
    }
    expect(getSample("missing", "en")).toBeUndefined();
  });
});
