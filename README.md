---
title: AI-SDLC practice
description: Pinch local development, offline installation, and production specification
---

## Production application

Use Node 22 LTS and the committed lockfile:

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/ai-sdlc-labs-pinch/`. Development does not register a
service worker. To exercise the installable production build:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Open `http://127.0.0.1:4173/ai-sdlc-labs-pinch/` online and wait for the offline-ready
status before disconnecting. Supported Chromium offers installation through its
browser menu; installation UI varies by browser. Use HTTPS outside localhost.
The build generates a local standalone manifest, 192/512 PNG icons and a worker
that caches the actual emitted files within this base path. First-ever offline
visits cannot install Pinch. Recipe data stays on this device; export JSON for backup.

Updates wait while the current app remains open. Choose **Update Pinch** and confirm
the reload when ready; unsaved editor drafts and cooking progress are lost on reload.
Cancel to finish first. Failed installations retain the previous offline shell.
Clearing Pinch data leaves the offline shell and other applications' data intact.
To remove the installed shell for development, unregister this base's worker and
delete only its `pinch-shell-_ai-sdlc-labs-pinch_-` caches in browser developer tools.

Run `npm run lint`, `npm run test:unit`, and `npm run check:i18n` for local gates.
After `npx playwright install chromium`, `npm run test:e2e` builds and tests the
production site, including Chromium installability, offline local flows, failed
updates and explicit activation. CI runs the same scripts with Node 22 on Ubuntu
and Windows. No deployment is performed by these commands.

## Pinch design prototype

Open [`prototype/index.html`](prototype/index.html) directly in a browser. No package install,
build step, server or network connection is needed. Switch between English/French and
light/dark using the header controls.

Select a sample, change servings or units, edit/create a recipe, add ingredients to the shopping
list, tick/clear items, and open cook mode. Use left/right arrow keys to change cooking steps
and Escape to close the dialog. Recipes and shopping data are session-only; language and
theme preferences are remembered where browser storage permits.

This is a disposable **Plan-phase UX spike**, not the production application. It has no PWA,
wake lock, swipe navigation, durable recipe/list storage or JSON import/export.
See [design direction](docs/design.md) and [prototype review](docs/prototype-review.md).
The browser-review gate is **blocked** because Playwright MCP was unavailable in the authoring
session; static checks are not a substitute for browser evidence.

## Production specification

The [PRD](docs/product/prd.md) defines numbered requirements and acceptance criteria.
The [architecture](docs/architecture/overview.md) includes data/module contracts, binding
ADRs and the seven build slices T-004-T-010.
The [spec review](docs/architecture/spec-review.md) records the documentation gate.
Production build slices are implemented on `feature/pinch`; release remains subject
to independent review, quality gates and mandatory human sign-off.
The supplied GitHub Pages destination must also be verified before any future release.
