# Pinch prototype review

Artifact: `prototype/index.html`. Intent: `docs/design.md`.
Scope: design and static prototype only; no PRD, production implementation, push or deployment.

## Gate results

### Gates - T-001
- design-review: passed (documented review of journeys, states, wireframe, tokens, accessibility,
  localization and bounded acceptance criteria)
Verdict: PASS

### Gates - T-002
- prototype-review: skipped (required Playwright MCP tools are not exposed in this session)
Verdict: FAIL

T-002 is **blocked**, not done. No waiver exists and no human sign-off was granted. The
`ait-prototype-testing` skill was invoked as a prototype sub-step; real-browser verification
could not execute. No browser was launched and no screenshots or browser-console results exist.
Do not interpret the supplemental checks below as a prototype-review pass.

## Supplemental checks performed

Using only available Node/Python runtimes, without installing or adding test tooling:

| Check | Result |
|---|---|
| Entire inline JavaScript compiles | Passed using Node `vm.Script` |
| EN/FR catalog key parity | Passed; identical keys |
| Three bilingual sample recipes | Passed; names, ingredients and matching step counts |
| Source assertions | 56 passed across catalogs, bilingual samples, DOM translation references and pure helpers: fractions/mixed numbers, decimal comma, zero-denominator preservation, unknown units, counts, scaling, conversion and formatting |
| Runtime external references | No remote assets, script imports or network calls found |
| HTML IDs and label/ARIA references | Unique IDs and resolved references |
| Text palette contrast | Light: 6.32:1 minimum; dark: 7.95:1 minimum; action text: 7.83:1 / 11.97:1 |
| Control border palette contrast | At least 3:1 against both surfaces in both themes |
| Git whitespace check | Passed |

These checks cover source structure and pure helpers, not DOM layout, actual focus management,
clickable flows, browser console health or screen-reader usability. Contrast is calculated from
declared tokens, not measured from rendered pixels.

## Browser verification still required

Use Playwright MCP's headless Chromium when available. Open the static file, wait for
the recipe heading, then use an accessibility snapshot to locate controls.

| UX intent | Required browser evidence |
|---|---|
| Scale/convert | Pancakes at 4 → 8 servings: 250 → 500 g flour, 300 → 600 ml milk, 2 → 4 eggs. Halve to 1: 1/2 egg. US conversion yields ounces/cups; plain salt remains unchanged. Reject 0, 25 and fractional servings without losing valid quantities. |
| Entry | Create a recipe with `1 1/2 cup milk`, `1,5 l lait`, `2 eggs`, `salt to taste` and numbered steps. Confirm saved text, scaling and stripped step numbering. Reject whitespace-only fields. Cancel changes nothing. Treat HTML-looking text literally. |
| Library | Visit all three samples in EN and FR. Selection and save leave keyboard focus on a meaningful control. User-authored content remains verbatim on language changes. |
| Shop | Add the same scaled recipe twice, verify quantities double with no duplicate rows; add another recipe and merge olive oil when name/unit match. Check, clear, re-add and verify re-added items are unchecked. Clear all to see the empty state. |
| Cook | Open, move forward/back with buttons and arrows, check disabled boundaries, verify Escape closes and focus returns. Modal traps Tab. Screen-sleep disclaimer is visible. |
| Language/theme | Exercise EN/light, EN/dark, FR/light, FR/dark without losing recipe, quantities or checklist. Verify document `lang`, French decimal commas, dynamic messages and preferences after reload. Recipes/list reset as disclosed. |
| Responsive/a11y | At 360, 768 and 1440 px check no horizontal overflow, usable wrapped controls, visible focus, named inputs, modal focus containment, reduced motion and contrast. Capture desktop/mobile screenshots in both themes. |
| Health | Collect browser console errors and failed requests while walking all flows. Required result: no errors and no third-party requests. Close the browser/context afterwards. |

## Spec-ready findings and limitations

- A ready-to-scale sample removes the blank-start problem; keep the servings dial next to amounts.
- Conversion uses US factors: 1 oz = 28.349523125 g; 1 cup = 236.5882365 ml;
  1 tbsp = 14.78676478125 ml; 1 tsp = 4.92892159375 ml. No mass/volume cross-conversion.
- Quantities below half a gram/millilitre show `< 1`, rather than falsely becoming zero.
- Switching display units does not mutate source quantities. Shopping captures quantities at add
  time and merges only identical names and units, not unlike units.
- Edited sample text becomes user-authored text in its original language. Automatic recipe
  translation and ingredient-density inference are not implied.
- Session-only data, 1-24 servings and limited line parsing intentionally bound the spike.
  Full parsing, pluralization and persistence need later production design/tests.
- Cooking uses a native dialog, not actual fullscreen or wake lock. No installability or
  performance threshold is claimed.
- No UX interaction is described as browser-validated until the blocked review is completed.

Run tracking: `.copilot-tracking/2026-10-09-pinch-plan/` (git-ignored). This document persists
the important review outcome without force-adding runtime tracking files.
