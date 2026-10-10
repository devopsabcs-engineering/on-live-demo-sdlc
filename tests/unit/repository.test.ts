import { describe, expect, it } from "vitest";
import { RecipeRepository } from "../../src/data/repository";
import { DOCUMENT_KEY } from "../../src/preferences";

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
