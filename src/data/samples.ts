import sampleVariants from "./sample-variants.json";
import type { Locale } from "../preferences";

export type SampleId = keyof typeof sampleVariants;

export const localizedSampleNames: Record<SampleId, Record<Locale, string>> = sampleVariants;