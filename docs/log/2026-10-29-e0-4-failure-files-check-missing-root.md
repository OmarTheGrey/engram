---
date: 2026-10-29
author: claude-agent
type: failure
card: E0.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/doctor.ts
  - packages/cli/test/doctor.test.ts
  - "pnpm exec vitest run packages/cli/test/doctor.test.ts"
supersedes: none
---

**What.** The first doctor check for the files adapter passed on a store root that does not exist.

**Why.** The files adapter lists a missing folder as an empty store, so adoption through the plane reported 0 memories and the check said ok. The red test "store and adapter files: a root that does not exist fails both" caught it on its first run.

**Result.** The check now fails with "<root> does not exist" before it builds the adapter; the test passes. The adapter is unchanged, since an empty or absent memory folder is a valid store for `engram read`.

**Consequence.** Nothing further; the store check and the adapter check now agree on a missing root.
