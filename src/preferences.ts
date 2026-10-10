import { parseLine, type Ingredient, type Unit } from "./domain/quantities";

export type Locale = "en" | "fr";
export type ThemePreference = "system" | "light" | "dark";
export type UnitSystem = "metric" | "imperial";

export interface Preferences {
  locale: Locale;
  theme: ThemePreference;
  units: UnitSystem;
}

export interface DocumentV1 {
  schemaVersion: 1;
  userRecipes: UserRecipe[];
  shopping: ShoppingItem[];
  preferences: Preferences;
}

export interface UserRecipe {
  id: string;
  title: string;
  baseServings: number;
  ingredients: Ingredient[];
  steps: string[];
}

export type ShoppingItem =
  | {
      kind: "parsed";
      id: string;
      name: string;
      unit: Unit | null;
      quantity: number;
      checked: boolean;
    }
  | { kind: "text"; id: string; raw: string; checked: boolean };

export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;

export const DOCUMENT_KEY = "pinch:v1:document";

export function createDefaultDocument(browserLocale: string): DocumentV1 {
  return {
    schemaVersion: 1,
    userRecipes: [],
    shopping: [],
    preferences: {
      locale: browserLocale.toLowerCase().startsWith("fr") ? "fr" : "en",
      theme: "system",
      units: "metric",
    },
  };
}

export function parseDocument(raw: string): DocumentV1 | null {
  if (new TextEncoder().encode(raw).length > MAX_DOCUMENT_BYTES) return null;
  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!record(value)) return null;
  const candidate = value;
  const preferences = candidate["preferences"];
  if (
    !exact(candidate, [
      "schemaVersion",
      "userRecipes",
      "shopping",
      "preferences",
    ]) ||
    candidate["schemaVersion"] !== 1 ||
    !Array.isArray(candidate["userRecipes"]) ||
    !Array.isArray(candidate["shopping"]) ||
    !record(preferences)
  ) {
    return null;
  }

  const saved = preferences;
  if (
    !exact(saved, ["locale", "theme", "units"]) ||
    (saved["locale"] !== "en" && saved["locale"] !== "fr") ||
    (saved["theme"] !== "system" &&
      saved["theme"] !== "light" &&
      saved["theme"] !== "dark") ||
    (saved["units"] !== "metric" && saved["units"] !== "imperial")
  ) {
    return null;
  }

  const recipes: UserRecipe[] = [];
  const shopping: ShoppingItem[] = [];
  if (
    candidate["userRecipes"].length > 100 ||
    candidate["shopping"].length > 1000
  )
    return null;
  for (const entry of candidate["userRecipes"]) {
    const recipe = validateRecipe(entry);
    if (!recipe || recipes.some((savedRecipe) => savedRecipe.id === recipe.id))
      return null;
    recipes.push(recipe);
  }
  for (const entry of candidate["shopping"]) {
    const item = validateShopping(entry);
    if (!item || shopping.some((savedItem) => savedItem.id === item.id))
      return null;
    shopping.push(item);
  }

  return {
    schemaVersion: 1,
    userRecipes: recipes,
    shopping,
    preferences: {
      locale: saved["locale"],
      theme: saved["theme"],
      units: saved["units"],
    },
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, keys: string[]): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function boundedText(value: unknown, max: number): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= max
  );
}

function validQuantity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1_000_000
  );
}

function validUnit(value: unknown): value is Unit | null {
  return (
    value === null ||
    (typeof value === "string" &&
      [
        "g",
        "kg",
        "oz",
        "lb",
        "ml",
        "l",
        "tsp",
        "tbsp",
        "cup",
        "fl-oz",
      ].includes(value))
  );
}

export function validateRecipe(value: unknown): UserRecipe | null {
  if (
    !record(value) ||
    !exact(value, ["id", "title", "baseServings", "ingredients", "steps"]) ||
    !boundedText(value["id"], 200) ||
    !value["id"].startsWith("user-") ||
    !boundedText(value["title"], 200) ||
    typeof value["baseServings"] !== "number" ||
    !Number.isInteger(value["baseServings"]) ||
    value["baseServings"] < 1 ||
    value["baseServings"] > 24 ||
    !Array.isArray(value["ingredients"]) ||
    value["ingredients"].length < 1 ||
    value["ingredients"].length > 200 ||
    !Array.isArray(value["steps"]) ||
    value["steps"].length < 1 ||
    value["steps"].length > 100
  )
    return null;
  const ingredients: Ingredient[] = [];
  for (const entry of value["ingredients"]) {
    if (!record(entry) || !boundedText(entry["raw"], 500)) return null;
    const parsed = parseLine(entry["raw"]);
    if (parsed.kind === "text") {
      if (!exact(entry, ["kind", "raw"]) || entry["kind"] !== "text")
        return null;
    } else if (
      !exact(entry, ["kind", "raw", "quantity", "unit", "name"]) ||
      entry["kind"] !== parsed.kind ||
      entry["quantity"] !== parsed.quantity ||
      entry["unit"] !== parsed.unit ||
      entry["name"] !== parsed.name
    )
      return null;
    ingredients.push(parsed);
  }
  const steps: string[] = [];
  for (const step of value["steps"]) {
    if (!boundedText(step, 2000)) return null;
    steps.push(step);
  }
  return {
    id: value["id"],
    title: value["title"],
    baseServings: value["baseServings"],
    ingredients,
    steps,
  };
}

function validateShopping(value: unknown): ShoppingItem | null {
  if (
    !record(value) ||
    !boundedText(value["id"], 200) ||
    !value["id"].startsWith("item-") ||
    typeof value["checked"] !== "boolean"
  )
    return null;
  if (
    value["kind"] === "text" &&
    exact(value, ["kind", "id", "raw", "checked"]) &&
    boundedText(value["raw"], 500)
  ) {
    return {
      kind: "text",
      id: value["id"],
      raw: value["raw"],
      checked: value["checked"],
    };
  }
  if (
    value["kind"] === "parsed" &&
    exact(value, ["kind", "id", "name", "unit", "quantity", "checked"]) &&
    boundedText(value["name"], 500) &&
    validUnit(value["unit"]) &&
    validQuantity(value["quantity"])
  ) {
    return {
      kind: "parsed",
      id: value["id"],
      name: value["name"],
      unit: value["unit"],
      quantity: value["quantity"],
      checked: value["checked"],
    };
  }
  return null;
}
