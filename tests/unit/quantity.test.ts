import { describe, expect, it } from "vitest";
import {
  convertQuantity,
  formatQuantity,
  formatUnit,
  parseLine,
  scaleQuantity,
} from "../../src/domain/quantities";

describe("quantity parsing", () => {
  it.each([
    ["2 eggs", 2, null, "eggs"],
    ["1.5 l milk", 1.5, "l", "milk"],
    ["1,5 l lait", 1.5, "l", "lait"],
    ["1/2 cup milk", 0.5, "cup", "milk"],
    ["1 1/2 cup milk", 1.5, "cup", "milk"],
    ["½ cup cream", 0.5, "cup", "cream"],
    ["2 c. à soupe sucre", 2, "tbsp", "sucre"],
    ["1 fl oz cream", 1, "fl-oz", "cream"],
  ])("parses %s", (raw, quantity, unit, name) => {
    expect(parseLine(raw)).toMatchObject({
      kind: "parsed",
      raw,
      quantity,
      unit,
      name,
    });
  });

  it.each([
    "salt to taste",
    "1/0 cup milk",
    "-2 g flour",
    "1-2 cups flour",
    "1e3 g flour",
    "1000001 g flour",
  ])("preserves unsupported input %s as text", (raw) => {
    expect(parseLine(raw)).toEqual({ kind: "text", raw });
  });

  it("keeps unknown suffixes verbatim and scalable without assigning a unit", () => {
    expect(parseLine("3 scoops flour")).toEqual({
      kind: "parsed",
      raw: "3 scoops flour",
      quantity: 3,
      unit: null,
      name: "scoops flour",
    });
  });
});

describe("scaling and conversion", () => {
  it("scales from source quantities without changing the input", () => {
    const source = 250;
    expect(scaleQuantity(source, 4, 8)).toEqual({ ok: true, quantity: 500 });
    expect(scaleQuantity(source, 4, 1)).toEqual({ ok: true, quantity: 62.5 });
    expect(source).toBe(250);
    expect(scaleQuantity(2, 4, 1)).toEqual({ ok: true, quantity: 0.5 });
  });

  it.each([
    [0, 4],
    [25, 4],
    [1.5, 4],
    [4, 0],
  ])("rejects invalid serving values %j", (base, target) => {
    expect(scaleQuantity(1, base, target)).toEqual({
      ok: false,
      error: "invalid-servings",
    });
  });

  it("rejects invalid quantities", () => {
    expect(scaleQuantity(Number.NaN, 4, 8)).toEqual({
      ok: false,
      error: "invalid-quantity",
    });
    expect(scaleQuantity(-1, 4, 8)).toEqual({
      ok: false,
      error: "invalid-quantity",
    });
  });

  it("converts only within mass or volume using exact US factors", () => {
    expect(convertQuantity(1, "oz", "metric")).toEqual({
      quantity: 28.349523125,
      unit: "g",
    });
    expect(convertQuantity(1, "cup", "metric")).toEqual({
      quantity: 236.5882365,
      unit: "ml",
    });
    expect(convertQuantity(1, "tsp", "metric")).toEqual({
      quantity: 4.92892159375,
      unit: "ml",
    });
    expect(convertQuantity(1, "tbsp", "metric")).toEqual({
      quantity: 14.78676478125,
      unit: "ml",
    });
    expect(convertQuantity(1, "fl-oz", "metric")).toEqual({
      quantity: 29.5735295625,
      unit: "ml",
    });
    expect(convertQuantity(1, "lb", "metric")).toEqual({
      quantity: 453.59237,
      unit: "g",
    });
    expect(convertQuantity(1, null, "imperial")).toEqual({
      quantity: 1,
      unit: null,
    });
  });

  it("round-trips within tolerance without mutating source values", () => {
    const source = 300;
    const imperial = convertQuantity(source, "ml", "imperial");
    expect(convertQuantity(source, "ml", "metric")).toEqual({
      quantity: 300,
      unit: "ml",
    });
    expect(
      convertQuantity(imperial.quantity, imperial.unit, "metric").quantity,
    ).toBeCloseTo(source, 10);
    expect(source).toBe(300);
  });
});

describe("quantity formatting", () => {
  it("rounds metric units half up without displaying a positive sub-unit as zero", () => {
    expect(formatQuantity(0, "g", "en")).toBe("0");
    expect(formatQuantity(0.4, "g", "en")).toBe("< 1");
    expect(formatQuantity(1.5, "ml", "en")).toBe("2");
    expect(formatQuantity(250.4, "g", "en")).toBe("250");
    expect(formatQuantity(0.4, "g", "fr")).toBe("< 1");
  });

  it("uses simple fractions within tolerance and localizes decimal fallbacks", () => {
    expect(formatQuantity(1.5, "cup", "en")).toBe("1 1/2");
    expect(formatQuantity(0.5, null, "en")).toBe("1/2");
    expect(formatQuantity(1.234, "cup", "en")).toBe("1.23");
    expect(formatQuantity(1.234, "cup", "fr")).toBe("1,23");
    expect(formatQuantity(0.001, "cup", "fr")).toBe("< 0,01");
    expect(formatUnit("fl-oz", "en")).toBe("fl oz");
    expect(formatUnit("tbsp", "fr")).toBe("c. à soupe");
  });
});
