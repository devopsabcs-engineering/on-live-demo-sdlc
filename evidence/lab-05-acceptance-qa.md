---
title: T-011 Pinch production acceptance QA
description: Replacement-artifact PRD traceability, cross-platform evidence, and the waived performance evidence gap
ms.date: 2026-10-10
---

## Verdict

T-011 passes its required `acceptance` gate for exact artifact
`8769bd3701225916ea76f6ba879a323dd154c029`. Implemented functional,
responsive, accessibility and cross-cutting criteria are covered by the exact-HEAD CI
result and retained browser evidence. AC11.1 remains unmeasured and has no Lighthouse
report, but a real human operator waived only that missing tooling and evidence for this
artifact. The waiver is not technical proof and is not release sign-off. AC11.2 remains
assigned to T-013. Release-only criteria remain unexecuted and unwaived.

## Provenance and execution

* Replacement artifact: `8769bd3701225916ea76f6ba879a323dd154c029` on `main`.
  Commit `8769bd3` changes documentation only after acceptance-test commit `59ed73d`.
* [CI 38081390349](https://github.com/devopsabcs-engineering/on-live-demo-sdlc/actions/runs/38081390349)
  passed the implementation-equivalent `59ed73d` tree on Ubuntu and Windows: clean
  install, managed Chromium, build, lint/format, 125 unit tests, catalog parity, and
  88 production-preview browser tests per operating system.
* [CI 38081411399](https://github.com/devopsabcs-engineering/on-live-demo-sdlc/actions/runs/38081411399)
  passed the exact replacement HEAD on both operating systems, including install,
  build, lint/format, unit, catalog parity, browser acceptance, evidence upload,
  and post-job cleanup.
* Browser evidence is retained for 14 days by the CI workflow. Tests exercise the
  built preview under `/ai-sdlc-labs-pinch/`.
* The local focused run stopped before tests because `tsc` was unavailable. The
  lockfile-backed restore then failed with `EALLOWREMOTE`; local Node 26.7.0 is also
  outside the required Node 22 range. No policy bypass or dependency change occurred.

## Test plan and traceability

The [PRD](../docs/product/prd.md) is the acceptance source, including its requirement
that UI criteria apply in both languages/themes. C means covered by passing tests
and targeted source inspection, not exhaustive UI-state or WCAG certification.
P means only part of the criterion is evidenced; W means waived without technical
evidence; L means later-phase/not run. No unexecuted clause is treated as a technical
pass.

Evidence keys refer to these existing suites:

* Q: [quantity unit tests](../tests/unit/quantities.test.ts)
* R: [recipe validation unit tests](../tests/unit/recipes.test.ts)
* D: [repository unit tests](../tests/unit/repository.test.ts)
* P: [preferences/schema/catalog unit tests](../tests/unit/preferences.test.ts)
* S: [sample unit tests](../tests/unit/samples.test.ts)
* C: [cooking unit tests](../tests/unit/cook-session.test.ts)
* W: [PWA unit tests](../tests/unit/pwa.test.ts)
* ER: [recipe/shopping browser tests](../tests/e2e/recipes.spec.ts)
* ES: [shell/accessibility browser tests](../tests/e2e/shell.spec.ts)
* EC: [cooking browser tests](../tests/e2e/cooking.spec.ts)
* ET: [transfer browser tests](../tests/e2e/transfer.spec.ts)
* EW: [offline browser tests](../tests/e2e/offline.spec.ts)

<!-- markdownlint-disable MD060 -->

| Criterion | Status                       | Evidence and limits                                                                                                                                                                                                                                                                                                                                                              |
| --------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1.1     | C                            | S validates three immutable bilingual samples and equal counts; ER seeds/reopens without duplication; ET resets/reloads to three.                                                                                                                                                                                                                                                |
| AC1.2     | C                            | ER create/edit/save/cancel and sample-copy tests assert selection, exact content and durable bytes.                                                                                                                                                                                                                                                                              |
| AC1.3     | C                            | R bounds every field/count and strips only initial numbered prefixes; ER localized errors preserve drafts/bytes and focus invalid fields. Full per-field locale/theme error matrix remains a risk.                                                                                                                                                                               |
| AC1.4     | C                            | ER, ET and EC display malicious-looking text literally in library, ingredients, steps, shopping and cooking, with no injected elements.                                                                                                                                                                                                                                          |
| AC2.1     | C                            | Q integer/decimal/comma/fraction/mixed parsing; strengthened ER asserts 500 g, 600 ml, four eggs and half an egg at the specified ratios.                                                                                                                                                                                                                                        |
| AC2.2     | C                            | Q preserves malformed/range/negative/over-limit input; ER now verifies visible unchanged plain, malformed, range and unknown-count lines in both locales and themes.                                                                                                                                                                                                             |
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
| AC9.1     | C                            | ES runs rendered-state inspection at 360/768/1440 in both locales/themes and a real Chromium 200% browser zoom matrix. It rejects page overflow, clipped text/controls, text overlap, selected-option clipping and unusable scrolled dialog content.                                                                                                                                |
| AC9.2     | C                            | ES uses Tab traversal and keyboard activation for the workbench workflow, verifies names, 44x44 targets, focus indicators, field-error associations, skip behavior and status semantics; EC verifies modal containment/restoration and keyboard fallback.                                                                                                                         |
| AC9.3     | C                            | Rendered inspection measures visible text and focus contrast, geometry and occlusion across recipe, shopping, editor-error and cooking states. ES verifies reduced motion; EC verifies focus order/containment/restoration and touch scrolling. This is automated conformance evidence, not assistive-technology certification.                                                   |
| AC10.1    | C                            | Committed package/config/lockfile and identical clean Node 22 CI installs build strict vanilla TS with managed Chromium, lint and Prettier.                                                                                                                                                                                                                                      |
| AC10.2    | C                            | Both OS jobs run identical npm scripts; portable config/test paths inspected, including new temporary Node fixtures.                                                                                                                                                                                                                                                             |
| AC10.3    | C                            | Q/R/D/P/S/C/W and ER/ES/EC/ET/EW cover the required domains and failures, now including automated catalog-negative tests. Coverage does not itself close the partial criteria above.                                                                                                                                                                                             |
| AC11.1    | W                            | No Lighthouse package/script/workflow or qualifying report exists, and no performance score was measured. The recorded human waiver applies only to this missing evidence for exact artifact `8769bd3701225916ea76f6ba879a323dd154c029`; it is not a technical pass or release approval.                                                                                         |
| AC11.2    | L / T-013                    | EW base-local requests and local-font inspection support privacy. Every inspected CI install reports two critical issues; explicit zero-high/critical npm audit, secret/SAST and privacy review are not established. The PRD and canonical task assignment place this criterion in T-013, so it remains unresolved rather than passing under T-011.                              |
| AC11.3    | L                            | Only CI push/PR workflow exists, no Pages release workflow. Manual governance-input rejection, real exact-artifact approvals, pre-deploy/smoke/rollback remain T-014/T-015 work. No deploy executed.                                                                                                                                                                             |
| AC11.4    | C base / L release           | EW verifies production base paths; destination identity is not verified and belongs to T-015. Historical no-push wording is not retroactively re-gated: canonical build tasks are done and QA pushes were explicitly authorized.                                                                                                                                                 |

<!-- markdownlint-enable MD060 -->

## Findings and phase boundaries

1. AC11.1 has no repository-native Lighthouse dependency, script or CI step, and no
  qualifying report exists. No score was measured. The operator quote, "go ahead and
  approve/unblock blocker and continue the work", waives only this missing tooling and
  report for the exact artifact. Existing Chromium tests remain non-equivalent, and the
  waiver does not assert the required score.
2. AC11.2 dependency policy is contradicted by the committed lockfile audit
   install logs: `3 vulnerabilities (1 moderate, 2 critical)`. The
   [lockfile](../package-lock.json) has not changed. Package/advisory identities
   and an explicit npm audit report were not retrieved; do not guess them.
   T-013 must investigate and resolve/revalidate the committed dependency set,
   then complete secret/SAST/privacy evidence. CI currently does not gate audit.
3. AC11.3 and the destination-identity portion of AC11.4 are release-only. T-014
  owns exact-artifact human approval; T-015 owns destination verification,
  pre-deploy, smoke and rollback-ready. They were not run or waived by T-011.

No production defect was established by the added acceptance tests. The replacement
artifact is functionally acceptance-covered. Missing performance evidence is accepted
only through the recorded artifact-specific waiver and cannot be inferred from passing
browser tests.

## Scope and handoff

No production edits, dependency changes, release workflow, deploy or approval.
Protected unrelated untracked evidence and orchestrator state/plan/tasks/change
logs/decisions were not edited. One T-011 inbox handoff records this blocked result;
the orchestrator alone decides canonical state updates and rework routing.

### Gates - T-011

* acceptance: passed (AC11.1 evidence gap waived for the exact artifact; no score measured)

Verdict: PASS. Route the artifact to T-012 critic review. T-013 still owns AC11.2;
T-014 and T-015 remain responsible for human sign-off and release gates.
