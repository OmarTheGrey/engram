---
date: 2026-11-28
author: claude-agent
type: finding
card: E2.17
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/commands.test.ts
  - make test-one T=packages/cli/test/commands.test.ts
supersedes: none
---

**What.** On main at 526ea56a the help snapshot in packages/cli/test/commands.test.ts lacks the `hook codex` and `hook install` lines and sections card E8.17 added, so its two help tests fail on main.

**Why.** E8.17 updated help-main.txt's added list but not this literal.

**Result.** The literal is rewritten here from HELP as the registry builds it, with E8.17's lines and this card's; both tests pass.

**Consequence.** A merge of another card that fixes the same literal conflicts on it; keep the registry's HELP.
