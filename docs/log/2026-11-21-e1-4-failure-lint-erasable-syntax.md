---
date: 2026-11-21
author: claude-agent
type: failure
card: E1.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - "make lint"
  - packages/core/test/property/stateful.test.ts
  - packages/core/test/unit/plane/crash-windows.test.ts
supersedes: none
---

**What.** `make lint` failed twice over on the new files: 21 TS1294 errors in stateful.test.ts and 2 TS2345 errors in crash-windows.test.ts.

**Why.** The repository's tsconfig sets `erasableSyntaxOnly`, which forbids constructor parameter properties (`constructor(readonly who: ...)`) in the command classes; and `Partial<MemoryItem>` over the union of item kinds does not spread into the unit helpers' `item()` override type.

**Result.** The command classes declare their fields and assign them in the constructor; the item builders take `Parameters<typeof item>[1]`. `make lint` passes: biome, both tsc projects, ruff, mypy (66 source files).

**Consequence.** Nothing beyond the fix; vitest ran the files before tsc caught them, so tsc goes before the tests next time.
