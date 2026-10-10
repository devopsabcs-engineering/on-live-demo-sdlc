---
title: T-011 Pinch acceptance QA
description: PRD acceptance traceability, verified CI evidence, and outstanding acceptance blockers
ms.date: 2026-10-10
---

## Verdict

T-011 is blocked. The required `acceptance` gate is failed/incomplete, not passed.
AC9 has remaining verification gaps; required AC11.1 is skipped because qualifying
Lighthouse tooling/evidence is absent. No waiver is recorded or requested here.
AC11.2 also has a known dependency-policy failure for T-013. Release-only criteria
remain unexecuted, not waived. T-001 through T-010 retain their canonical done status.

## Provenance and execution

- Baseline production source: `7a9b7d7248584b448f03fe5034e28757fbf9a11f`.
  [CI 38051368325](https://github.com/emmanuelknafo/on-live-demo-sdlc/actions/runs/38051368325)
  passed Ubuntu/Windows with 124 unit and 53 browser tests each.
- Validated QA source: `2889f6019f91eeb671f04a938aeeb40c57462362`.
  [CI 38052236059](https://github.com/emmanuelknafo/on-live-demo-sdlc/actions/runs/38052236059)
  passed both platform jobs: clean `npm ci`, managed Chromium installation, build,
  lint/Prettier, 125 unit tests, catalog parity, and 55 browser tests per OS.
- Recorded runners: `ubuntu-latest` and `windows-latest`, Node `22.23.3`, Playwright
  `1.63.0`, Chrome for Testing `153.0.8010.12` (Chromium revision `1243`), Vitest
  `3.2.7`, TypeScript `5.9.3`, Vite `6.4.3`, committed lockfile version 3.
  Browser tests use the production preview and `/ai-sdlc-labs-pinch/` base.
- Local focused E2E commands stopped at `'tsc' is not recognized`; the focused
  unit command stopped at `'vitest' is not recognized`. Catalog parity ran locally
  and passed with 80 keys and three sample variants. The reported local npm
  `EALLOWREMOTE` restriction was not bypassed. No dependency install was attempted.
  Formatting used an already-cached Prettier; authoritative lint passed in CI.
- The Actions artifact API returned `total_count: 0` for both baseline and final
  test runs. Evidence consists of verified CI logs and test assertions, not
  downloadable reports, retained screenshots, a built binary, or Lighthouse output.
  [CI workflow](../.github/workflows/ci.yml) uploads no artifacts.
- QA commits `8ecf6a1`, `1695d2b`, and `2889f60` change only three existing test
  files. Production implementation, dependencies and workflow are unchanged.
  The subsequent evidence-only commit has the same implementation/test tree;
  its final SHA and CI result are returned with the handoff.

## Test plan and traceability

The [PRD](../docs/product/prd.md) is the acceptance source, including its requirement
that UI criteria apply in both languages/themes. C means covered by passing tests
and targeted source inspection, not exhaustive UI-state or WCAG certification.
P means only part of the criterion is evidenced; S means skipped and blocking;
L means later-phase/not run. No unexecuted clause is treated as a pass.

Evidence keys refer to these existing suites:

- Q: [quantity unit tests](../tests/unit/quantities.test.ts)
- R: [recipe validation unit tests](../tests/unit/recipes.test.ts)
- D: [repository unit tests](../tests/unit/repository.test.ts)
- P: [preferences/schema/catalog unit tests](../tests/unit/preferences.test.ts)
- S: [sample unit tests](../tests/unit/samples.test.ts)
- C: [cooking unit tests](../tests/unit/cook-session.test.ts)
- W: [PWA unit tests](../tests/unit/pwa.test.ts)
- ER: [recipe/shopping browser tests](../tests/e2e/recipes.spec.ts)
- ES: [shell/accessibility browser tests](../tests/e2e/shell.spec.ts)
- EC: [cooking browser tests](../tests/e2e/cooking.spec.ts)
- ET: [transfer browser tests](../tests/e2e/transfer.spec.ts)
- EW: [offline browser tests](../tests/e2e/offline.spec.ts)

| Criterion | Status                       | Evidence and limits                                                                                                                                                                                                                                                                                                                                                              |
| --------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1.1     | C                            | S validates three immutable bilingual samples and equal counts; ER seeds/reopens without duplication; ET resets/reloads to three.                                                                                                                                                                                                                                                |
| AC1.2     | C                            | ER create/edit/save/cancel and sample-copy tests assert selection, exact content and durable bytes.                                                                                                                                                                                                                                                                              |
| AC1.3     | C                            | R bounds every field/count and strips only initial numbered prefixes; ER localized errors preserve drafts/bytes and focus invalid fields. Full per-field locale/theme error matrix remains a risk.                                                                                                                                                                               |
| AC1.4     | C                            | ER, ET and EC display malicious-looking text literally in library, ingredients, steps, shopping and cooking, with no injected elements.                                                                                                                                                                                                                                          |
| AC2.1     | C                            | Q integer/decimal/comma/fraction/mixed parsing; strengthened ER asserts 500 g, 600 ml, four eggs and half an egg at the specified ratios.                                                                                                                                                                                                                                        |
| AC2.2     | P                            | Q preserves malformed/range/negative/over-limit raw input and unknown suffixes; renderer inspection shows textContent/no inference. No dedicated EN/FR browser assertion exercises all these unchanged lines after scaling/conversion.                                                                                                                                           |
| AC2.3     | C                            | Q source immutability and conversion drift checks; ER source-based round trip and invalid-target retention/error.                                                                                                                                                                                                                                                                |
| AC2.4     | C                            | Q zero, positive tiny values, fractions and comma decimals; ER precision snapshot displays `< 1`; integer-rounding implementation inspected. Not every rounding boundary is explicitly tested.                                                                                                                                                                                   |
| AC3.1     | C                            | Q documented factors for all mass/volume units and French labels; ER single control converts and restores display.                                                                                                                                                                                                                                                               |
| AC3.2     | C                            | Q dimension separation/counts/source round trips; D and ER snapshots retain add-time units; unknown suffix parser verified in Q.                                                                                                                                                                                                                                                 |
| AC4.1     | C                            | EC modal viewport dimensions, native fullscreen/fallback, buttons/keys/swipes and boundaries; C navigation rules.                                                                                                                                                                                                                                                                |
| AC4.2     | C                            | EC Tab/Shift+Tab containment, Escape/close/native cancel and opener restoration; polite atomic step/total region inspected in HTML.                                                                                                                                                                                                                                              |
| AC4.3     | C                            | C/EC absent/denied/failed/late capabilities, visible/background/resume, release and external-fullscreen ownership. Successful wake-lock hardware behavior is mocked, not device certification.                                                                                                                                                                                   |
| AC5.1     | C                            | ER twice-added 8-serving snapshot asserts 1,000 g, 1,200 ml and eight eggs; D/ER retain full precision.                                                                                                                                                                                                                                                                          |
| AC5.2     | C                            | D aliases, normalized names, unlike dimensions/names/accents/kinds and text de-duplication; ER language snapshots remain literal.                                                                                                                                                                                                                                                |
| AC5.3     | C                            | D/ER check/uncheck/reload/reopen/clear; quota/row/quantity/byte limits preserve old bytes/list and announce no saved change; bilingual empty state.                                                                                                                                                                                                                              |
| AC6.1     | C                            | ER, EC, ET and EW locale changes preserve drafts/selection/servings/units/list and localize open cooking/error/status UI; Q decimal commas. No exhaustive dynamic-message/theme matrix.                                                                                                                                                                                          |
| AC6.2     | C                            | P/ES system/default/persisted preference tests; ET French-browser reset; local font stack and both theme token sets inspected.                                                                                                                                                                                                                                                   |
| AC6.3     | C                            | New P isolated catalog fixtures reject missing/extra/empty/token mismatches; removed FR key makes npm build fail before typecheck on both OSes; live catalog parity passes.                                                                                                                                                                                                      |
| AC7.1     | C                            | D/P/ER versioned persistence, corrupt/unsupported bytes and denied/full/conflicting storage; EW observes only base-local requests during complete flows.                                                                                                                                                                                                                         |
| AC7.2     | C                            | ET real JSON download and clean-profile replacement preserve user/list/preferences and reintroduce samples without duplicates; D round trip.                                                                                                                                                                                                                                     |
| AC7.3     | C                            | P/D/ET JSON/version/extra fields/duplicate IDs/raw mismatch/numeric/field/count/UTF-8/byte/read failures, confirmed replacement and failed-write atomicity.                                                                                                                                                                                                                      |
| AC7.4     | C                            | D/ET localized cancel/confirm, removal failure, first-use reset, draft cleanup and preservation of foreign storage; EW preserves caches.                                                                                                                                                                                                                                         |
| AC8.1     | C                            | EW Chromium manifest/installability error APIs, decoded 192/512 local PNGs, standalone/base identity and worker scope; W emitted assets. No actual OS install or other-browser run.                                                                                                                                                                                              |
| AC8.2     | C                            | EW EN/FR built-site offline reload executes all local workflows and checks no third-party requests/page errors after successful installation.                                                                                                                                                                                                                                    |
| AC8.3     | C                            | W failed installs/activation/claim/namespace/message boundaries; EW real-worker old-shell retention, deferred update, cancelled editor update and accepted cooking update.                                                                                                                                                                                                       |
| AC9.1     | P                            | ER/EC/EW plus new ES exercise 360/768/1440, both themes/locales, long text, page/dialog overflow and visible control bounds. Actual 200% browser zoom and internal text clipping/overlap are not verified.                                                                                                                                                                       |
| AC9.2     | P                            | New ES verifies visible control names, 44x44 targets and keyboard create/scale/convert/shop/cook/export/reset-cancel. EC focus containment/fallback and ET transfer targets; skip/headings/associated errors/polite regions inspected. Programmatic focus setup is not full Tab-order proof; import picker, temporary consent and update acceptance lack keyboard-only coverage. |
| AC9.3     | P                            | New ES measures ten token contrast pairs per theme, checks a visible focus outline and reduced-motion transition; EC real vertical touch scrolling and cooking focus tests. Not every computed state/pair, focus order, visual focus geometry, screen-reader behavior or WCAG 2.1 AA criterion is verified.                                                                      |
| AC10.1    | C                            | Committed package/config/lockfile and identical clean Node 22 CI installs build strict vanilla TS with managed Chromium, lint and Prettier.                                                                                                                                                                                                                                      |
| AC10.2    | C                            | Both OS jobs run identical npm scripts; portable config/test paths inspected, including new temporary Node fixtures.                                                                                                                                                                                                                                                             |
| AC10.3    | C                            | Q/R/D/P/S/C/W and ER/ES/EC/ET/EW cover the required domains and failures, now including automated catalog-negative tests. Coverage does not itself close the partial criteria above.                                                                                                                                                                                             |
| AC11.1    | S                            | No Lighthouse package/script/workflow or qualifying report. No performance score was measured. Required tooling absent; no waiver.                                                                                                                                                                                                                                               |
| AC11.2    | P / failed dependency policy | EW base-local requests and local-font inspection support privacy. Every inspected CI install reports two critical issues; explicit zero-high/critical npm audit, secret/SAST and privacy review are not established. T-013 owns follow-up.                                                                                                                                       |
| AC11.3    | L                            | Only CI push/PR workflow exists, no Pages release workflow. Manual governance-input rejection, real exact-artifact approvals, pre-deploy/smoke/rollback remain T-014/T-015 work. No deploy executed.                                                                                                                                                                             |
| AC11.4    | C base / L release           | EW verifies production base paths; destination identity is not verified and belongs to T-015. Historical no-push wording is not retroactively re-gated: canonical build tasks are done and QA pushes were explicitly authorized.                                                                                                                                                 |

## Findings and unblock requirements

1. AC11.1 is a blocking evidence/tooling gap at [package scripts](../package.json)
   and [CI](../.github/workflows/ci.yml). A qualifying built-site mobile Lighthouse
   run must record Chromium, 360x800 viewport, simulated 1.6 Mbps down/750 Kbps up,
   150 ms latency, 4x CPU slowdown, cold cache, score >= 0.90, tool version,
   machine and report. Existing Chromium tests are not a performance proxy.
   Under the repo-only tooling restriction, this cannot be completed here.
2. AC9.1-AC9.3 remain blocking partial verification at ES/ER/EC and
   [styles](../src/styles.css). Complete actual 200% browser-zoom and visual
   clipping/reflow checks, full keyboard action/focus order checks, and WCAG AA
   review of rendered states and assistive-technology semantics. Do not label
   token checks or viewport resizing as complete accessibility certification.
3. AC11.2 dependency policy is contradicted by both baseline and final test CI
   install logs: `3 vulnerabilities (1 moderate, 2 critical)`. The
   [lockfile](../package-lock.json) has not changed. Package/advisory identities
   and an explicit npm audit report were not retrieved; do not guess them.
   T-013 must investigate and resolve/revalidate the committed dependency set,
   then complete secret/SAST/privacy evidence. CI currently does not gate audit.
4. AC2.2's visible negative-input behavior and the full bilingual/theme field-error
   matrix remain focused acceptance gaps in ER. Add targeted UI assertions using
   existing Playwright tooling before claiming every implemented clause passes.
5. CI report retention is absent, not an acceptance waiver. EC creates screenshots
   on ephemeral runners, but no upload step retains them; a human visual review
   cannot be inferred from successful screenshot creation.

No new production defect was established by the added tests. Run
[38052058244](https://github.com/emmanuelknafo/on-live-demo-sdlc/actions/runs/38052058244)
failed identically on both OSes because the new assertion expected concatenated
DOM text `4 eggs` while the existing renderer uses separate spans (`4eggs` in
textContent, visually spaced by CSS). The test was corrected to assert amount/name
spans, not the implementation. Final CI passed, including the half-egg assertion.

## Scope and handoff

No production edits, dependency changes, release workflow, deploy or approval.
Protected unrelated untracked evidence and orchestrator state/plan/tasks/change
logs/decisions were not edited. One T-011 inbox handoff records this blocked result;
the orchestrator alone decides canonical state updates and rework routing.

### Gates - T-011

- acceptance: failed (incomplete AC9; AC11.1 skipped without waiver)

Verdict: FAIL. Return to the orchestrator with scoped QA rework; route dependency
findings to T-013 without claiming its security gate ran or advancing to release.
