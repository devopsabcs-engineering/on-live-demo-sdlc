# ADR-002: Source-preserving quantities and dimensional US units

Status: Accepted for v1 specification. Scope: R2-R3, R5.

## Context

Repeated scaling/conversion must not drift. A cup cannot become grams without density,
and rounded shopping displays are not safe arithmetic inputs.

## Decision

Store original numeric quantities, canonical known units and raw text. Scale from base servings
(integer 1-24), convert only within mass/volume using exact US customary factors, and round only
for presentation. Metric outputs g/ml; imperial outputs oz/cup. Recognize documented aliases,
preserve unsupported lines and unknown suffixes, and use the architecture's fractional policy.
Shopping snapshots sum full-precision quantities only for identical normalized names and units.
No cross-language synonym inference or unlike-unit merging.

## Alternatives and consequences

Mutating displayed values causes cumulative loss; guessing density is misleading.
Universal unit normalization for shopping would obscure the user's selected units.
Bounded servings/data and deterministic formatting simplify tests but are explicit v1 limits.
Very small positive quantities use localized less-than notation, never false zero.

Validation: AC2.1-2.4, AC3.1-3.2, AC5.1-5.3 with floating-point tolerance 1e-10.
