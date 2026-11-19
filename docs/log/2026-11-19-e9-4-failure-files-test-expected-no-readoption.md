---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.4
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/adapters/test/plane/grants-files.test.ts
  - "pnpm exec vitest run packages/adapters/test/plane/grants-files.test.ts"
supersedes: none
---

**What.** The first run of the files-adapter grant test failed: the adoption after a grant change reported `allowed: 1` where the test expected no event.

**Why.** The test assumed that adoption leaves an item the plane wrote alone; it re-adopts such an item once as `import`, whatever its grants (the finding of the same day, `2026-11-19-e9-4-finding-plane-writes-readopted-as-import.md`).

**Result.** A probe without any grant change reproduced it, so the grant operation was not the cause. The test now runs that one adoption in its setup and asserts that the adoption after the grant change appends nothing and the grant stands; both tests pass, and skipping the store rewrite makes both fail.

**Consequence.** The finding goes to the lead; the grant operation is unchanged.
