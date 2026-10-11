---
title: Deployment and rollback
description: Governed GitHub Pages release and recovery procedure for Pinch
---

Pinch is deployed to GitHub Pages by `.github/workflows/pages.yml`. The workflow requires
`governance_approved=true`, reruns the release quality suite, builds for the repository path,
uploads an immutable Pages artifact and deploys through `actions/deploy-pages`.

## Deploy

1. Obtain Product Owner, Security Team and Tech Lead approval for a pinned commit and tree.
2. Confirm the approved tree matches the tree on `main`.
3. Confirm GitHub Pages uses the GitHub Actions workflow source.
4. Dispatch `.github/workflows/pages.yml` from `main` with
   `governance_approved=true`.
5. Verify HTTP 200, manifest and service-worker scope, repository-prefixed assets, no
   third-party requests, zero browser errors and an offline reload.

## Rollback

Roll back when the site is unavailable, a core flow is broken, offline startup regresses, an
unexpected third-party request appears or browser errors cannot be corrected immediately.

For later releases, restore application content from the previous known-good release commit in
a rollback branch, merge it through a reviewed pull request and dispatch the governed workflow
again. Preserve `.github/workflows/pages.yml` so the rollback uses the same immutable artifact
path, then repeat every production smoke check.

The initial release has no prior production artifact. Its rollback is to disable GitHub Pages
after explicit production-impact approval, preserving the failed workflow and smoke evidence for
diagnosis. Do not deploy or roll back with a `gh-pages` branch or a manual artifact upload.
