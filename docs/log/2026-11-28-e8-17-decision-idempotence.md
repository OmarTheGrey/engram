---
date: 2026-11-28
author: claude-agent
type: decision
card: E8.17
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/hook-install.ts
  - packages/cli/test/hook-install.test.ts
supersedes: none
---

**What.** The installer compares the merged settings with the file's JSON structurally and writes nothing, a backup included, when they are equal; a backup is named by the old content's sha256 prefix and never overwritten with other bytes.

**Why.** The card: a second run changes nothing and it backs up what it edits; no clock may name a backup deterministically.

**Result.** A reformatted but equal file is left alone; two installs with different flags leave two backups, one per earlier content.

**Consequence.** Backups accumulate, one per distinct earlier file; the user removes them.
