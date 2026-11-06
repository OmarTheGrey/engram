---
date: 2026-11-06
author: shady
type: failure
card: PX3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - "pnpm install --offline"
supersedes: none
---

**What.** `pnpm install --offline`, run to link the new package without the network, failed with `ERR_PNPM_NO_OFFLINE_META` for `@earendil-works/pi-coding-agent@1.3.0`.

**Why.** The local pnpm metadata cache had no entry for the package, so offline resolution could not confirm the pinned version already in the lockfile.

**Result.** A plain `pnpm install` resolved it from the store with nothing downloaded; `pnpm-lock.yaml` gained only the `packages/pi-package` importer.

**Consequence.** Nothing; no new dependency entered the lockfile.
