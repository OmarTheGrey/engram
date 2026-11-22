---
date: 2026-11-21
author: claude-agent
type: finding
card: E8.13
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - pnpm-lock.yaml
supersedes: none
---

**What.** Adding `@opentelemetry/api` 1.10.0 to the workspace changes vitest's lock entry: vitest 5.0.5 declares the api as an optional peer, so its resolved key in `pnpm-lock.yaml` now names `@opentelemetry/api@1.10.0`.

**Why.** Seen in the lockfile diff of the dependency commit.

**Result.** No version changes; vitest does not trace unless configured to. The root importer's vitest line differs, so a parallel branch that edits the lockfile may conflict there.

**Consequence.** At a lockfile conflict, keep the key with the api peer and run `pnpm install`.
