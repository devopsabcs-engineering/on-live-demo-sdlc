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
  userRecipes: unknown[];
  shopping: unknown[];
  preferences: Preferences;
}

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
  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof value !== "object" || value === null) return null;

  const candidate = value as Record<string, unknown>;
  const preferences = candidate["preferences"];
  if (
    candidate["schemaVersion"] !== 1 ||
    !Array.isArray(candidate["userRecipes"]) ||
    !Array.isArray(candidate["shopping"]) ||
    typeof preferences !== "object" ||
    preferences === null
  ) {
    return null;
  }

  const saved = preferences as Record<string, unknown>;
  if (
    (saved["locale"] !== "en" && saved["locale"] !== "fr") ||
    (saved["theme"] !== "system" &&
      saved["theme"] !== "light" &&
      saved["theme"] !== "dark") ||
    (saved["units"] !== "metric" && saved["units"] !== "imperial")
  ) {
    return null;
  }

  return {
    schemaVersion: 1,
    userRecipes: candidate["userRecipes"],
    shopping: candidate["shopping"],
    preferences: {
      locale: saved["locale"],
      theme: saved["theme"],
      units: saved["units"],
    },
  };
}
