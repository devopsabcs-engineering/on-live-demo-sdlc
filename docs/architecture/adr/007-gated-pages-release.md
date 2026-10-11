# ADR-007: Verified Pages destination and gated release

Status: Accepted for v1 release.
Scope: R11.

## Context

The original brief specified `https://devopsabcs-engineering.github.io/ai-sdlc-labs-pinch/`,
but the operator authorized production deployment from the verified remote
`devopsabcs-engineering/on-live-demo-sdlc`. GitHub Pages project sites must use the repository
name as their base path.

## Decision

Deploy to `https://devopsabcs-engineering.github.io/on-live-demo-sdlc/` with Vite base
`/on-live-demo-sdlc/`. Revise all base, manifest, worker and browser tests with the contract.
The release workflow is manual-only and requires `governance_approved`, the approved commit SHA
and the approved Git tree SHA. It runs only from `main`, verifies both identifiers before build,
and requires real Product Owner, Security Team and Tech Lead approval with pre-deploy, smoke and
rollback-ready gates. Inputs alone are not governance evidence. No self-populated approvers.

## Alternatives and consequences

Keeping the reference repository path would produce broken project-site URLs in this repository.
Using a custom domain would add unrelated DNS and certificate operations. Rollback redeploys the
last approved complete tree with a new cache identity; offline clients may not update immediately.

Validation: AC11.3-11.4, exact-pin workflow checks and production smoke evidence.
