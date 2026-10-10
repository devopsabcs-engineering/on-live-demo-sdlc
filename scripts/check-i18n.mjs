import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const en = JSON.parse(await readFile(join(root, "src/i18n/en.json"), "utf8"));
const fr = JSON.parse(await readFile(join(root, "src/i18n/fr.json"), "utf8"));
const samples = JSON.parse(
  await readFile(join(root, "src/data/sample-variants.json"), "utf8"),
);

function fail(message) {
  console.error(`i18n parity: ${message}`);
  process.exitCode = 1;
}

function leafEntries(value, prefix = "") {
  return Object.entries(value).flatMap(([key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) {
      return leafEntries(entry, path);
    }
    return [[path, entry]];
  });
}

function placeholders(value) {
  return [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)]
    .map((match) => match[1])
    .sort();
}

const english = new Map(leafEntries(en));
const french = new Map(leafEntries(fr));
for (const key of new Set([...english.keys(), ...french.keys()])) {
  if (!english.has(key) || !french.has(key))
    fail(`missing or extra catalog key "${key}"`);
  const enValue = english.get(key);
  const frValue = french.get(key);
  if (typeof enValue !== "string" || enValue.trim() === "")
    fail(`empty English value for "${key}"`);
  if (typeof frValue !== "string" || frValue.trim() === "")
    fail(`empty French value for "${key}"`);
  if (typeof enValue === "string" && typeof frValue === "string") {
    if (
      JSON.stringify(placeholders(enValue)) !==
      JSON.stringify(placeholders(frValue))
    ) {
      fail(`interpolation tokens differ for "${key}"`);
    }
  }
}

const expectedSamples = ["sample-pancakes", "sample-soup", "sample-salad"];
if (
  JSON.stringify(Object.keys(samples).sort()) !==
  JSON.stringify(expectedSamples.sort())
)
  fail("exactly the three reserved samples are required");
for (const [id, variants] of Object.entries(samples)) {
  if (
    !id.startsWith("sample-") ||
    typeof variants !== "object" ||
    variants === null
  ) {
    fail(`invalid sample variant "${id}"`);
    continue;
  }
  if (
    !Number.isInteger(variants.baseServings) ||
    variants.baseServings < 1 ||
    variants.baseServings > 24 ||
    !Array.isArray(variants.ingredients) ||
    variants.ingredients.length === 0
  ) {
    fail(`sample "${id}" has invalid base quantities`);
    continue;
  }
  for (const ingredient of variants.ingredients) {
    if (
      !Number.isFinite(ingredient.quantity) ||
      ingredient.quantity < 0 ||
      ingredient.quantity > 1_000_000 ||
      ![
        null,
        "g",
        "kg",
        "oz",
        "lb",
        "ml",
        "l",
        "tsp",
        "tbsp",
        "cup",
        "fl-oz",
      ].includes(ingredient.unit)
    )
      fail(`sample "${id}" has an invalid ingredient`);
  }
  for (const locale of ["en", "fr"]) {
    const variant = variants[locale];
    if (
      typeof variant !== "object" ||
      variant === null ||
      typeof variant.title !== "string" ||
      variant.title.trim() === "" ||
      !Array.isArray(variant.names) ||
      variant.names.length !== variants.ingredients.length ||
      variant.names.some(
        (name) => typeof name !== "string" || name.trim() === "",
      ) ||
      !Array.isArray(variant.steps) ||
      variant.steps.length === 0 ||
      variant.steps.some(
        (step) => typeof step !== "string" || step.trim() === "",
      )
    ) {
      fail(`sample "${id}" is missing a nonempty ${locale} variant`);
    }
  }
  if (variants.en?.steps?.length !== variants.fr?.steps?.length)
    fail(`sample "${id}" step counts differ`);
  if (
    Object.keys(variants).some(
      (key) => !["baseServings", "ingredients", "en", "fr"].includes(key),
    )
  )
    fail(`sample "${id}" contains an unsupported property`);
}

const sourceFiles = ["src/main.ts", "src/i18n/index.ts", "src/data/samples.ts"];
for (const file of sourceFiles) {
  const source = await readFile(join(root, file), "utf8");
  const references = [
    ...source.matchAll(/\btranslate\(\s*[^,\r\n]+,\s*["']([^"']+)["']\s*\)/g),
    ...source.matchAll(/\btext\(\s*["']([^"']+)["']\s*\)/g),
  ];
  for (const reference of references) {
    const key = reference[1];
    if (key && (!english.has(key) || !french.has(key))) {
      fail(`${file} references missing key "${key}"`);
    }
  }
}

const html = await readFile(join(root, "index.html"), "utf8");
for (const match of html.matchAll(/data-i18n="([^"]+)"/g)) {
  const key = match[1];
  if (key && (!english.has(key) || !french.has(key))) {
    fail(`index.html references missing key "${key}"`);
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `i18n parity passed: ${english.size} catalog keys, ${Object.keys(samples).length} bilingual sample labels, static references verified`,
);
