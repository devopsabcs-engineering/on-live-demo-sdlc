import "./styles.css";
import { translate, type CatalogKey } from "./i18n";
import {
  createDefaultDocument,
  DOCUMENT_KEY,
  parseDocument,
  type DocumentV1,
  type Locale,
  type ThemePreference,
} from "./preferences";

const localeControl = document.querySelector<HTMLSelectElement>("#locale");
const themeControl = document.querySelector<HTMLSelectElement>("#theme");
const status = document.querySelector<HTMLElement>("#status");
const mediaPreference = window.matchMedia("(prefers-color-scheme: dark)");

if (!localeControl || !themeControl || !status) {
  throw new Error("The Pinch shell is missing a required control.");
}

const localeSelect = localeControl;
const themeSelect = themeControl;
const statusRegion = status;

let appDocument = createDefaultDocument(navigator.language);
let canPersist = true;

try {
  const raw = localStorage.getItem(DOCUMENT_KEY);
  if (raw !== null) {
    const parsed = parseDocument(raw);
    if (parsed) {
      appDocument = parsed;
    } else {
      canPersist = false;
      statusRegion.textContent = translate(
        appDocument.preferences.locale,
        "storedDataUnavailable",
      );
    }
  }
} catch {
  canPersist = false;
  statusRegion.textContent = translate(
    appDocument.preferences.locale,
    "preferenceSaveFailed",
  );
}

function text(key: CatalogKey): string {
  return translate(appDocument.preferences.locale, key);
}

function applyTheme(): void {
  const selected = appDocument.preferences.theme;
  const theme =
    selected === "system"
      ? mediaPreference.matches
        ? "dark"
        : "light"
      : selected;
  document.documentElement.dataset["theme"] = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#14231d" : "#edf2ef");
}

function render(): void {
  document.documentElement.lang = appDocument.preferences.locale;
  document.title = `Pinch | ${text("workbenchTitle")}`;
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    const key = element.dataset["i18n"] as CatalogKey | undefined;
    if (key) element.textContent = text(key);
  });
  localeSelect.value = appDocument.preferences.locale;
  themeSelect.value = appDocument.preferences.theme;
  localeSelect.setAttribute("aria-label", text("languageLabel"));
  themeSelect.setAttribute("aria-label", text("appearanceLabel"));
  applyTheme();
}

function updatePreference<K extends keyof DocumentV1["preferences"]>(
  key: K,
  value: DocumentV1["preferences"][K],
): void {
  appDocument = {
    ...appDocument,
    preferences: { ...appDocument.preferences, [key]: value },
  };

  if (canPersist) {
    try {
      localStorage.setItem(DOCUMENT_KEY, JSON.stringify(appDocument));
      statusRegion.textContent = text("preferenceSaved");
    } catch {
      canPersist = false;
      statusRegion.textContent = text("preferenceSaveFailed");
    }
  } else {
    statusRegion.textContent = text("preferenceSaveFailed");
  }
  render();
}

localeSelect.addEventListener("change", () => {
  if (localeSelect.value === "en" || localeSelect.value === "fr") {
    updatePreference("locale", localeSelect.value as Locale);
  }
});

themeSelect.addEventListener("change", () => {
  if (
    themeSelect.value === "system" ||
    themeSelect.value === "light" ||
    themeSelect.value === "dark"
  ) {
    updatePreference("theme", themeSelect.value as ThemePreference);
  }
});

mediaPreference.addEventListener("change", () => {
  if (appDocument.preferences.theme === "system") applyTheme();
});

render();
