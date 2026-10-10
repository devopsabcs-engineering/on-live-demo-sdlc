import type { Ingredient } from "./quantities";
import type { ShoppingItem } from "../preferences";

export type ShoppingSnapshot =
  | {
      kind: "parsed";
      name: string;
      unit: Extract<Ingredient, { kind: "parsed" }>["unit"];
      quantity: number;
    }
  | { kind: "text"; raw: string };

export type ShoppingResult =
  | { ok: true; shopping: ShoppingItem[] }
  | { ok: false; error: "limit-exceeded" };

function normalize(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ").toLowerCase();
}

function identity(item: ShoppingSnapshot): string {
  return JSON.stringify(
    item.kind === "parsed"
      ? [item.kind, normalize(item.name), item.unit]
      : [item.kind, normalize(item.raw)],
  );
}

export function mergeShopping(
  current: readonly ShoppingItem[],
  snapshots: readonly ShoppingSnapshot[],
  createId: () => string = () => `item-${crypto.randomUUID()}`,
): ShoppingResult {
  const shopping = current.map((item) => ({ ...item }));
  const byIdentity = new Map(shopping.map((item) => [identity(item), item]));
  for (const snapshot of snapshots) {
    const value = snapshot.kind === "parsed" ? snapshot.name : snapshot.raw;
    if (!value.trim() || value.length > 500)
      return { ok: false, error: "limit-exceeded" };
    if (
      snapshot.kind === "parsed" &&
      (!Number.isFinite(snapshot.quantity) ||
        snapshot.quantity < 0 ||
        snapshot.quantity > 1_000_000)
    )
      return { ok: false, error: "limit-exceeded" };
    const key = identity(snapshot);
    const existing = byIdentity.get(key);
    if (existing) {
      if (existing.kind === "parsed" && snapshot.kind === "parsed") {
        const quantity = existing.quantity + snapshot.quantity;
        if (!Number.isFinite(quantity) || quantity > 1_000_000)
          return { ok: false, error: "limit-exceeded" };
        existing.quantity = quantity;
      }
      existing.checked = false;
    } else {
      if (shopping.length >= 1000)
        return { ok: false, error: "limit-exceeded" };
      const item: ShoppingItem = {
        ...snapshot,
        id: createId(),
        checked: false,
      };
      shopping.push(item);
      byIdentity.set(key, item);
    }
  }
  return { ok: true, shopping };
}
