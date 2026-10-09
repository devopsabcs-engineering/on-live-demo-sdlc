# Pinch v1 architecture

Status: accepted for specification; implementation gates, prototype browser review and human
release sign-off are not passed by this document. [PRD](../product/prd.md) is the product
contract; [review](spec-review.md) records the T-003 gate.

## Solution shape and alternatives

Choose a static vanilla TypeScript application with pure domain functions and a small DOM
controller. It satisfies the brief with fewer dependencies than a React/server stack.
Extending the inline prototype would be simpler initially but would couple disposable UX
logic to production persistence and testing. A framework/backend adds unnecessary hosting,
privacy and operational cost. The production root is separate from `prototype/`.

Suggested implementation layout (not created in T-003):

```text
index.html                 semantic production entry
src/main.ts                startup, event binding, focused DOM updates
src/domain/                parser, quantity math, formatting, conversion, merge
src/data/                  schema validation, repository, transfer, bundled samples
src/i18n/                  en/fr catalogs, interpolation and locale helpers
src/styles.css             design tokens, light/dark, responsive/reduced motion
public/                    local PWA icons and manifest
src/sw.ts                  compiled standalone service worker
scripts/                   Node parity, portable gate and PWA build helpers
tests/                     Vitest domain/storage and Playwright acceptance
```

Paths above are logical repository paths, not hard-coded OS paths in scripts. Resolve filesystem
paths with Node `path`/URL APIs. No HTTP business API, authentication, server database or secrets
exist. Browser APIs are localStorage, File/Blob, download links, service worker/cache,
optional Fullscreen and Screen Wake Lock. Network use is first-party static hosting only.

## Binding decisions

One decision per ADR; all ADRs are binding for v1 implementation within the stated release hold.

| ADR | Decision | Requirements |
|---|---|---|
| [ADR-001](adr/001-static-vanilla-stack.md) | Static vanilla stack with portable npm tooling | R9-R11 |
| [ADR-002](adr/002-quantity-and-unit-semantics.md) | Immutable quantity math and dimensional US conversion | R2-R3, R5 |
| [ADR-003](adr/003-versioned-local-data.md) | One versioned localStorage document and confirmed transfer | R1, R5, R7 |
| [ADR-004](adr/004-bilingual-content.md) | EN/FR parity and verbatim user/snapshot text | R1, R6 |
| [ADR-005](adr/005-progressive-cook-mode.md) | Accessible modal with progressive browser capabilities | R4, R9 |
| [ADR-006](adr/006-base-scoped-offline-shell.md) | Base-scoped, versioned offline shell with explicit activation | R8, R11 |
| [ADR-007](adr/007-gated-pages-release.md) | Preserve supplied Pages base; hold release until identity/governance verified | R11 |

## Domain contracts

Strict TypeScript types, explicit validation at import/storage boundaries, no unchecked casts.
Use discriminated unions; schemas reject unknown properties in persisted/imported documents.

```ts
type Locale = "en" | "fr";
type Theme = "light" | "dark";
type UnitSystem = "metric" | "imperial";
type Unit = "g" | "kg" | "oz" | "lb" | "ml" | "l" | "tsp" | "tbsp" | "cup" | "fl-oz";
type Ingredient =
  | { kind: "parsed"; raw: string; quantity: number; unit: Unit | null; name: string }
  | { kind: "text"; raw: string };
type UserRecipe = {
  id: string; title: string; baseServings: number;
  ingredients: Ingredient[]; steps: string[];
};
type ShoppingItem =
  | { kind: "parsed"; id: string; name: string; unit: Unit | null;
      quantity: number; checked: boolean }
  | { kind: "text"; id: string; raw: string; checked: boolean };
type Preferences = { locale: Locale; theme: Theme | "system"; units: UnitSystem };
type DocumentV1 = {
  schemaVersion: 1; userRecipes: UserRecipe[]; shopping: ShoppingItem[];
  preferences: Preferences;
};
```

Bundled samples are immutable code assets with stable IDs `sample-pancakes`, `sample-soup`,
`sample-salad`, shared numeric base quantities/units and `en`/`fr` title/name/step variants.
They are not stored in the document. User IDs have `user-` prefixes; list IDs have `item-`
prefixes, generated with `crypto.randomUUID()`. Import requires unique IDs in each collection;
user IDs cannot collide with reserved sample IDs. No relational foreign keys exist in shopping:
it contains independent snapshots, not recipe references.

Runtime state adds `selectedRecipeId`, `targetServings`, editor draft and cooking index;
these are ephemeral and reset on reload to the first sample/base servings. Preferences and
recipes/list are durable. First-use and post-clear defaults are no user recipes, an empty
shopping list, locale `fr` when the browser's primary locale starts with `fr` (otherwise `en`),
theme `system`, units `metric`, selected first sample and its base servings. Imported valid
preferences replace these defaults. The document contains at most 100 user recipes and 1,000 shopping
rows; numeric quantities (including shopping aggregates) must be finite in [0, 1,000,000].
Reject an edit/add/import that would exceed a limit, with localized feedback and no partial save.
UTF-8 import files are capped at 2 MiB; serialized document writes have the same byte limit.
PRD field/count limits apply to all persisted fields. Text shopping rows use the ingredient
500-character limit; parsed shopping names use the same limit.

### Functional interfaces

| Interface | Input -> output / behavior |
|---|---|
| `parseLine` | raw line -> `Ingredient`; unsupported syntax becomes text, never throws away raw input |
| `scale` | parsed quantity, valid base/target -> unrounded number; invalid values return typed validation error |
| `convert` | number, canonical unit, system -> unrounded number and display unit; counts/text are unchanged |
| `formatQuantity` | finite quantity, display unit, locale -> localized presentation only |
| `mergeShopping` | current rows, displayed-unrounded ingredient snapshots -> new validated rows or limit error |
| `validateDocument` | unknown JSON -> validated `DocumentV1` or field/path errors; no mutation |
| `loadDocument` | -> success, empty, unavailable, corrupt or unsupported result; retain corrupt raw bytes |
| `saveDocument` | validated next document -> success/error; update UI document only after successful write |
| `exportDocument` | validated document -> versioned JSON Blob; no bundled sample duplication |
| `importDocument` | File -> bounded parse/validation/confirmation/save; all-or-nothing replacement |
| `clearData` | confirmed user action -> remove Pinch document, then reset; failure retains UI state |
| `t` | catalog key + typed token values -> localized text; no HTML or silent untranslated-key fallback |

These are local module interfaces, not endpoints. Errors carry stable codes such as
`invalid-servings`, `limit-exceeded`, `storage-unavailable`, `storage-full`,
`corrupt-data`, `unsupported-version`, `invalid-import`, `capability-unavailable`;
catalogs own the visible messages. Do not log user recipe text or exported documents.

## Parsing, calculation and merge policy

- Trim surrounding whitespace and match an entire leading quantity. Accept unsigned integer,
  decimal (`.` or `,`, no thousands separator), `a/b` and `a b/c`; require positive denominator
  and nonempty suffix. Reject range/scientific/negative syntax as text. Explicitly support
  single-character fraction inputs `¼`, `½`, `¾` as additional input aliases; never
  treat punctuation adjacent to a quantity as a unit boundary.
- Recognize case-insensitive whole-token aliases only: `g`, `gram(s)`, `gramme(s)`;
  `kg`, `kilogram(s)`, `kilogramme(s)`; `oz`, `ounce(s)`, `once(s)`; `lb`, `lbs`,
  `pound(s)`, `livre(s)`; `ml`, `milliliter(s)`, `millilitre(s)`; `l`, `liter(s)`,
  `litre(s)`; `tsp`, `teaspoon(s)`, `c. a cafe`/`c. à café`; `tbsp`, `tablespoon(s)`,
  `c. a soupe`/`c. à soupe`; `cup(s)`, `tasse(s)`; `fl oz`, `fluid ounce(s)`.
  Longest alias wins and must leave a nonempty name. Everything else after a valid quantity
  is the unchanged name with `unit: null`: `3 scoops flour` scales its number, but does not
  reinterpret "scoops" as a known unit. `2 eggs` likewise is a count.
- A failed parse keeps the whole line as text; show it without quantity controls. Quantity
  scaling is `source * target / base`. Never persist display rounding or mutate base amounts.
- Exact canonical factors: 1 kg = 1,000 g; 1 oz = 28.349523125 g;
  1 lb = 453.59237 g; 1 l = 1,000 ml; 1 US tsp = 4.92892159375 ml;
  1 US tbsp = 14.78676478125 ml; 1 US cup = 236.5882365 ml;
  1 US fl oz = 29.5735295625 ml. No density or UK-cup assumption.
- Metric display chooses g or ml; imperial chooses oz for mass and cup for volume.
  Counts/unknown suffixes have null units and never convert. Converting back recalculates
  from source, not from the prior display. Unit aliases canonicalize before merging.
- g/ml display rounds to nearest integer (half up); 0 < q < 1 displays `< 1`.
  Other units/counts choose the nearest fraction using denominators 2, 3, 4, 8 only when
  nonzero and relative error <= 2%; break ties with the smaller denominator and reduce.
  Otherwise display up to two decimals with `Intl.NumberFormat`, trimming trailing zeros.
  A positive value below 0.01 displays localized `< 0.01`; zero displays `0`.
  Unit numeric tests use relative tolerance 1e-10 for floating-point calculations.
- Merge key is kind + name (Unicode NFC, trimmed/collapsed whitespace, locale-independent
  lowercase) + canonical unit/null; do not strip accents, singularize or translate.
  Parsed rows sum unrounded quantities and become unchecked. Text rows de-duplicate by
  normalized raw line and become unchecked. Keep the first row's spelling/ID.
  EN `milk` and FR `lait` are distinct names, not automatic synonyms; the UI explains this.
  Reject overflow for the entire add transaction. Different units are never auto-converted
  to merge, even if physically equivalent. Round only when rendering totals.

## Persistence and transfer

Use key `pinch:v1:document`, one JSON document for an atomic localStorage `setItem`.
Do not call `localStorage.clear()`. No migration from the prototype's preference keys;
the prototype is disposable. A future schema version requires a separately reviewed migration.
Missing key produces defaults plus code-bundled samples; saving the first durable mutation
creates the key. Unsupported/corrupt content leaves bytes intact and disables durable
mutation until explicit reset or a valid confirmed import. Offer raw-document recovery
download, distinct from validated JSON export; never label corrupt bytes as a valid export.

Read failures show a persistent local-only warning and permit a clearly labeled temporary
session with JSON export. In this mode mutations are explicitly unsaved, not success-shaped
durable operations. A write failure from a previously durable session leaves the old document
and UI intact; drafts remain available to retry/copy. Successful `setItem` precedes UI commit.
For cross-tab safety, detect `storage` changes and compare the raw stored document to the
last-read bytes immediately before a write; a detected change blocks writing and asks the
user to reload/export. localStorage has no compare-and-swap, so simultaneous writes can still
race; multi-tab editing is unsupported in v1 and disclosed, not falsely called conflict-proof.

Import checks byte size, JSON object shape, exact schema version/properties, enums, field
limits, unique IDs and every parsed numeric value. Reparse user `raw` ingredients and require
stored kind/quantity/unit/name to match, preventing inconsistent documents. Validate full
content before presenting a summary and replacement confirmation. Save with a single write,
then update selection/cooking/drafts. Never run HTML, functions or imported prototype keys.
The JSON contract rejects non-finite numbers, duplicate IDs and additional properties;
JSON syntax itself cannot encode NaN/Infinity. Export pretty-printed validated document only.
Cancel/rejection does not write. Clearing removes this key and then restores runtime defaults;
offline shell caches stay available because they contain only app assets, not personal data.
UI describes clear-all as clearing personal data/preferences, not uninstalling the PWA.

## DOM, language and cooking

Semantic HTML, `textContent`, labeled inputs and localized polite status regions implement
the design. Render only changed sections to retain focus; never rebuild a focused editor on
each keystroke. `lang` is `en`/`fr`; number formatting uses `en-US`/`fr-FR`. UI catalogs have
identical nested leaf keys, nonempty strings and identical named placeholder sets.
The parity script also checks all sample variants and static/dynamic catalog references.
Changing language updates sample views but not user content or captured shopping text.
Use local CSS/system fonts, design tokens, `prefers-color-scheme` and reduced-motion rules.

Native `<dialog>` fills the viewport; focus begins at the step heading/control, is contained,
and returns to its opener. Fullscreen is an enhancement requested on a user gesture.
Track only fullscreen/wake-lock resources acquired by Pinch. Capability errors surface as
localized status, never prevent closing/navigation. Swipe: horizontal delta >= 50 CSS px
and greater than vertical delta; ignore events on controls and preserve vertical scrolling.
Escape, buttons and arrows remain first-class. Wake-lock request/release is wrapped with
explicit state checks; release events, visibility changes and dialog close handle races so
late requests are released if cooking already ended. No gesture is needed to complete a task.

## Offline shell and hosting

Vite `base` is `/ai-sdlc-labs-pinch/`. Manifest `id`, `scope` and `start_url` use that prefix;
icon/script/style URLs are base-relative, never origin-root assumptions. Register the worker
at the base URL with matching scope. Root navigation only; no client router or server rewrite.
A Node build helper compiles the worker and supplies the actual emitted asset list (including
hashed JS/CSS, manifest and icons). Do not precache TypeScript source or guess hashed filenames.
Use a content-hash cache namespace `pinch-shell-<buildHash>`.

Install all same-origin shell assets into a new cache; any failed required response aborts
installation and removes the incomplete new cache, leaving the active worker/cache untouched.
Default waiting lifecycle retains the old worker until the user accepts an update or all
controlled clients close. An accepted activation sends a message to the waiting worker;
reload on controller change only after warning about unsaved editor/cooking state.
After activation, remove only obsolete `pinch-shell-` caches. Cache-first known shell
assets and base-root navigation fallback to cached index; do not intercept third-party
requests, cache user documents or respond to unrelated paths. Initial online failure is
reported; first-ever offline use is unsupported, not disguised as a working empty app.

## Tooling and gate contracts

No executable production tooling exists yet; T-003 is a documented review, not a build.
T-004 must establish these npm scripts and CI; later tasks extend their test scopes.
Node 22 LTS, a committed npm lockfile and managed Playwright Chromium are the baseline.
Scripts are Node-based or tool CLIs, not shell-specific inline scripts.

| Gate | Future command/criterion | Evidence required |
|---|---|---|
| build | `npm run build`: parity + strict type check + Vite build | clean build log |
| lint | `npm run lint`: ESLint and Prettier check | no errors or format changes |
| unit | `npm run test:unit`: Vitest non-watch | new slice happy/error tests |
| i18n-parity (project) | `npm run check:i18n` | equal keys/tokens, samples and references; removed FR key fails |
| portable-os (project) | Ubuntu/Windows CI: `npm ci`, build, lint, unit, parity and `npm run test:e2e` | both jobs green for the same commit; neither job skipped |
| acceptance (later QA) | `npm run test:e2e`, manual a11y checks, recorded throttled performance audit | PRD AC traceability and Chromium results |
| critic (later) | documented code review | no blockers |
| security (later) | established secret/SAST checks, `npm audit --audit-level=high`, privacy inspection | zero high/critical dependency issues, no blocking findings |

`portable-os` is a composite CI gate, not an alias for passing a Windows-only local test.
Install Chromium with Playwright's own installer; Linux may use `--with-deps`, Windows the
normal installer. Paths/test logic remain identical. Smoke E2E exists in T-004 and grows with
each slice; E2E must target the built site at its configured base. Cross-OS evidence requires
authorized remote CI or separate real runner execution; a local commit/no-push instruction
does not authorize triggering CI remotely. If evidence/tooling is unavailable, leave the
required gate `not_run`/`skipped` and the future task open.

Performance acceptance records Lighthouse version/machine and the PRD's throttled profile.
PWA smoke is manifest/worker/offline verification, not a substitute for a >= 0.90 score.
Tests cover negative storage/import/capability/update paths, no third-party requests, EN/FR,
both themes, all three widths and keyboard focus. No numerical coverage target was supplied;
require explicit behavioral coverage instead of inventing a percentage.

## Backlog, rollout and operational risks

[PRD backlog](../product/prd.md#build-backlog-and-traceability) maps T-004-T-010 to ACs.
The canonical runtime state remains `.copilot-tracking/2026-10-09-pinch-plan/state.json`.
Build is blocked on T-002; T-003's docs-only authorization is not a prototype waiver.
No backend specialist is needed because the app has no backend.

Later QA, critic and security tasks must precede human sign-off. After all three approvers
approve the exact artifact, prepare a manual Pages workflow with a boolean
`governance_approved` input, artifact validation and pre-deploy/smoke/rollback-ready checks.
Never embed secrets or infer approval from that input alone. The brief points at
`devopsabcs-engineering/ai-sdlc-labs-pinch`, while this checkout is
`emmanuelknafo/on-live-demo-sdlc`; release must resolve destination permissions/identity.
Do not silently deploy to either repository with the other's base.

Roll back by redeploying the last approved immutable static artifact, retaining schema v1 and
using a new cache identity. Later smoke verifies correct base, manifest, offline reload and
data compatibility. Existing installed clients may keep the old shell until activation;
never claim immediate forced rollback on offline devices. No production workflow, push,
infrastructure change, data migration or deploy is performed in this plan step.
