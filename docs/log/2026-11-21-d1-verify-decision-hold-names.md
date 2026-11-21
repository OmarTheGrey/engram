---
date: 2026-11-21
author: claude-agent
type: decision
card: D1
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/distill/scrub.ts
  - packages/core/test/unit/distill/scrub.test.ts
supersedes: docs/log/2026-11-21-d1-review-decision-hold-names.md
---

**What.** Names that are long by design (tool, model, custom type, stop reason) are checked without the 32-character rule, as before. They are now also checked with underscores read as word boundaries. A key glued on by underscores, such as `mcp__x__sk-...`, is held.

**Why.** The verifier found the glued key passing. The superseded entry had recorded that as a known limit.

**Result.** The test "long tool names and model ids are not held, but a key in one is" now expects `mcp__x__sk-...` to be held. A long MCP tool name and a long model id still pass.

**Consequence.** A real tool name with a piece such as `sk-something` of eight or more characters after an underscore is held. That costs one session's recording, never a leak. A hold still leaves no event; the backlog row stands.
