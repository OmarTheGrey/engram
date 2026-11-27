---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15a
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/registry.ts
supersedes: none
---

**What.** Files outside the card's list that E8.15a changed, and why: doctor.ts, hook.ts, key.ts, log.ts, mcp.ts and serve.ts parse with the registry's OPTIONS instead of their own option objects; format.ts gained the new commands' output functions; test/helpers.ts gained `blind`; scripts/refresh-help-main.ts is new.

**Why.** The card says the handlers' option objects are read from the registry, and those six files held handlers; the output functions belong with the CLI's other formatters; `blind` is shared by two test files.

**Result.** Each existing handler parses the same config as on main: the review captured parseArgs' configs old and new and found them identical.

**Consequence.** None.
