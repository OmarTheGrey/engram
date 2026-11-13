---
date: 2026-11-13
author: claude-agent
type: decision
card: none
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0010-retention-retires.md
supersedes: none
---

**What.** A transient store delete failure keeps the item back until a rerun; a permanent refusal (`NotDeletableError`) erases it and reports the ref under `left_in_store`. Lint evidence is redacted only when it is about an erased item, names an erased id, or holds a hash no surviving item holds. ADR 0010 records both.

**Why.** Erasing the log while bytes stay in a store that may yet delete them hides an unfinished erasure; but waiting on a store that never deletes, such as an adopted memory file, never finishes. A hash a survivor holds stays readable in the survivor, so redacting by it protects nothing.

**Result.** Adoption refuses, with a deny event under `engram/adopt/erased`, a record holding the erased content left in the store; edits and other people's files adopt. The log keeps those content hashes.

**Consequence.** The person deletes `left_in_store` records by hand.
