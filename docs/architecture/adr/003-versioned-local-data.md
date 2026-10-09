# ADR-003: One local document and confirmed JSON replacement

Status: Accepted for v1 specification. Scope: R1, R5, R7.

## Context

The brief requires localStorage, durable recipes/list, JSON transfer and clear-all without
accounts. Storage is fallible; import must not partially replace good data.

## Decision

Use `pinch:v1:document` with schema version 1, user recipes, shopping and preferences.
Keep bundled samples in code and editor/cooking/selection ephemeral. Validate full documents
with explicit limits and exact properties before a single storage write; update durable UI
only after write success. Import is confirmed replacement; clear removes only Pinch's key.
Retain corrupt/unknown-version bytes for raw recovery; do not silently reset or migrate.
Clearly label temporary operation if reads are unavailable. Detect cross-tab changes but
disclose that concurrent editing is unsupported; localStorage has no atomic compare-and-swap.

## Alternatives and consequences

Separate keys risk partial import; IndexedDB conflicts with the supplied localStorage brief.
Implicit merge complicates identity/duplicate handling. One bounded document is simple but
limited by quota and concurrent writers. Export remains the user's backup; no cross-device
recovery is promised. Imported strings are text and never executable markup.

Validation: AC1.1-1.4, AC5.3, AC7.1-7.4, quota/corruption/conflict negative-path tests.
