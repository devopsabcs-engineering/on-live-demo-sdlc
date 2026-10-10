import {
  createDefaultDocument,
  DOCUMENT_KEY,
  MAX_DOCUMENT_BYTES,
  parseDocument,
  type DocumentV1,
} from "../preferences";

export type StorageError =
  | "corrupt-data"
  | "unsupported-version"
  | "storage-unavailable"
  | "storage-full"
  | "storage-conflict"
  | "limit-exceeded"
  | "invalid-document";
export type SaveResult =
  | { ok: true; document: DocumentV1; saved: boolean }
  | { ok: false; error: StorageError };
type StoragePort = Pick<Storage, "getItem" | "setItem">;

export class RecipeRepository {
  document: DocumentV1;
  error: StorageError | null = null;
  private lastRaw: string | null = null;
  private temporary = false;
  private storage: StoragePort | null = null;

  constructor(browserLocale: string, getStorage: () => StoragePort) {
    this.document = createDefaultDocument(browserLocale);
    try {
      this.storage = getStorage();
      this.lastRaw = this.storage.getItem(DOCUMENT_KEY);
      if (this.lastRaw !== null) {
        const parsed = parseDocument(this.lastRaw);
        if (parsed) this.document = parsed;
        else {
          this.error = "corrupt-data";
          try {
            const candidate: unknown = JSON.parse(this.lastRaw);
            if (
              typeof candidate === "object" &&
              candidate !== null &&
              "schemaVersion" in candidate &&
              candidate.schemaVersion !== 1
            )
              this.error = "unsupported-version";
          } catch {
            this.error = "corrupt-data";
          }
        }
      }
    } catch {
      this.error = "storage-unavailable";
    }
  }

  startTemporarySession(): boolean {
    if (this.error !== "storage-unavailable") return false;
    this.temporary = true;
    return true;
  }

  storageChanged(): void {
    if (!this.temporary) this.error = "storage-conflict";
  }

  save(next: DocumentV1): SaveResult {
    const raw = JSON.stringify(next);
    if (new TextEncoder().encode(raw).length > MAX_DOCUMENT_BYTES)
      return { ok: false, error: "limit-exceeded" };
    const validated = parseDocument(raw);
    if (!validated) return { ok: false, error: "invalid-document" };
    if (this.temporary) {
      this.document = validated;
      return { ok: true, document: validated, saved: false };
    }
    if (this.error) return { ok: false, error: this.error };
    try {
      if (
        !this.storage ||
        this.storage.getItem(DOCUMENT_KEY) !== this.lastRaw
      ) {
        this.error = "storage-conflict";
        return { ok: false, error: this.error };
      }
      this.storage.setItem(DOCUMENT_KEY, raw);
      this.lastRaw = raw;
      this.document = validated;
      return { ok: true, document: validated, saved: true };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof DOMException && error.name === "QuotaExceededError"
            ? "storage-full"
            : "storage-unavailable",
      };
    }
  }
}
