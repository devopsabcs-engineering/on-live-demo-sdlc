import { parseLine } from "./quantities";
import type { UserRecipe } from "../preferences";

export interface RecipeDraft {
  title: string;
  baseServings: string;
  ingredients: string;
  steps: string;
}
export type RecipeField = keyof RecipeDraft;
export type RecipeFieldError =
  "title-error" | "servings-error" | "ingredients-error" | "steps-error";
export type DraftResult =
  | { ok: true; recipe: UserRecipe }
  | { ok: false; errors: Partial<Record<RecipeField, RecipeFieldError>> };

export function validateDraft(draft: RecipeDraft, id: string): DraftResult {
  const title = draft.title.trim();
  const baseServings = Number(draft.baseServings);
  const ingredients = draft.ingredients
    .split(/\r?\n/u)
    .filter((line) => line.trim() !== "");
  const steps = draft.steps
    .split(/\r?\n/u)
    .filter((line) => line.trim() !== "")
    .map((line) => line.replace(/^\s*\d+[.)]\s+/u, "").trim());
  const errors: Partial<Record<RecipeField, RecipeFieldError>> = {};
  if (!title || title.length > 200) errors.title = "title-error";
  if (!Number.isInteger(baseServings) || baseServings < 1 || baseServings > 24)
    errors.baseServings = "servings-error";
  if (
    !ingredients.length ||
    ingredients.length > 200 ||
    ingredients.some((line) => line.length > 500)
  )
    errors.ingredients = "ingredients-error";
  if (
    !steps.length ||
    steps.length > 100 ||
    steps.some((line) => !line || line.length > 2000)
  )
    errors.steps = "steps-error";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    recipe: {
      id,
      title,
      baseServings,
      ingredients: ingredients.map(parseLine),
      steps,
    },
  };
}
