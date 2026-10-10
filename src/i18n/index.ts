import en from "./en.json";
import fr from "./fr.json";
import type { Locale } from "../preferences";

export type CatalogKey = keyof typeof en;
type Catalog = Record<CatalogKey, string>;

const catalogs: Record<Locale, Catalog> = { en, fr };

export function isCatalogKey(key: string): key is CatalogKey {
  return Object.hasOwn(en, key);
}

export function translate(locale: Locale, key: CatalogKey): string {
  return catalogs[locale][key];
}
