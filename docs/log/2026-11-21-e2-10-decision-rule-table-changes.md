---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.10
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/injection-screen.ts
  - docs/absorbed.md
supersedes: none
---

**What.** From Remnic, the card's families were taken and its tool-invocation, conditional-trigger, response-control and tool-routing rules left out with its tool names and CANARY terms; imperative-to-agent lost the full stop, the hyphen and a bare "to"; OWASP's "you are now" targets gained word boundaries, and its role-line's leading `\s*` became `[ \t]*`.

**Why.** "The model. Use", "model-run" and "the model to use" are prose; "you are now in the danger zone" matched "dan"; the leading `\s*` took 9.5 s on 100,000 newlines in the timeout test when restored.

**Result.** Every change was made reading the sources, before the corpus run, and none targets a corpus entry.

**Consequence.** Recall on Remnic's own dropped families is lost; card X14 can show whether it matters.
