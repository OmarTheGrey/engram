---
date: 2026-11-22
author: claude-agent
type: finding
card: E8.15a
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/registry.ts
  - packages/cli/test/registry.test.ts
supersedes: docs/log/2026-11-22-e8-15a-finding-toString.md
---

**What.** The command table had a prototype, so every name Object has answered differently from an unknown command; the registry's table has none.

**Why.** The earlier entry named only `toString`; the review's old-against-new run found six names.

**Result.** Before: `toString` and `constructor` returned a non-number as the exit code; `__proto__`, `hasOwnProperty`, `valueOf` and `isPrototypeOf` exited 1 with a TypeError; `toString --help` printed HELP with exit 0. Now each of the six, with and without `--help`, exits 2 with `engram: unknown command "<name>"; engram --help lists them`, pinned in the registry test; mutant M4 fails it.

**Consequence.** The one output change outside docs/design/tui.md 12.2; PR.md lists it.
