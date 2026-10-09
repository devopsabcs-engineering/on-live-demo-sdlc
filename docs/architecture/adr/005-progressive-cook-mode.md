# ADR-005: Accessible cooking with progressive capabilities

Status: Accepted for v1 specification. Scope: R4, R9.

## Context

Cooks need large steps and awake screens, but fullscreen and wake-lock support/permission
vary. Gestures must not be the only navigation method.

## Decision

Use a viewport-filling native dialog with buttons, arrows and bounded horizontal swipe.
Contain/restore focus and keep Escape/close available. Request fullscreen/wake lock where
supported and report denial/absence locally without blocking cooking. Reacquire wake lock
only when visible and still cooking; release acquired resources on close/backgrounding,
including requests that resolve after cooking ends.

## Alternatives and consequences

Mandatory fullscreen excludes browsers; fake interaction cannot guarantee an awake screen.
A custom modal adds focus-trap complexity. Native dialog plus enhancements preserves the
core job even when capabilities fail. Browser tests must cover denial, visibility and races,
not merely presence of API names.

Validation: AC4.1-4.3, AC9.2-9.3 including keyboard-only completion and vertical scroll.
