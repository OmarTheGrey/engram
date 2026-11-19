---
date: 2026-11-19
author: claude-agent
type: failure
card: L2
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/faults/generate.ts
  - "pnpm exec tsc -p tsconfig.json"
supersedes: none
---

**What.** The generator passed its tests but failed `tsc`: an injected item typed as a partial `MemoryItem` could take a `procedural` class with string content, which the schema's union forbids.

**Why.** Vitest strips types, so only the type check saw it; the generator only ever writes episodic and semantic items.

**Result.** Injected items are typed as the episodic and semantic arm of the union (`Knowledge`), and the write ops as their own type, with no cast left.

**Consequence.** None for the set's bytes; the type check is part of the gates.
