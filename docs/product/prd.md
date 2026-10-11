# Pinch v1 product requirements

Status: implementation-ready specification, not implementation or release approval.
Sources: [product brief](../../specs/idea.md), [design](../design.md),
[prototype findings](../prototype-review.md). Technical contract:
[architecture](../architecture/overview.md).

## Purpose and scope

Pinch is a private, bilingual kitchen workbench: enter a recipe once, scale it, read it in
preferred units, follow large cooking steps, and collect a shopping checklist. Home cooks,
cooks with busy hands, and shoppers are the primary users. Start with a ready-to-scale sample,
not an empty form. EN and FR have equal coverage; user-authored recipes are never translated.

V1 includes all nine functional scope items in the brief. It is a static Vite/TypeScript app,
without a UI framework or backend. No accounts, device sync, URL import, nutrition, photos,
analytics, ads, AI generation, ingredient-density inference, or runtime third-party services.
The prototype is disposable and must not become the production entry point.

### Assumptions and constraints

- Base and target servings are integers from 1 to 24, making the prototype's bounded range an
  explicit v1 limit. Recipe title: 1-200 trimmed characters; ingredients: 1-200 nonempty lines,
  each at most 500 characters; steps: 1-100 nonempty steps, each at most 2,000 characters.
  These limits apply equally to editing and import; reject, never silently truncate.
- Quantities are finite, nonnegative values up to 1,000,000 before scaling. Calculations must
  remain finite. A zero quantity is valid; a zero denominator is not.
- Browser storage may be denied, full, corrupt, or evicted. The app must communicate these
  limitations, preserve the last good data, and offer export. "Local" is not a backup.
- Offline operation starts after a successful online load and completed cache installation.
  A first-ever offline visit cannot install the app.
- T-002's required browser gate is still blocked. The user authorized this documentation step
  only; build must wait for T-002 to pass. No browser validation or governance waiver is implied.
- The verified production destination is
   `https://devopsabcs-engineering.github.io/on-live-demo-sdlc/`; use
   `/on-live-demo-sdlc/` as the Pages base; see ADR-007.

## Numbered requirements and acceptance criteria

Each `ACn.m` is an independently verifiable acceptance criterion for requirement `Rn`.
Unless specified otherwise, UI criteria apply in both languages and themes.

### R1 - Recipe entry and library

1. **AC1.1:** First use seeds exactly three bilingual samples (pancakes, soup, salad), with EN/FR
   titles, ingredient names and equal step counts. Choosing a sample immediately shows quantities.
   Reopening never duplicates seeds; clearing data restores this first-use state on reload.
2. **AC1.2:** Create and edit a title, base servings, ingredient lines and numbered steps.
   Saving valid input persists it and selects that recipe; cancelling changes neither saved
   content nor the selected recipe. Editing a sample makes a new user recipe, leaving the
   original bilingual sample intact.
3. **AC1.3:** Whitespace-only required fields, out-of-range/fractional servings and exceeded
   limits produce localized field errors, focus the first invalid field and leave saved data
   unchanged. Numbered steps remove only an initial `1. ` or `1) `-style prefix.
4. **AC1.4:** User text such as `<img src=x onerror=alert(1)>` displays literally in library,
   ingredients, cook mode and shopping list; it never becomes markup.

### R2 - Quantity parsing and scaling

1. **AC2.1:** Parse integers, dot/comma decimals, fractions and mixed numbers:
   `2 eggs`, `1.5 l milk`, `1,5 l lait`, `1/2 cup milk`, `1 1/2 cup milk`.
   Scale `250 g flour`, `300 ml milk`, `2 eggs` from 4 to 8 servings to
   `500 g`, `600 ml`, `4`; from 4 to 1 servings show `1/2` egg.
2. **AC2.2:** Plain text (`salt to taste`), malformed numbers (`1/0 cup milk`),
   negative/over-limit numbers and ambiguous ranges (`1-2 cups flour`) remain visibly
   unchanged with no invented quantities. Unknown unit words remain verbatim; no density
   or unit meaning is inferred.
3. **AC2.3:** Always compute from the stored base quantity and `target / base` ratio.
   Repeated servings/unit changes never accumulate rounding. Invalid target input reports
   an error and retains the last valid servings and quantities.
4. **AC2.4:** Display grams and millilitres rounded to integers, using localized `< 1` for
   positive values below one. Other quantities use the fraction/decimal policy in the
   architecture. True zero stays zero; positive subprecision values never appear as zero.

### R3 - Metric and imperial display

1. **AC3.1:** Toggle mass and volume with one control using documented exact factors for
   g/kg/oz/lb and ml/l/US tsp/tbsp/cup/fl oz. `1 oz` equals `28.349523125 g`;
   `1 cup` equals `236.5882365 ml`. Units and decimals are localized.
2. **AC3.2:** Counts, unparsed text and unknown units are unchanged except for valid quantity
   scaling. Cups never become grams; mass never becomes volume. Returning to the original
   display system preserves source quantities exactly.

### R4 - Cook mode

1. **AC4.1:** Show one step in large type in a viewport-filling modal; request native fullscreen
   when available from the opening user gesture. Denial/absence retains the usable modal.
   Previous/next buttons, left/right keys and horizontal swipes navigate identically without
   wrapping; first/last boundaries disable the respective button.
2. **AC4.2:** Focus stays in the modal; Escape/close exits, releases wake lock/fullscreen
   acquired by Pinch and restores the opener's focus. Navigation exposes the current
   step and total to assistive technology.
3. **AC4.3:** Request Screen Wake Lock only while cooking and visible. Reacquire after
   visibility resumes if cooking remains active. Unsupported, denied or failed requests
   show localized "screen may sleep" feedback; cooking remains usable. Closing/backgrounding
   does not leave Pinch holding a wake lock.

### R5 - Durable shopping list

1. **AC5.1:** Add a snapshot of the current scaled recipe in its current display system.
   Adding the same 8-serving recipe twice produces `1,000 g flour`, `1,200 ml milk`,
   `8 eggs`, not duplicate rows. Store full-precision quantities, not rounded display strings.
2. **AC5.2:** Merge only normalized identical names and canonical identical units;
   keep different units, different names and parsed/plain-text items separate.
   Exact normalized plain-text duplicates appear once. Language switching does not
   silently translate saved list text or change its merge identity.
3. **AC5.3:** Check/uncheck persists across reload; adding to a checked row reopens it.
   Clear checked removes only checked rows. Empty state is localized. Storage failures
   leave the previous durable list intact and announce that the attempted change was not saved.

### R6 - English/French and light/dark

1. **AC6.1:** Language changes update document `lang`, all controls, validation/status messages,
   open dialogs and sample content without resetting selection, servings, units or list state.
   French decimals use commas. User recipes and shopping snapshots remain verbatim.
2. **AC6.2:** Language/theme choices persist where storage works. First use defaults to French
   for a browser locale starting with `fr`, otherwise English; theme follows system preference
   until explicitly selected, and units default to metric. Clearing data restores these
   defaults. Both themes use the design's accessible tokens and local fonts.
3. **AC6.3:** A Node-based catalog parity check fails on missing/extra keys, empty translations
   or unequal interpolation tokens. Build invokes it; a deliberately removed FR key makes
   build exit nonzero. No untranslated key/fallback identifier may ship.

### R7 - Local data, JSON transfer and clearing

1. **AC7.1:** Recipes, shopping list and preferences persist in localStorage under the
   versioned contract in the architecture. No account, server or runtime third-party network
   request is required. Startup with corrupt/unsupported data warns without overwriting it.
2. **AC7.2:** Export downloads a version-1 JSON document containing user recipes, shopping
   list and preferences. Export/import into a clean profile preserves that state and
   reseeds the three bundled samples without duplication.
3. **AC7.3:** Import is an explicit confirmed replacement, never an implicit merge. Invalid
   JSON, oversized files, unknown schema versions, inconsistent raw/parsed ingredient values,
   duplicate IDs and invalid numeric/field values fail visibly, with no state/storage changes.
   A valid import whose
   write fails also leaves prior state/storage unchanged.
4. **AC7.4:** Clear-all-data requires localized confirmation, removes only Pinch-owned storage
   and resets to first-use defaults/samples. Cancel does nothing; a removal failure preserves
   current state and reports failure. Never clear another app's origin storage.

### R8 - Installable offline PWA

1. **AC8.1:** Production has a valid manifest, local 192/512 PNG icons, standalone display,
   base-scoped start URL and service worker. Supported Chromium exposes installability;
   absence of install UI in other browsers does not break use.
2. **AC8.2:** After first successful cache installation, offline reload supports library,
   entry/edit, scaling/conversion, cooking (subject to browser capabilities), shopping,
   language/theme, JSON transfer and clearing without remote resources.
3. **AC8.3:** A failed new cache installation retains the old working shell. Updates notify
   rather than force reload during cooking/editing; accepting an update activates the new
   shell. Old caches are removed only after successful activation, within Pinch's namespace.

### R9 - Responsive accessibility

1. **AC9.1:** At 360, 768 and 1440 CSS px, both themes/languages have no horizontal page
   scrolling or clipped controls. Reflow at 200% zoom remains usable.
2. **AC9.2:** All actions work by keyboard without swipe/fullscreen/wake-lock support;
   controls have explicit accessible names/labels, visible focus and at least 44 px targets.
   A skip link, semantic headings, field error associations and polite status regions exist.
3. **AC9.3:** WCAG 2.1 AA: normal text >= 4.5:1, large text and control/focus indicators
   >= 3:1; focus order/containment/restoration are verified. Reduced motion removes
   nonessential transitions; gestures do not disable normal scrolling.

### R10 - Portable, reproducible production tooling

1. **AC10.1:** Use Vite, strict TypeScript, vanilla DOM, CSS variables, Vitest, Playwright's
   managed Chromium, ESLint and Prettier. Commit a lockfile; Node 22 LTS and `npm ci`
   reproduce builds without system-installed browsers.
2. **AC10.2:** CI runs clean install, build, lint, unit, i18n-parity and Chromium acceptance
   on Ubuntu and Windows using identical npm scripts. No hard-coded OS paths, Unix-only
   shell utilities or OS-specific environment syntax occur in scripts/tests.
3. **AC10.3:** Unit tests cover parsing/formatting, scaling, conversion, merging, schema
   validation/transfer, storage failures and catalog parity. E2E covers scale, convert,
   cook, shop, language, persistence, transfer and offline reload, including error paths.

### R11 - Performance, privacy and release governance

1. **AC11.1:** Built-site Lighthouse performance score is >= 0.90 in a recorded mobile run:
   Chromium, 360x800 viewport, simulated 1.6 Mbps down/750 Kbps up, 150 ms latency,
   4x CPU slowdown, cold cache. Record tool version, machine and report; no desktop-only
   or unthrottled proxy qualifies.
2. **AC11.2:** No secrets, remote fonts/CDNs, analytics, telemetry or runtime third-party
   calls. Secret/SAST/privacy checks have no unresolved blocking findings; `npm audit`
   reports zero high/critical issues for the committed lockfile.
3. **AC11.3:** A future Pages workflow is manual-only and rejects missing/false
   `governance_approved`; this input never substitutes for real Product Owner,
   Security Team and Tech Lead approval of the exact artifact. Pre-deploy, smoke and
   rollback-ready pass before a release is considered complete.
4. **AC11.4:** Production paths work under `/on-live-demo-sdlc/`; destination identity is
   `devopsabcs-engineering/on-live-demo-sdlc`. No push/deploy occurs before exact-artifact
   approval.

## Build backlog and traceability

All slices are pending, owned by `ait-frontend-dev`, phase `build`. Every slice requires
`build`, `lint`, `unit`, `i18n-parity`, `portable-os`; gate results initially `not_run`.
The two project gates are specified in the architecture, not claimed as already executable.
T-004 establishes their tooling. Missing required tooling blocks a future slice.

| Task | Single slice | Dependencies | Acceptance coverage |
|---|---|---|---|
| T-004 | Portable bilingual application shell and tooling | T-002, T-003 | AC6.2-6.3, AC9.1-9.3 shell, AC10.1-10.2 |
| T-005 | Pure ingredient quantities, scaling and conversion | T-004 | AC2.1-2.4, AC3.1-3.2 |
| T-006 | Durable recipe workbench and bilingual sample library | T-005 | AC1.1-1.4, AC6.1, AC7.1 recipe/preferences |
| T-007 | Durable shopping snapshot/checklist | T-006 | AC5.1-5.3, AC7.1 list |
| T-008 | Accessible cooking session | T-007 | AC4.1-4.3, AC9.2-9.3 modal/gesture |
| T-009 | Validated local JSON transfer and data reset | T-008 | AC7.2-7.4 |
| T-010 | Offline/installable application shell | T-009 | AC8.1-8.3, AC11.4 base paths |

The serial chain avoids shared DOM/catalog/storage contention in a teaching run. Each slice
includes focused unit tests and the E2E scenarios it introduces. Later, separately scheduled
QA verifies all ACs, including cross-cutting AC9, AC10.3 and AC11.1; critic and security review
verify AC11.2, and sign-off/release tasks verify AC11.3-11.4. Those later tasks are deliberately
not appended or run by this request. Seven build slices are not the entire lifecycle.

## Risks and readiness

Browser capability variability, storage eviction, fractional display accuracy and service-worker
updates require explicit negative-path tests. No destructive migration is planned; unsupported
storage versions are retained for export/recovery, not guessed. No Responsible-AI inference
exists, but imported user content is untrusted text. T-002 and the Pages identity mismatch
remain visible prerequisites, not spec defects silently treated as resolved.
