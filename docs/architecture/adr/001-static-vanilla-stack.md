# ADR-001: Static vanilla TypeScript with portable tooling

Status: Accepted for v1 specification. Scope: R9-R11.

## Context

The brief mandates Vite/TypeScript without a framework or server, and reproducible Linux and
Windows tooling. The prototype is an intentionally disposable inline HTML experiment.

## Decision

Build a separate vanilla DOM application with pure domain modules, CSS-variable themes,
Node 22 LTS, npm lockfile, Vitest, managed Playwright Chromium, ESLint and Prettier.
Use Node/tool CLI npm scripts and a two-OS CI matrix. Require `i18n-parity` and `portable-os`
on every build slice; T-004 establishes them and both OS results are mandatory.

## Alternatives and consequences

Reusing the prototype would couple unvalidated spike code to persistence. A framework/server
adds unnecessary dependencies and hosting. Vanilla DOM requires deliberate focus/state
management and tests. CI evidence is not available merely because a local command passes.
No backend specialist or runtime service is needed; scripts must not hard-code OS paths.

Validation: AC9.1-9.3, AC10.1-10.3 and the architecture's gate contracts.
