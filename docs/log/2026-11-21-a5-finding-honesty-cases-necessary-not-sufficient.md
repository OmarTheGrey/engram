---
date: 2026-11-21
author: claude-agent
type: finding
card: A5
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/conformance/suite.ts
  - packages/adapters/src/files/index.ts
supersedes: none
---

**What.** The `native_validity` honesty cases are necessary conditions only: every current adapter would pass them if it claimed the flag.

**Why.** To know whether the cases separate a store that does validity natively from one that only stores the plane's fields.

**Result.** A throwaway probe (not committed) ran the four cases on each registered adapter with the flag forced on: fake, Mem0, files and Letta passed every case they ran (Mem0, files and the fake without history skip the history case). Each stores the whole item, so the window survives. The files adapter would still fail on a folder of Claude Code files without Engram metadata, whose `valid_from` it derives from the modification time.

**Consequence.** "Native" is not observable through the contract without an as-of argument, which ADR 0031 and 0035 keep out; the ADR 0013 amendment says so.
