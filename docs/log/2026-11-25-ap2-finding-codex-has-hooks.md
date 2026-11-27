---
date: 2026-11-25
author: claude-agent
type: finding
card: none
chapter: design
pillar: govern
hypothesis: H4
evidence:
  - docs/decisions/0022-other-harnesses-through-mcp.md
  - gh api repos/openai/codex/git/trees/main?recursive=1
supersedes: none
---

**What.** ADR 0022's premise that Codex has no hook is wrong now: Codex ships hooks with generated schemas.

**Why.** Card E8.17 was checked against Codex's source before it was planned.

**Result.** At `openai/codex` `ebd0765aafa2` (Apache-2.0), `codex-rs/hooks/schema/generated/` holds `pre-tool-use.command.input.schema.json` and its output schema among others. ADR 0022 says store commands on Codex's path are not blocked because Codex has no hook.

**Consequence.** Card E8.17 adds the hook and amends ADR 0022; H4's harness claim stays untested (item 25).
