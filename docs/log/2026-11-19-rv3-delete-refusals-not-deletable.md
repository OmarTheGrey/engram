---
date: 2026-11-19
author: claude-agent
type: change
card: RV3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/src/files/index.ts
  - packages/adapters/src/letta/index.ts
  - packages/adapters/test/files/rv3.test.ts
  - packages/adapters/test/letta/rv3.test.ts
supersedes: none
---

**What.** Every permanent delete refusal of the files and Letta adapters is now a `NotDeletableError` (review finding RV-ADP-5): the files adapter's `UnsafeKeyError` and new `UnreadableItemError`, and the Letta adapter's `UnsafeLettaPathError` and `NotMemfsRepositoryError`.

**Why.** Offboarding takes any other error as transient and keeps the item back on every rerun. The reviewer's probe `delrefuse.mts` found an Engram file with broken frontmatter (a plain `Error`), a hard-linked file and a bad key (`UnsafeKeyError`) all refused as transient.

**Result.** One test per case asserts `isNotDeletable`: broken frontmatter, hard link, bad key, a copy under another name and the Claude Code control in the files adapter; hard link, bad key and an unopenable folder through the deferred adapter in Letta, with `RepositoryBusyError` still transient. Making each class a plain `Error` again (mutants R5a to R5d) fails its tests.

**Consequence.** Offboarding reports such records under `left_in_store`. The backlog row "Letta delete refusals" is closed.
