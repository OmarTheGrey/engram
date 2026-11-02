---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - docs/log/2026-11-02-x1r-c4-engram-verdict.md
supersedes: none
---

**What.** Two entries of the first fix pass overrode earlier entries without `supersedes`: the engram verdict one (over the RAG-Policy verdict decision) and the agent-note one (over the full case set's line on recorded notes).

**Why.** Overriding was treated as adding.

**Result.** Both now name the entry they supersede.

**Consequence.** Found by the second review of PR #25 and fixed in its round-2 fix pass.
