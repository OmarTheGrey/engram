---
date: 2026-11-21
author: claude-agent
type: failure
card: E1.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/log/chain.ts
  - packages/core/test/unit/log/drift.test.ts
supersedes: none
---

**What.** Writing the drift test's edits showed the skeleton would throw on an event whose item was edited into a string, before any run.

**Why.** The skeleton destructured item.provenance without checking the item was an object, so a tampered body would have crashed the verifier instead of being reported.

**Result.** The skeleton and committedParts now treat only an object as an item and hash anything else as it is; the drift test passes.

**Consequence.** The verifier reports malformed bodies as broken links.
