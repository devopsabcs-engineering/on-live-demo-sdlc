import "./styles.css";
import { isCatalogKey, translate, type CatalogKey } from "./i18n";
import { DOCUMENT_KEY, type DocumentV1, type UserRecipe } from "./preferences";
import { RecipeRepository } from "./data/repository";
import { getSample, sampleIds } from "./data/samples";
import { mergeShopping, type ShoppingSnapshot } from "./domain/shopping";
import { CookSession, cookStep, swipeStep } from "./cook-session";
import {
  validateDraft,
  type RecipeField,
  type RecipeFieldError,
} from "./domain/recipes";
import {
  convertQuantity,
  formatQuantity,
  formatUnit,
  scaleQuantity,
} from "./domain/quantities";

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required Pinch control: ${selector}`);
  return element;
}

const localeSelect = required<HTMLSelectElement>("#locale");
const themeSelect = required<HTMLSelectElement>("#theme");
const unitsSelect = required<HTMLSelectElement>("#units");
const statusRegion = required<HTMLElement>("#status");
const warningRegion = required<HTMLElement>("#storage-warning");
const library = required<HTMLElement>("#library");
const servingsInput = required<HTMLInputElement>("#target-servings");
const editor = required<HTMLElement>("#editor");
const temporaryButton = required<HTMLButtonElement>("#temporary-session");
const newButton = required<HTMLButtonElement>("#new-recipe");
const editButton = required<HTMLButtonElement>("#edit-recipe");
const cookButton = required<HTMLButtonElement>("#start-cooking");
const cookDialog = required<HTMLDialogElement>("#cook-dialog");
const cookLocale = required<HTMLSelectElement>("#cook-locale");
const cookScroll = required<HTMLElement>("#cook-scroll");
const cookPrevious = required<HTMLButtonElement>("#cook-previous");
const cookNext = required<HTMLButtonElement>("#cook-next");
const cookClose = required<HTMLButtonElement>("#close-cooking");
const mediaPreference = window.matchMedia("(prefers-color-scheme: dark)");
const repository = new RecipeRepository(navigator.language, () => localStorage);
let appDocument = repository.document;
let selectedRecipeId: string = sampleIds[0] ?? "sample-pancakes";
let targetServings = getSelectedRecipe().baseServings;
let editingId: string | null = null;
let editorOpener: HTMLButtonElement = newButton;
let statusKey: CatalogKey | null = null;
let temporarySession = false;
let targetInvalid = false;
let fieldErrors: Partial<Record<RecipeField, RecipeFieldError>> = {};
let cookingStep = 0;
let swipe: { id: number; x: number; y: number; vertical: number } | null = null;
const fullscreenTarget = document.documentElement;
const cooking = new CookSession(
  {
    ...(navigator.wakeLock
      ? { requestWakeLock: () => navigator.wakeLock.request("screen") }
      : {}),
    ...(typeof fullscreenTarget.requestFullscreen === "function"
      ? { requestFullscreen: () => fullscreenTarget.requestFullscreen() }
      : {}),
    hasFullscreen: () => document.fullscreenElement !== null,
    ownsFullscreen: () => document.fullscreenElement === fullscreenTarget,
    exitFullscreen: () => document.exitFullscreen(),
  },
  renderCooking,
);

const fields = {
  title: required<HTMLInputElement>("#recipe-name"),
  baseServings: required<HTMLInputElement>("#base-servings"),
  ingredients: required<HTMLTextAreaElement>("#ingredient-lines"),
  steps: required<HTMLTextAreaElement>("#step-lines"),
};
const errorElements = {
  title: required<HTMLElement>("#title-error"),
  baseServings: required<HTMLElement>("#base-error"),
  ingredients: required<HTMLElement>("#ingredients-error"),
  steps: required<HTMLElement>("#steps-error"),
};
const fieldOrder: RecipeField[] = [
  "title",
  "baseServings",
  "ingredients",
  "steps",
];

function text(key: CatalogKey): string {
  return translate(appDocument.preferences.locale, key);
}

function getSelectedRecipe(): UserRecipe {
  const recipe =
    getSample(selectedRecipeId, appDocument.preferences.locale) ??
    appDocument.userRecipes.find(
      (candidate) => candidate.id === selectedRecipeId,
    );
  if (!recipe) throw new Error("Selected recipe is missing.");
  return recipe;
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

function renderMessages(): void {
  statusRegion.textContent = statusKey ? text(statusKey) : "";
  warningRegion.textContent = temporarySession
    ? text("temporaryNotice")
    : repository.error
      ? text(repository.error)
      : "";
  temporaryButton.hidden =
    repository.error !== "storage-unavailable" || temporarySession;
  required<HTMLElement>("#target-error").textContent = targetInvalid
    ? text("servings-error")
    : "";
  servingsInput.setAttribute("aria-invalid", String(targetInvalid));
  for (const field of fieldOrder) {
    const error = fieldErrors[field];
    errorElements[field].textContent = error ? text(error) : "";
    fields[field].setAttribute("aria-invalid", String(Boolean(error)));
  }
}

function renderIngredients(): void {
  const list = required<HTMLElement>("#recipe-ingredients");
  list.replaceChildren();
  const recipe = getSelectedRecipe();
  for (const ingredient of recipe.ingredients) {
    const row = document.createElement("li");
    if (ingredient.kind === "text") row.textContent = ingredient.raw;
    else {
      const scaled = scaleQuantity(
        ingredient.quantity,
        recipe.baseServings,
        targetServings,
      );
      if (!scaled.ok) throw new Error("Validated recipe could not be scaled.");
      const converted = convertQuantity(
        scaled.quantity,
        ingredient.unit,
        appDocument.preferences.units,
      );
      const amount = document.createElement("span");
      amount.className = "ingredient-amount";
      amount.textContent =
        `${formatQuantity(converted.quantity, converted.unit, appDocument.preferences.locale)} ${formatUnit(converted.unit, appDocument.preferences.locale)}`.trim();
      const name = document.createElement("span");
      name.textContent = ingredient.name;
      row.append(amount, name);
    }
    list.append(row);
  }
}

function renderRecipe(): void {
  const recipe = getSelectedRecipe();
  required<HTMLElement>("#recipe-title").textContent = recipe.title;
  servingsInput.value = String(targetServings);
  required<HTMLButtonElement>("#decrease-servings").disabled =
    targetServings === 1;
  required<HTMLButtonElement>("#increase-servings").disabled =
    targetServings === 24;
  renderIngredients();
  const steps = required<HTMLElement>("#recipe-steps");
  steps.replaceChildren();
  for (const step of recipe.steps) {
    const row = document.createElement("li");
    row.textContent = step;
    steps.append(row);
  }
}

function renderShopping(): void {
  const list = required<HTMLElement>("#shopping-list");
  const focusedId =
    document.activeElement instanceof HTMLInputElement
      ? document.activeElement.dataset["itemId"]
      : undefined;
  list.replaceChildren();
  for (const item of appDocument.shopping) {
    const row = document.createElement("li");
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset["itemId"] = item.id;
    checkbox.checked = item.checked;
    const description = document.createElement("span");
    description.textContent =
      item.kind === "text"
        ? item.raw
        : [
            formatQuantity(
              item.quantity,
              item.unit,
              appDocument.preferences.locale,
            ),
            formatUnit(item.unit, appDocument.preferences.locale),
            item.name,
          ]
            .filter(Boolean)
            .join(" ");
    checkbox.addEventListener("change", () => {
      commit(
        {
          ...appDocument,
          shopping: appDocument.shopping.map((saved) =>
            saved.id === item.id
              ? { ...saved, checked: checkbox.checked }
              : saved,
          ),
        },
        "shoppingSaved",
      );
      renderShopping();
      renderMessages();
    });
    label.append(checkbox, description);
    row.append(label);
    list.append(row);
    if (item.id === focusedId) checkbox.focus();
  }
  required<HTMLElement>("#shopping-empty").hidden =
    appDocument.shopping.length > 0;
  required<HTMLButtonElement>("#clear-checked").disabled =
    !appDocument.shopping.some((item) => item.checked);
}

function renderLibrary(): void {
  const focusedId =
    document.activeElement instanceof HTMLElement
      ? document.activeElement.dataset["recipeId"]
      : undefined;
  library.replaceChildren();
  const recipes = [
    ...sampleIds.map((id) => getSample(id, appDocument.preferences.locale)),
    ...appDocument.userRecipes,
  ];
  for (const recipe of recipes) {
    if (!recipe) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset["recipeId"] = recipe.id;
    button.textContent = recipe.title;
    button.setAttribute("aria-pressed", String(recipe.id === selectedRecipeId));
    button.disabled = !editor.hidden;
    button.addEventListener("click", () => {
      selectedRecipeId = recipe.id;
      targetServings = recipe.baseServings;
      targetInvalid = false;
      renderLibrary();
      renderRecipe();
      renderMessages();
    });
    library.append(button);
    if (recipe.id === focusedId && !button.disabled) button.focus();
  }
}

function render(): void {
  document.documentElement.lang = appDocument.preferences.locale;
  document.title = `Pinch | ${text("workbenchTitle")}`;
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    const key = element.dataset["i18n"];
    if (key && isCatalogKey(key)) element.textContent = text(key);
  });
  localeSelect.value = appDocument.preferences.locale;
  themeSelect.value = appDocument.preferences.theme;
  unitsSelect.value = appDocument.preferences.units;
  localeSelect.setAttribute("aria-label", text("languageLabel"));
  themeSelect.setAttribute("aria-label", text("appearanceLabel"));
  library.setAttribute("aria-label", text("libraryLabel"));
  for (const [selector, key] of [
    ["#decrease-servings", "fewerServings"],
    ["#increase-servings", "moreServings"],
  ] as const) {
    const button = required<HTMLButtonElement>(selector);
    button.setAttribute("aria-label", text(key));
    button.title = text(key);
  }
  applyTheme();
  renderLibrary();
  renderRecipe();
  renderShopping();
  renderMessages();
  renderCooking();
}

function renderCooking(): void {
  if (!cookDialog.open) return;
  const recipe = getSelectedRecipe();
  required<HTMLElement>("#cook-title").textContent = recipe.title;
  required<HTMLElement>("#cook-progress").textContent = text("cookProgress")
    .replace("{current}", String(cookingStep + 1))
    .replace("{total}", String(recipe.steps.length));
  required<HTMLElement>("#cook-step").textContent =
    recipe.steps[cookingStep] ?? "";
  cookLocale.value = appDocument.preferences.locale;
  for (const [control, key] of [
    [cookClose, "closeCooking"],
    [cookPrevious, "previousStep"],
    [cookNext, "nextStep"],
  ] as const) {
    control.setAttribute("aria-label", text(key));
    control.title = text(key);
  }
  cookScroll.setAttribute("aria-label", text("stepsLabel"));
  required<HTMLElement>(".cook-navigation").setAttribute(
    "aria-label",
    text("stepsLabel"),
  );
  cookPrevious.disabled = cookingStep === 0;
  cookNext.disabled = cookingStep === recipe.steps.length - 1;
  required<HTMLElement>("#cook-feedback").textContent = [
    cooking.fullscreenUnavailable ? text("fullscreenUnavailable") : "",
    cooking.wakeUnavailable ? text("wakeUnavailable") : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function navigateCooking(delta: number): void {
  if (!cookDialog.open) return;
  const next = cookStep(cookingStep, delta, getSelectedRecipe().steps.length);
  if (next === cookingStep) return;
  cookingStep = next;
  renderCooking();
  cookScroll.scrollTop = 0;
  if (document.activeElement === cookPrevious && cookPrevious.disabled)
    cookNext.focus();
  if (document.activeElement === cookNext && cookNext.disabled)
    cookPrevious.focus();
}

function closeCooking(): void {
  cooking.close();
  swipe = null;
  if (cookDialog.open) cookDialog.close();
  document.body.classList.remove("cooking");
  cookButton.focus();
}

cookButton.addEventListener("click", () => {
  if (!editor.hidden || cookDialog.open) return;
  cookingStep = 0;
  cookDialog.showModal();
  document.body.classList.add("cooking");
  cookScroll.scrollTop = 0;
  cooking.open(document.visibilityState === "visible");
  cookClose.focus();
});
cookClose.addEventListener("click", closeCooking);
cookDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeCooking();
});
cookDialog.addEventListener("close", () => {
  if (!cookDialog.open) closeCooking();
});
cookPrevious.addEventListener("click", () => navigateCooking(-1));
cookNext.addEventListener("click", () => navigateCooking(1));
cookLocale.addEventListener("change", () => {
  if (cookLocale.value === "en" || cookLocale.value === "fr")
    updatePreference("locale", cookLocale.value);
});
cookDialog.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeCooking();
  } else if (event.key === "Tab") {
    const controls = Array.from(
      cookDialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), select, [tabindex="0"]',
      ),
    );
    const index = controls.indexOf(document.activeElement as HTMLElement);
    const next = event.shiftKey
      ? (index - 1 + controls.length) % controls.length
      : (index + 1) % controls.length;
    event.preventDefault();
    controls[next]?.focus();
  } else if (
    !(event.target instanceof HTMLSelectElement) &&
    (event.key === "ArrowLeft" || event.key === "ArrowRight")
  ) {
    event.preventDefault();
    navigateCooking(event.key === "ArrowRight" ? 1 : -1);
  }
});
cookScroll.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary || event.button !== 0) {
    swipe = null;
    return;
  }
  swipe = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    vertical: 0,
  };
});
cookScroll.addEventListener("pointermove", (event) => {
  if (swipe?.id === event.pointerId)
    swipe.vertical = Math.max(
      swipe.vertical,
      Math.abs(event.clientY - swipe.y),
    );
});
cookScroll.addEventListener("pointerup", (event) => {
  if (swipe?.id !== event.pointerId) return;
  navigateCooking(
    swipeStep(
      event.clientX - swipe.x,
      Math.max(swipe.vertical, Math.abs(event.clientY - swipe.y)),
    ),
  );
  swipe = null;
});
cookScroll.addEventListener("pointercancel", () => {
  swipe = null;
});
document.addEventListener("visibilitychange", () => {
  swipe = null;
  cooking.setVisible(document.visibilityState === "visible");
});
window.addEventListener("pagehide", () => cooking.setVisible(false));
window.addEventListener("pageshow", () =>
  cooking.setVisible(document.visibilityState === "visible"),
);

function commit(next: DocumentV1, success: CatalogKey): boolean {
  const result = repository.save(next);
  if (!result.ok) {
    statusKey = result.error;
    renderMessages();
    return false;
  }
  appDocument = result.document;
  statusKey = result.saved ? success : "temporaryNotice";
  return true;
}

function updatePreference<K extends keyof DocumentV1["preferences"]>(
  key: K,
  value: DocumentV1["preferences"][K],
): void {
  commit(
    {
      ...appDocument,
      preferences: { ...appDocument.preferences, [key]: value },
    },
    "preferenceSaved",
  );
  render();
}

function openEditor(copySelected: boolean): void {
  editorOpener = copySelected ? editButton : newButton;
  const recipe = copySelected ? getSelectedRecipe() : null;
  editingId = recipe?.id.startsWith("user-") ? recipe.id : null;
  fields.title.value = recipe?.title ?? "";
  fields.baseServings.value = String(recipe?.baseServings ?? 4);
  fields.ingredients.value =
    recipe?.ingredients.map((ingredient) => ingredient.raw).join("\n") ?? "";
  fields.steps.value =
    recipe?.steps.map((step, index) => `${index + 1}. ${step}`).join("\n") ??
    "";
  fieldErrors = {};
  editor.hidden = false;
  newButton.disabled = true;
  editButton.disabled = true;
  cookButton.disabled = true;
  renderLibrary();
  renderMessages();
  fields.title.focus();
}

function closeEditor(): void {
  editor.hidden = true;
  newButton.disabled = false;
  editButton.disabled = false;
  cookButton.disabled = false;
  fieldErrors = {};
  renderLibrary();
  renderMessages();
  editorOpener.focus();
}

newButton.addEventListener("click", () => openEditor(false));
editButton.addEventListener("click", () => openEditor(true));
required<HTMLButtonElement>("#cancel-editor").addEventListener(
  "click",
  closeEditor,
);
required<HTMLFormElement>("#recipe-form").addEventListener(
  "submit",
  (event) => {
    event.preventDefault();
    const result = validateDraft(
      {
        title: fields.title.value,
        baseServings: fields.baseServings.value,
        ingredients: fields.ingredients.value,
        steps: fields.steps.value,
      },
      editingId ?? `user-${crypto.randomUUID()}`,
    );
    fieldErrors = result.ok ? {} : result.errors;
    renderMessages();
    if (!result.ok) {
      const first = fieldOrder.find((field) => fieldErrors[field]);
      if (first) fields[first].focus();
      return;
    }
    if (!editingId && appDocument.userRecipes.length >= 100) {
      statusKey = "limit-exceeded";
      renderMessages();
      return;
    }
    const recipes = editingId
      ? appDocument.userRecipes.map((recipe) =>
          recipe.id === editingId ? result.recipe : recipe,
        )
      : [...appDocument.userRecipes, result.recipe];
    if (!commit({ ...appDocument, userRecipes: recipes }, "recipeSaved"))
      return;
    selectedRecipeId = result.recipe.id;
    targetServings = result.recipe.baseServings;
    targetInvalid = false;
    closeEditor();
    render();
  },
);

function changeServings(value: number): void {
  targetInvalid = !Number.isInteger(value) || value < 1 || value > 24;
  if (!targetInvalid) targetServings = value;
  renderRecipe();
  renderMessages();
}

required<HTMLButtonElement>("#add-shopping").addEventListener("click", () => {
  const recipe = getSelectedRecipe();
  const snapshots: ShoppingSnapshot[] = recipe.ingredients.map((ingredient) => {
    if (ingredient.kind === "text")
      return { kind: "text", raw: ingredient.raw };
    const scaled = scaleQuantity(
      ingredient.quantity,
      recipe.baseServings,
      targetServings,
    );
    if (!scaled.ok) throw new Error("Validated recipe could not be scaled.");
    const converted = convertQuantity(
      scaled.quantity,
      ingredient.unit,
      appDocument.preferences.units,
    );
    return { kind: "parsed", name: ingredient.name, ...converted };
  });
  const result = mergeShopping(appDocument.shopping, snapshots);
  if (!result.ok) statusKey = result.error;
  else commit({ ...appDocument, shopping: result.shopping }, "shoppingAdded");
  renderShopping();
  renderMessages();
});
required<HTMLButtonElement>("#clear-checked").addEventListener("click", () => {
  if (
    commit(
      {
        ...appDocument,
        shopping: appDocument.shopping.filter((item) => !item.checked),
      },
      "shoppingCleared",
    )
  ) {
    required<HTMLButtonElement>("#add-shopping").focus();
  }
  renderShopping();
  renderMessages();
});
servingsInput.addEventListener("change", () =>
  changeServings(Number(servingsInput.value)),
);
required<HTMLButtonElement>("#decrease-servings").addEventListener(
  "click",
  () => changeServings(targetServings - 1),
);
required<HTMLButtonElement>("#increase-servings").addEventListener(
  "click",
  () => changeServings(targetServings + 1),
);

localeSelect.addEventListener("change", () => {
  if (localeSelect.value === "en" || localeSelect.value === "fr") {
    updatePreference("locale", localeSelect.value);
  }
});

themeSelect.addEventListener("change", () => {
  if (
    themeSelect.value === "system" ||
    themeSelect.value === "light" ||
    themeSelect.value === "dark"
  ) {
    updatePreference("theme", themeSelect.value);
  }
});

unitsSelect.addEventListener("change", () => {
  if (unitsSelect.value === "metric" || unitsSelect.value === "imperial")
    updatePreference("units", unitsSelect.value);
});
temporaryButton.addEventListener("click", () => {
  temporarySession = repository.startTemporarySession();
  renderMessages();
});

mediaPreference.addEventListener("change", () => {
  if (appDocument.preferences.theme === "system") applyTheme();
});

window.addEventListener("storage", (event) => {
  if (event.key === DOCUMENT_KEY || event.key === null) {
    repository.storageChanged();
    renderMessages();
  }
});

render();
