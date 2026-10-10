import type { Locale, UnitSystem } from "../preferences";

export type Unit =
  "g" | "kg" | "oz" | "lb" | "ml" | "l" | "tsp" | "tbsp" | "cup" | "fl-oz";

export type Ingredient =
  | {
      kind: "parsed";
      raw: string;
      quantity: number;
      unit: Unit | null;
      name: string;
    }
  | { kind: "text"; raw: string };

export type ScaleError = "invalid-quantity" | "invalid-servings";

export type ScaleResult =
  { ok: true; quantity: number } | { ok: false; error: ScaleError };

export interface ConvertedQuantity {
  quantity: number;
  unit: Unit | null;
}

const quantityPattern =
  /^(\d+\s+\d+\/\d+|\d+\s+[¼½¾]|\d+\/\d+|\d+(?:[.,]\d+)?|[.,]\d+|[¼½¾])(?=\s)/u;

const unitAliases: ReadonlyArray<readonly [Unit, readonly string[]]> = [
  ["fl-oz", ["fluid ounces", "fluid ounce", "fl oz"]],
  ["tbsp", ["tablespoons", "tablespoon", "tbsp", "c. à soupe", "c. a soupe"]],
  ["tsp", ["teaspoons", "teaspoon", "tsp", "c. à café", "c. a cafe"]],
  ["kg", ["kilogrammes", "kilogramme", "kilograms", "kilogram", "kg"]],
  ["ml", ["milliliters", "milliliter", "millilitres", "millilitre", "ml"]],
  ["cup", ["cups", "cup", "tasses", "tasse"]],
  ["lb", ["pounds", "pound", "lbs", "livres", "livre", "lb"]],
  ["oz", ["ounces", "ounce", "onces", "once", "oz"]],
  ["g", ["grammes", "gramme", "grams", "gram", "g"]],
  ["l", ["liters", "liter", "litres", "litre", "l"]],
];

const aliasesByLength = unitAliases
  .flatMap(([unit, aliases]) => aliases.map((alias) => ({ unit, alias })))
  .sort((left, right) => right.alias.length - left.alias.length);

const unitPattern = new RegExp(
  `^(${aliasesByLength.map(({ alias }) => escapeRegExp(alias)).join("|")})\\s+(.+)$`,
  "iu",
);

const gramFactors: Partial<Record<Unit, number>> = {
  g: 1,
  kg: 1_000,
  oz: 28.349523125,
  lb: 453.59237,
};

const milliliterFactors: Partial<Record<Unit, number>> = {
  ml: 1,
  l: 1_000,
  tsp: 4.92892159375,
  tbsp: 14.78676478125,
  cup: 236.5882365,
  "fl-oz": 29.5735295625,
};

export function parseLine(raw: string): Ingredient {
  const line = raw.trim();
  const match = quantityPattern.exec(line);
  if (!match) return { kind: "text", raw };

  const suffix = line.slice(match[0].length).trim();
  if (!suffix || /^[-–—]\s*\d/u.test(suffix)) return { kind: "text", raw };

  const quantity = parseQuantity(match[0]);
  if (quantity === null || !Number.isFinite(quantity) || quantity > 1_000_000) {
    return { kind: "text", raw };
  }

  const unitMatch = unitPattern.exec(suffix);
  if (unitMatch?.[1] !== undefined && unitMatch[2] !== undefined) {
    const alias = unitMatch[1].toLocaleLowerCase("en-US");
    const knownUnit = aliasesByLength.find(
      ({ alias: candidate }) => candidate.toLocaleLowerCase("en-US") === alias,
    )?.unit;
    if (knownUnit) {
      return {
        kind: "parsed",
        raw,
        quantity,
        unit: knownUnit,
        name: unitMatch[2].trim(),
      };
    }
  }

  return { kind: "parsed", raw, quantity, unit: null, name: suffix };
}

export function scaleQuantity(
  quantity: number,
  baseServings: number,
  targetServings: number,
): ScaleResult {
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > 1_000_000) {
    return { ok: false, error: "invalid-quantity" };
  }

  if (!isValidServings(baseServings) || !isValidServings(targetServings)) {
    return { ok: false, error: "invalid-servings" };
  }

  const scaled = (quantity * targetServings) / baseServings;
  if (!Number.isFinite(scaled)) return { ok: false, error: "invalid-quantity" };
  return { ok: true, quantity: scaled };
}

export function convertQuantity(
  quantity: number,
  unit: Unit | null,
  system: UnitSystem,
): ConvertedQuantity {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new RangeError("Quantity must be a finite, nonnegative number.");
  }
  if (system !== "metric" && system !== "imperial") {
    throw new RangeError("Unit system must be metric or imperial.");
  }
  if (unit === null) return { quantity, unit: null };

  const gramsPerUnit = gramFactors[unit];
  if (gramsPerUnit !== undefined) {
    const grams = quantity * gramsPerUnit;
    return system === "metric"
      ? { quantity: grams, unit: "g" }
      : { quantity: grams / gramFactors.oz!, unit: "oz" };
  }

  const millilitersPerUnit = milliliterFactors[unit];
  if (millilitersPerUnit !== undefined) {
    const milliliters = quantity * millilitersPerUnit;
    return system === "metric"
      ? { quantity: milliliters, unit: "ml" }
      : { quantity: milliliters / milliliterFactors.cup!, unit: "cup" };
  }

  return { quantity, unit };
}

export function formatQuantity(
  quantity: number,
  unit: Unit | null,
  locale: Locale,
): string {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new RangeError("Quantity must be a finite, nonnegative number.");
  }

  const numberLocale = locale === "fr" ? "fr-FR" : "en-US";
  if (quantity === 0) return new Intl.NumberFormat(numberLocale).format(0);

  if (unit === "g" || unit === "ml") {
    if (quantity < 1)
      return `< ${new Intl.NumberFormat(numberLocale).format(1)}`;
    return new Intl.NumberFormat(numberLocale, {
      maximumFractionDigits: 0,
    }).format(Math.floor(quantity + 0.5));
  }

  if (quantity < 0.01) {
    const threshold = new Intl.NumberFormat(numberLocale, {
      maximumFractionDigits: 2,
    }).format(0.01);
    return `< ${threshold}`;
  }

  const fraction = nearestFraction(quantity);
  if (fraction && fraction.error / quantity <= 0.02) {
    if (fraction.numerator === 0) {
      return new Intl.NumberFormat(numberLocale).format(fraction.whole);
    }
    const fractionText = `${fraction.numerator}/${fraction.denominator}`;
    return fraction.whole === 0
      ? fractionText
      : `${new Intl.NumberFormat(numberLocale).format(fraction.whole)} ${fractionText}`;
  }

  return new Intl.NumberFormat(numberLocale, {
    maximumFractionDigits: 2,
  }).format(quantity);
}

export function formatUnit(unit: Unit | null, locale: Locale): string {
  if (unit === null || locale === "en") {
    if (unit === "fl-oz") return "fl oz";
    return unit ?? "";
  }

  const frenchUnits: Record<Unit, string> = {
    g: "g",
    kg: "kg",
    oz: "oz",
    lb: "lb",
    ml: "ml",
    l: "l",
    tsp: "c. à café",
    tbsp: "c. à soupe",
    cup: "tasse",
    "fl-oz": "oz liq.",
  };
  return frenchUnits[unit];
}

function parseQuantity(value: string): number | null {
  const trimmed = value.trim();
  const unicodeMixed = /^(\d+)\s+([¼½¾])$/u.exec(trimmed);
  if (unicodeMixed) {
    const whole = unicodeMixed[1];
    const fraction = unicodeMixed[2];
    if (whole === undefined || fraction === undefined) return null;
    return Number(whole) + unicodeFraction(fraction);
  }

  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/u.exec(trimmed);
  if (mixed) {
    const whole = mixed[1];
    const numerator = mixed[2];
    const denominatorText = mixed[3];
    if (
      whole === undefined ||
      numerator === undefined ||
      denominatorText === undefined
    ) {
      return null;
    }
    const denominator = Number(denominatorText);
    if (denominator === 0) return null;
    return Number(whole) + Number(numerator) / denominator;
  }

  const fraction = /^(\d+)\/(\d+)$/u.exec(trimmed);
  if (fraction) {
    const numerator = fraction[1];
    const denominatorText = fraction[2];
    if (numerator === undefined || denominatorText === undefined) return null;
    const denominator = Number(denominatorText);
    if (denominator === 0) return null;
    return Number(numerator) / denominator;
  }

  if (/^[¼½¾]$/u.test(trimmed)) return unicodeFraction(trimmed);
  const decimal = Number(trimmed.replace(",", "."));
  return Number.isFinite(decimal) ? decimal : null;
}

function unicodeFraction(value: string): number {
  if (value === "¼") return 0.25;
  if (value === "½") return 0.5;
  return 0.75;
}

function nearestFraction(
  quantity: number,
):
  | { whole: number; numerator: number; denominator: number; error: number }
  | undefined {
  const whole = Math.floor(quantity);
  let best: ReturnType<typeof nearestFraction>;

  for (const denominator of [2, 3, 4, 8]) {
    const roundedNumerator = Math.round((quantity - whole) * denominator);
    const candidateWhole = roundedNumerator === denominator ? whole + 1 : whole;
    let numerator = roundedNumerator === denominator ? 0 : roundedNumerator;
    let reducedDenominator = denominator;
    if (numerator !== 0) {
      const divisor = greatestCommonDivisor(numerator, denominator);
      numerator /= divisor;
      reducedDenominator /= divisor;
    }

    const candidate = candidateWhole + numerator / reducedDenominator;
    const error = Math.abs(candidate - quantity);
    if (
      !best ||
      error < best.error - Number.EPSILON ||
      (Math.abs(error - best.error) < Number.EPSILON &&
        denominator < best.denominator)
    ) {
      best = {
        whole: candidateWhole,
        numerator,
        denominator: reducedDenominator,
        error,
      };
    }
  }

  return best;
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = left;
  let b = right;
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function isValidServings(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 24;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
