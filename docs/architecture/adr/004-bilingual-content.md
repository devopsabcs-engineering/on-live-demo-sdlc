# ADR-004: Equal catalogs and verbatim authored content

Status: Accepted for v1 specification. Scope: R1, R6.

## Context

EN and FR must be complete, including dynamic states and samples, without implying recipe
translation or depending on runtime network services.

## Decision

Use typed local EN/FR catalogs with matching leaf keys and interpolation tokens; fail build
on parity/reference/empty-string errors. Store bilingual samples as immutable variants
sharing amounts and step counts. Editing a sample creates a user recipe in the current
language. User recipes and shopping snapshots remain verbatim across language changes.
Use document `lang` and locale-aware numbers, not translated display strings as data.

## Alternatives and consequences

Silent English fallback hides defects. Machine translation violates offline/privacy scope.
Translating saved shopping rows changes their identity. Explicit language-independent
catalog completeness costs tests but guarantees equal UI coverage; different-language
ingredient names do not auto-merge.

Validation: AC1.1-1.2 and AC6.1-6.3, including removed-key build failure.
