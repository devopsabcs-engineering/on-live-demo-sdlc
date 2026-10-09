# ADR-006: Versioned, base-scoped offline application shell

Status: Accepted for v1 specification. Scope: R8, R11.

## Context

A Pages subpath requires correct worker/manifest/asset scope. Interrupted updates must not
break an existing installed app or interrupt cooking.

## Decision

Build a local manifest/icons and standalone worker with Vite base `/ai-sdlc-labs-pinch/`.
Generate the precache list from emitted assets and use a content-hash Pinch cache namespace.
Install the complete new shell before activation; retain the prior active cache on failure.
Notify of waiting updates and activate/reload only after explicit acceptance or the browser's
normal closed-client lifecycle. Clear only obsolete Pinch caches after activation.
Cache app assets only, never user documents; no third-party request interception.

## Alternatives and consequences

Origin-root paths fail on Pages; guessing hashed files fails offline. Immediate skip-waiting
can interrupt drafts/cooking. A PWA build plugin is unnecessary for this small static asset
set, but the Node helper/worker must be tested. First-ever offline visits cannot work.
Personal data clearing leaves the offline shell installed.

Validation: AC8.1-8.3, AC11.4, failed-install/update tests and base-path offline reload.
