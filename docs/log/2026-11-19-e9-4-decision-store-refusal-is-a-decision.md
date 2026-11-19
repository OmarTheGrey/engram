---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/grants.ts
  - packages/adapters/test/plane/grants-files.test.ts
supersedes: none
---

**What.** When the store refuses for good to rewrite a record (`NotDeletableError`), a grant change returns a deny decision with its event (`engram/write/store-failure`) instead of throwing; a transient store failure still appends the deny event and rethrows, as a write does.

**Why.** The files adapter holds every Claude Code memory file read-only, so on the dogfood's store this is the common case, and a thrown error would reach the inspector as an HTTP 500 saying only "internal error". Offboarding already treats the same refusal as permanent.

**Result.** The editor shows the store's refusal as the plane's decision with its reason; the item and the file are unchanged (`packages/adapters/test/plane/grants-files.test.ts`).

**Consequence.** None beyond the finding that Claude Code's own memories cannot be granted yet.
