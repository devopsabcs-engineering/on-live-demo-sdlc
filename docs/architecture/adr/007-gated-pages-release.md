# ADR-007: Supplied Pages base with a release identity hold

Status: Accepted for v1 specification; destination verification is a release prerequisite.
Scope: R11.

## Context

The brief specifies `https://devopsabcs-engineering.github.io/ai-sdlc-labs-pinch/`.
This checkout is `emmanuelknafo/on-live-demo-sdlc`. Silent substitution would produce the wrong
base or deploy to the wrong repository. T-003 permits commit only, not push or deploy.

## Decision

Preserve the brief's base in the production contract; do not provision/deploy either target
until owner/repository/permissions are explicitly verified. If the target changes, revise this
ADR and all base/manifest/worker tests before release. A future release workflow is manual-only,
requires boolean `governance_approved` and real approval by Product Owner, Security Team and
Tech Lead of the exact artifact, with pre-deploy, smoke and rollback-ready gates.
The input alone is not governance evidence. No self-populated approvers.

## Alternatives and consequences

Using the current checkout name automatically contradicts the supplied brief. Deploying to
the supplied URL without verification risks wrong-target publication. A release hold keeps
build feasible without pretending the mismatch is resolved. Rollback uses the last approved
immutable shell with a new cache identity; offline clients may not update immediately.

Validation: AC11.3-11.4 at future release; T-003 retains pending sign-off and no push/deploy.
