import sampleVariants from "./sample-variants.json";
import { parseLine } from "../domain/quantities";
import type { Locale, UserRecipe } from "../preferences";

export type SampleId = keyof typeof sampleVariants;

function freezeAsset<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(freezeAsset);
    Object.freeze(value);
  }
  return value;
}

const assets = freezeAsset(sampleVariants);
export const sampleIds: readonly string[] = Object.freeze(Object.keys(assets));

export function getSample(id: string, locale: Locale): UserRecipe | undefined {
  const asset = Object.entries(assets).find(
    ([sampleId]) => sampleId === id,
  )?.[1];
  if (!asset) return undefined;
  const variant = asset[locale];
  const ingredients = asset.ingredients.map((ingredient, index) => {
    const name = variant.names[index];
    if (!name) throw new Error("Sample ingredient name is missing.");
    return parseLine(
      `${ingredient.quantity} ${ingredient.unit ?? ""} ${name}`.replace(
        / +/gu,
        " ",
      ),
    );
  });
  return {
    id,
    title: variant.title,
    baseServings: asset.baseServings,
    ingredients,
    steps: [...variant.steps],
  };
}
