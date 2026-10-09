import { describe, expect, it } from "vitest";
import {
  convertQuantity,
  formatQuantity,
  formatUnit,
  parseLine,
  scaleQuantity,
} from "../../src/domain/quantities";

describe("ingredient quantity parsing", () => {
  it.each([
    ["2 eggs", 2, null, "eggs"],
    ["0 g salt", 0, "g", "salt"],
    ["1.5 l milk", 1.5, "l", "milk"],
    ["1,5 l lait", 1.5, "l", "lait"],
    ["1/2 cup milk", 0.5, "cup", "milk"],
    ["1 1/2 cup milk", 1.5, "cup", "milk"],
    ["½ cup milk", 0.5, "cup", "milk"],
    ["1 c. à café sucre", 1, "tsp", "sucre"],
    ["2 fl oz cream", 2, "fl-oz", "cream"],
    ["3 scoops flour", 3, null, "scoops flour"],
  ] as const)("parses %s", (raw, quantity, unit, name) => {
    expect(parseLine(raw)).toEqual({ kind: "parsed", raw, quantity, unit, name });
  });

  it.each([
    "salt to taste",
    "1/0 cup milk",
    "1-2 cups flour",
    "1 - 2 cups flour",
    "1 – 2 cups flour",
    "1, cups flour",
    "1. cups flour",
    "-1 cup flour",
    "1e3 g flour",
    "1 cup",
    "1000001 g flour",
    "999999999999999999999999 g flour",
  ])("preserves unsupported or malformed line %s", (raw) => {
    expect(parseLine(raw)).toEqual({ kind: "text", raw });
  });

  it("keeps punctuation adjacent to a quantity out of unit matching", () => {
    expect(parseLine("2, cup milk")).toEqual({
      kind: "text",
      raw: "2, cup milk",
    });
  });
});

describe("servings scaling", () => {
  it("calculates from the source quantity without mutating it", () => {
    const source = parseLine("250 g flour");
    expect(source).toEqual({
      kind: "parsed",
      raw: "250 g flour",
      quantity: 250,
      unit: "g",
      name: "flour",
    });
    if (source.kind !== "parsed") throw new Error("Expected parsed ingredient");

    expect(scaleQuantity(source.quantity, 4, 8)).toEqual({ ok: true, quantity: 500 });
    expect(scaleQuantity(source.quantity, 4, 1)).toEqual({ ok: true, quantity: 62.5 });
    expect(source.quantity).toBe(250);
  });

  it("scales counts and reports invalid quantities or servings", () => {
    expect(scaleQuantity(2, 4, 8)).toEqual({ ok: true, quantity: 4 });
    expect(scaleQuantity(-1, 4, 8)).toEqual({ ok: false, error: "invalid-quantity" });
    expect(scaleQuantity(1_000_001, 4, 8)).toEqual({ ok: false, error: "invalid-quantity" });
    expect(scaleQuantity(1, 0, 8)).toEqual({ ok: false, error: "invalid-servings" });
    expect(scaleQuantity(1, 4, 1.5)).toEqual({ ok: false, error: "invalid-servings" });
  });
});

describe("dimensional conversion", () => {
  it.each([
    [1, "kg", 1_000],
    [1, "oz", 28.349523125],
    [1, "lb", 453.59237],
    [1, "l", 1_000],
    [1, "ml", 1],
    [1, "tsp", 4.92892159375],
    [1, "tbsp", 14.78676478125],
    [1, "cup", 236.5882365],
    [1, "fl-oz", 29.5735295625],
  ] as const)(
    "converts %s %s using the exact documented metric factor",
    (quantity, unit, metric) => {
      const converted = convertQuantity(quantity, unit, "metric");
      expect(converted.quantity).toBeCloseTo(metric, 10);
      expect(converted.unit).toBe(unit === "oz" || unit === "lb" ? "g" : "ml");
    },
  );

  it("keeps mass and volume separate and leaves counts unchanged", () => {
    expect(convertQuantity(1, "cup", "metric").unit).toBe("ml");
    expect(convertQuantity(1, "oz", "metric").unit).toBe("g");
    expect(convertQuantity(2, null, "imperial")).toEqual({ quantity: 2, unit: null });
  });

  it("round-trips from the same source without accumulating display drift", () => {
    const sourceQuantity = 3.141592653589793;
    const metric = convertQuantity(sourceQuantity, "cup", "metric");
    const imperial = convertQuantity(sourceQuantity, "cup", "imperial");

    expect(metric).toEqual({ quantity: sourceQuantity * 236.5882365, unit: "ml" });
    expect(imperial.quantity).toBeCloseTo(sourceQuantity, 14);
    expect(convertQuantity(sourceQuantity, "cup", "imperial").quantity).toBe(
      imperial.quantity,
    );
  });
});

describe("quantity and unit formatting", () => {
  it("localizes decimal separators and French unit labels", () => {
    expect(formatQuantity(1.25, "cup", "en")).toBe("1 1/4");
    expect(formatQuantity(1.2, "cup", "fr")).toBe("1,2");
    expect(formatUnit("cup", "fr")).toBe("tasse");
    expect(formatUnit("fl-oz", "en")).toBe("fl oz");
    expect(formatUnit("fl-oz", "fr")).toBe("oz liq.");
  });

  it("uses bounded precision without displaying positive quantities as zero", () => {
    expect(formatQuantity(0, "g", "fr")).toBe("0");
    expect(formatQuantity(0.4, "g", "en")).toBe("< 1");
    expect(formatQuantity(0.004, "cup", "en")).toBe("< 0.01");
    expect(formatQuantity(0.004, "cup", "fr")).toBe("< 0,01");
    expect(formatQuantity(0.125, "cup", "en")).toBe("1/8");
    expect(formatQuantity(2.5, "cup", "en")).toBe("2 1/2");
  });
});