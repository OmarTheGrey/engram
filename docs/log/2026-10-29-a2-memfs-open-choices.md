---
date: 2026-10-29
author: claude-agent
type: decision
card: A2
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0028-letta-adapter-over-memfs.md
  - packages/adapters/src/letta/index.ts
  - packages/adapters/src/lock.ts
supersedes: none
---

**What.** Card A2 settled the Letta adapter choices ADR 0028 left open, recorded in its amendment list: async open with a separate setup commit, an LF-only item file with CR or lone-surrogate content stored as JSON and every write parsed back, pathspec commits after `git add --force`, a per-part identity fallback, `engram/<lowercase UUID>.md` keys only, the lock in the git directory, scan search, history from raw blobs, and doctor's one direct delete.

**Why.** Each could have gone another way; the amendments give the reason for each.

**Result.** The files adapter's lock moved to `packages/adapters/src/lock.ts`, shared by both file-backed stores, and its 53 tests still pass (`pnpm --filter adapters exec vitest run test/files`).

**Consequence.** The lead reviews the amendments with ADR 0028; reversing one costs a change confined to `packages/adapters/src/letta/`.
