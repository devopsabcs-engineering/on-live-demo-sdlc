import { describe, expect, it } from "vitest";
import { validateDraft } from "../../src/domain/recipes";

const draft = {
  title: "  Dinner  ",
  baseServings: "4",
  ingredients: "250 g flour\nsalt to taste",
  steps: "1. Mix\n2) Bake\n3.Brown",
};

describe("recipe editor validation", () => {
  it("parses once and removes only initial numbered step prefixes", () => {
    const result = validateDraft(draft, "user-test");
    expect(result).toMatchObject({
      ok: true,
      recipe: {
        title: "Dinner",
        steps: ["Mix", "Bake", "3.Brown"],
        ingredients: [
          { kind: "parsed", quantity: 250 },
          { kind: "text", raw: "salt to taste" },
        ],
      },
    });
  });
  it("reports all invalid fields without truncating input", () => {
    expect(
      validateDraft(
        { title: " ", baseServings: "1.5", ingredients: " ", steps: "1. " },
        "user-test",
      ),
    ).toMatchObject({
      ok: false,
      errors: {
        title: "title-error",
        baseServings: "servings-error",
        ingredients: "ingredients-error",
        steps: "steps-error",
      },
    });
    for (const baseServings of ["0", "25", "", "NaN"])
      expect(validateDraft({ ...draft, baseServings }, "user-test").ok).toBe(
        false,
      );
    for (const invalid of [
      { title: "a".repeat(201) },
      { ingredients: "a".repeat(501) },
      { ingredients: Array(201).fill("salt").join("\n") },
      { steps: "a".repeat(2001) },
      { steps: Array(101).fill("Mix").join("\n") },
    ])
      expect(validateDraft({ ...draft, ...invalid }, "user-test").ok).toBe(
        false,
      );
  });
});
