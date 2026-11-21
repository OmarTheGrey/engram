---
date: 2026-11-21
author: claude-agent
type: failure
card: D1
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/runner/test/session-shapes.test.ts
supersedes: none
---

**What.** An edit made through `python -I -c` wrote a literal newline into a TypeScript string in `session-shapes.test.ts`, where `"\n"` was meant. A second inline script printed an escape warning for `\d`.

**Why.** A backslash escape inside a double-quoted shell argument passes through two quoting layers, bash and Python. The second warning was harmless: the regular expression came out right.

**Result.** The string was repaired by a second edit before any test ran. The 43 shape tests pass.

**Consequence.** Multi-line or backslash-heavy edits go in a script file first, as the agent brief advises.
