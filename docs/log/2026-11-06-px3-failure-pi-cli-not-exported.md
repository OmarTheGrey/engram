---
date: 2026-11-06
author: shady
type: failure
card: PX3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/pi-package/test/install.test.ts
supersedes: none
---

**What.** The first acceptance test run failed before any test: `require.resolve` of `@earendil-works/pi-coding-agent/package.json`, then of the package itself, threw `ERR_PACKAGE_PATH_NOT_EXPORTED`.

**Why.** Pi 1.3.0's `exports` map is ESM only and exposes neither `package.json` nor `dist/cli.js`.

**Result.** The test runs `dist/cli.js` through the package's own `node_modules` link to the pinned pi; the suite then ran.

**Consequence.** The test depends on pnpm linking the devDependency into `packages/pi-package/node_modules`, which the workspace always does.
