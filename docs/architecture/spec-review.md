# T-003 spec-review

Run: `2026-10-09-pinch-plan`. Task owner/reviewer role: `ait-architect`, applying
`ait-tech-specs` and `ait-quality-gates` inline. This is the documented Plan-phase gate,
not QA, critic review, security approval or browser verification.

## Method and existing criteria

No production package, build scripts or CI checks exist in this repository yet. The
`ait-tech-specs` contract permits documented review criteria for `spec-review`; no tool
was installed or invented to manufacture an executable gate. Review the PRD and architecture
against the existing brief, design journeys/accessibility criteria and prototype findings:

1. Completeness: all brief scope/non-functional/delivery constraints have numbered,
   testable ACs; initial/error/reset states and operations are specified.
2. Consistency: product acceptance, dimensional arithmetic, bilingual content, local data
   schema, import/export and browser capability behavior agree.
3. Feasibility: static vanilla stack, bounded local data, offline lifecycle and portable
   scripts need no server, density inference or unavailable browser capability.
4. Traceability: each binding decision has an ADR; each build slice has AC references,
   valid dependencies, an owner/phase and explicit required gates.
5. Governance: prototype blocker, absent tooling, destination mismatch and pending approval
   remain visible. Only T-003 executes; T-004-T-010 remain pending.

The numbered checklist is the gate procedure. Structural assertions and whitespace/link
checks below support it; they do not substitute for semantic review.

## Attempt 1 - FAIL

The first documented review found two blocking specification ambiguities:

| Finding | Criterion | Smallest fix |
|---|---|---|
| F1: First-use/reset unit preference was unspecified; the default-document interface was incomplete | Completeness/consistency | Specify metric units, system theme, locale rule, empty user data and first selected sample in AC6.2 and architecture |
| F2: AC7.3 required rejecting "bad references" although the snapshot schema contains no relationship references | Consistency/testability | Replace with the actual invariant: imported raw and parsed ingredient representations must agree |

No executable command failed for these findings: this is a documented content review.
T-003 remained in progress, `spec-review` was recorded failed, and `retries` incremented to 1.
Both findings were fixed before attempt 2. Fraction glyph input names were also made explicit.

## Attempt 2 - PASS

| Review area | Evidence | Result |
|---|---|---|
| Product coverage | PRD R1-R11, 36 uniquely numbered ACs cover all nine functional brief items, stack/testing, privacy, performance and delivery | Passed |
| Initial/invalid/empty states | AC1.1-1.4, AC2.2-2.4, AC4.3, AC5.3, corrected AC6.2, AC7.1-7.4; explicit default document and typed errors | Passed |
| Quantity consistency | ADR-002 and architecture define original quantities, US factors, alias boundaries, no density conversion, precision/rounding and merge identity | Passed |
| Data/transfer contract | ADR-003, exact version-1 schema, limits, raw/parsed validation, atomic replacement, explicit failed writes, raw recovery and Pinch-only clearing; corrected AC7.3 | Passed |
| Localization/content | ADR-004 and AC6.1-6.3 define catalog/token parity, locale numbers and verbatim authored/snapshot text | Passed |
| Browser/a11y | ADR-005, AC4 and AC9 define keyboard/focus/gesture behavior, capability denial and wake-lock races; no support assumptions | Passed |
| Offline/updates | ADR-006, AC8 and architecture define base-scoped emitted assets, complete install, old-cache retention and explicit activation | Passed |
| Binding decisions | Seven linked ADRs, each with context, one decision, alternatives/consequences and AC references | Passed |
| Build decomposition | PRD and canonical state agree on seven single slices, serial shared-file dependencies, all five required gates and pending results | Passed |
| Portability/quality | R10, planned project gate definitions and two-real-OS evidence requirement; missing future tooling cannot be called passed | Passed |
| Performance/privacy | AC11.1 fixes profile/threshold/evidence; AC11.2 assigns later security checks without claiming they ran | Passed |
| Scope/governance | T-002 remains blocked; T-004 depends on T-002/T-003; no sign-off, push or deploy; ADR-007 holds release on target verification | Passed |

Supplemental structural checks verified R1-R11, 36 unique AC IDs, seven ADRs, valid local
document links, ordered T-001-T-010, backward-only dependencies, required-gate/result
coverage and no execution of build slices. Whitespace checks passed.
An initial supplemental link-check probe mishandled absolute filesystem paths; correcting
the probe resolved it without changing document content. This was not a product gate result.

### Gates - T-003
- spec-review: passed (documented completeness, consistency, feasibility and traceability review after F1/F2 fixes)
Verdict: PASS

T-003 may be done; the **run remains blocked** by T-002. Build, lint, unit,
i18n-parity, portable-os, acceptance, critic, security and deployment gates were not run
by this task. Human sign-off remains pending. No tooling-absence waiver was recorded.
