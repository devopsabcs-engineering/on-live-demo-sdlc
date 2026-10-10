import { describe, expect, it } from "vitest";
import { RecipeRepository } from "../../src/data/repository";
import { DOCUMENT_KEY } from "../../src/preferences";
import type { ShoppingItem } from "../../src/preferences";
import { mergeShopping } from "../../src/domain/shopping";
import {
  convertQuantity,
  parseLine,
  scaleQuantity,
} from "../../src/domain/quantities";

function fixture(raw: string | null = null) {
  let stored = raw;
  let fail = false;
  const storage = {
    getItem: () => stored,
    setItem: (_key: string, value: string) => {
      if (fail) throw new DOMException("Full", "QuotaExceededError");
      stored = value;
    },
  };
  const repository = new RecipeRepository("en", () => storage);
  return {
    repository,
    storage,
    raw: () => stored,
    fail: () => {
      fail = true;
    },
    replace: (value: string) => {
      stored = value;
    },
  };
}

describe("transactional document storage", () => {
  it("persists once, reloads preferences, and does not seed samples into storage", () => {
    const context = fixture();
    const next = {
      ...context.repository.document,
      preferences: {
        ...context.repository.document.preferences,
        locale: "fr" as const,
      },
    };
    expect(context.repository.save(next)).toMatchObject({
      ok: true,
      saved: true,
    });
    expect(new RecipeRepository("en", () => context.storage).document).toEqual(
      next,
    );
    expect(context.raw()).not.toContain("sample-");
  });
  it("retains old state and bytes after a quota error, then permits retry", () => {
    const context = fixture();
    const old = context.repository.document;
    context.fail();
    expect(
      context.repository.save({
        ...old,
        preferences: { ...old.preferences, theme: "dark" },
      }),
    ).toEqual({ ok: false, error: "storage-full" });
    expect(context.repository.document).toBe(old);
    expect(context.raw()).toBeNull();
  });
  it("preserves corrupt and unsupported bytes and blocks writes", () => {
    for (const raw of ["broken", '{"schemaVersion":2}']) {
      const context = fixture(raw);
      expect(context.repository.save(context.repository.document).ok).toBe(
        false,
      );
      expect(context.raw()).toBe(raw);
      expect(context.repository.startTemporarySession()).toBe(false);
    }
  });
  it("requires explicit temporary consent when reading storage is denied", () => {
    const repository = new RecipeRepository("fr", () => {
      throw new DOMException("Denied", "SecurityError");
    });
    expect(repository.save(repository.document)).toEqual({
      ok: false,
      error: "storage-unavailable",
    });
    expect(repository.startTemporarySession()).toBe(true);
    expect(repository.save(repository.document)).toMatchObject({
      ok: true,
      saved: false,
    });
  });
  it("blocks changed bytes immediately before saving and after a storage event", () => {
    const context = fixture();
    context.replace("other tab");
    expect(context.repository.save(context.repository.document)).toEqual({
      ok: false,
      error: "storage-conflict",
    });
    expect(context.raw()).toBe("other tab");
    const other = fixture();
    other.repository.storageChanged();
    expect(other.repository.save(other.repository.document).ok).toBe(false);
    expect(DOCUMENT_KEY).toBe("pinch:v1:document");
  });
});

describe("durable shopping snapshots", () => {
  const flour: ShoppingItem = {
    kind: "parsed",
    id: "item-first",
    name: " Flour ",
    unit: "g",
    quantity: 500,
    checked: true,
  };

  it("merges canonical aliases and normalized names, preserving first spelling and ID", () => {
    const first = parseLine("1 gram CAFÉ  flour");
    const second = parseLine("2 grammes cafe\u0301\tflour");
    if (first.kind !== "parsed" || second.kind !== "parsed")
      throw new Error("Expected parsed aliases");
    const current: ShoppingItem[] = [
      {
        kind: "parsed",
        name: first.name,
        unit: first.unit,
        quantity: first.quantity,
        id: "item-accent",
        checked: true,
      },
    ];
    const before = structuredClone(current);
    const result = mergeShopping(current, [second]);
    expect(result).toMatchObject({
      ok: true,
      shopping: [
        {
          id: "item-accent",
          name: "CAFÉ  flour",
          unit: "g",
          quantity: 3,
          checked: false,
        },
      ],
    });
    expect(current).toEqual(before);
  });

  it("keeps unlike units, language names, accents, singulars and parsed/text kinds distinct", () => {
    const result = mergeShopping(
      [],
      [
        { kind: "parsed", name: "milk", unit: "g", quantity: 1 },
        { kind: "parsed", name: "milk", unit: "oz", quantity: 1 },
        { kind: "parsed", name: "milk", unit: null, quantity: 1 },
        { kind: "parsed", name: "lait", unit: "g", quantity: 1 },
        { kind: "parsed", name: "milks", unit: "g", quantity: 1 },
        { kind: "parsed", name: "mílk", unit: "g", quantity: 1 },
        { kind: "text", raw: "milk" },
      ],
    );
    expect(result.ok && result.shopping).toHaveLength(7);
  });

  it("deduplicates normalized plain text and reopens it without changing spelling", () => {
    const current: ShoppingItem[] = [
      { kind: "text", id: "item-salt", raw: " Salt  to taste ", checked: true },
    ];
    const result = mergeShopping(current, [
      { kind: "text", raw: "salt\tto TASTE" },
      { kind: "text", raw: "salt to taste" },
    ]);
    expect(result).toEqual({
      ok: true,
      shopping: [{ ...current[0], checked: false }],
    });
    expect(current[0]?.checked).toBe(true);
  });

  it("adds full-precision converted snapshots without rounding or source mutation", () => {
    const source = parseLine("1/3 g flour");
    if (source.kind !== "parsed") throw new Error("Expected parsed ingredient");
    const scaled = scaleQuantity(source.quantity, 4, 8);
    if (!scaled.ok) throw new Error("Expected valid scaling");
    const converted = convertQuantity(scaled.quantity, source.unit, "imperial");
    const snapshot = {
      kind: "parsed" as const,
      name: source.name,
      ...converted,
    };
    const first = mergeShopping([], [snapshot]);
    if (!first.ok) throw new Error("Expected valid snapshot");
    const second = mergeShopping(first.shopping, [snapshot]);
    expect(second).toMatchObject({
      ok: true,
      shopping: [{ quantity: converted.quantity * 2, unit: "oz" }],
    });
    expect(source.quantity).toBe(1 / 3);
    expect(first.shopping[0]).toMatchObject({ quantity: converted.quantity });
  });

  it("rejects the entire add after an earlier successful merge when a later quantity overflows", () => {
    const current: ShoppingItem[] = [
      flour,
      {
        kind: "parsed",
        id: "item-milk",
        name: "milk",
        unit: "ml",
        quantity: 1_000_000,
        checked: true,
      },
    ];
    const before = structuredClone(current);
    expect(
      mergeShopping(current, [
        { kind: "parsed", name: "flour", unit: "g", quantity: 500 },
        { kind: "parsed", name: "milk", unit: "ml", quantity: 1 },
      ]),
    ).toEqual({ ok: false, error: "limit-exceeded" });
    expect(current).toEqual(before);
  });

  it("permits merges at the row limit but rejects new rows without changing checked state", () => {
    const current: ShoppingItem[] = Array.from(
      { length: 1000 },
      (_, index) => ({
        kind: "text",
        id: `item-${index}`,
        raw: `ingredient ${index}`,
        checked: true,
      }),
    );
    expect(
      mergeShopping(current, [{ kind: "text", raw: "ingredient 0" }]).ok,
    ).toBe(true);
    expect(
      mergeShopping(current, [
        { kind: "text", raw: "ingredient 0" },
        { kind: "text", raw: "extra" },
      ]),
    ).toEqual({ ok: false, error: "limit-exceeded" });
    expect(current.every((item) => item.checked)).toBe(true);
  });

  it("rejects invalid snapshot quantities and field lengths, while retaining true zero", () => {
    for (const quantity of [-1, Infinity, NaN, 1_000_001]) {
      expect(
        mergeShopping(
          [flour],
          [{ kind: "parsed", name: "flour", unit: "g", quantity }],
        ).ok,
      ).toBe(false);
    }
    expect(mergeShopping([], [{ kind: "text", raw: "x".repeat(501) }]).ok).toBe(
      false,
    );
    expect(
      mergeShopping(
        [],
        [{ kind: "parsed", name: "x".repeat(501), unit: null, quantity: 0 }],
      ).ok,
    ).toBe(false);
    expect(
      mergeShopping(
        [],
        [{ kind: "parsed", name: "eggs", unit: null, quantity: 0 }],
      ),
    ).toMatchObject({ ok: true, shopping: [{ quantity: 0 }] });
  });

  it("persists check, uncheck, clear checked and reload with full precision", () => {
    const context = fixture();
    const shopping: ShoppingItem[] = [
      { ...flour, quantity: 1 / 3 },
      { kind: "text", id: "item-salt", raw: "salt to taste", checked: false },
    ];
    expect(
      context.repository.save({ ...context.repository.document, shopping }).ok,
    ).toBe(true);
    expect(
      new RecipeRepository("fr", () => context.storage).document.shopping,
    ).toEqual(shopping);
    const unchecked = shopping.map((item) => ({ ...item, checked: false }));
    expect(
      context.repository.save({
        ...context.repository.document,
        shopping: unchecked,
      }).ok,
    ).toBe(true);
    expect(
      new RecipeRepository("en", () => context.storage).document.shopping.every(
        (item) => !item.checked,
      ),
    ).toBe(true);
    context.repository.save({ ...context.repository.document, shopping });
    context.repository.save({
      ...context.repository.document,
      shopping: shopping.filter((item) => !item.checked),
    });
    expect(
      new RecipeRepository("en", () => context.storage).document.shopping,
    ).toEqual([shopping[1]]);
  });

  it("keeps the durable list and bytes intact when add, check or clear writes fail", () => {
    for (const mutation of ["add", "check", "clear"]) {
      const context = fixture();
      context.repository.save({
        ...context.repository.document,
        shopping: [flour],
      });
      const old = context.repository.document;
      const bytes = context.raw();
      const merged = mergeShopping(old.shopping, [
        { kind: "parsed", name: "flour", unit: "g", quantity: 500 },
      ]);
      if (!merged.ok) throw new Error("Expected valid merge");
      const shopping =
        mutation === "add"
          ? merged.shopping
          : mutation === "check"
            ? [{ ...flour, checked: false }]
            : [];
      context.fail();
      expect(context.repository.save({ ...old, shopping })).toEqual({
        ok: false,
        error: "storage-full",
      });
      expect(context.repository.document).toBe(old);
      expect(context.raw()).toBe(bytes);
    }
  });

  it("rejects a shopping write exceeding the document byte limit with no partial changes", () => {
    const context = fixture();
    context.repository.save({
      ...context.repository.document,
      shopping: [flour],
    });
    const old = context.repository.document;
    const bytes = context.raw();
    const shopping: ShoppingItem[] = Array.from(
      { length: 1000 },
      (_, index) => ({
        kind: "text",
        id: `item-${index}`,
        raw: "😀".repeat(250),
        checked: false,
      }),
    );
    const userRecipes = Array.from({ length: 100 }, (_, index) => ({
      id: `user-${index}`,
      title: "Large recipe",
      baseServings: 4,
      ingredients: [parseLine("salt")],
      steps: Array.from({ length: 10 }, () => "a".repeat(2000)),
    }));
    expect(context.repository.save({ ...old, shopping, userRecipes })).toEqual({
      ok: false,
      error: "limit-exceeded",
    });
    expect(context.repository.document).toBe(old);
    expect(context.raw()).toBe(bytes);
  });
});
