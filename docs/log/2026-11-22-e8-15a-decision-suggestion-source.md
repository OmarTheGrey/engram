---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15a
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/registry.ts
  - packages/cli/src/run.ts
supersedes: docs/log/2026-11-22-e8-15a-decision-did-you-mean-distance.md
---

**What.** A flag suggestion is drawn from the subcommand's own flags (`suggestionFlags`), and on a tie a flag that begins with what was typed wins; distance stays optimal string alignment, at most 2 and less than the length typed.

**Why.** Review finding E8.15a-6: `grants --ad` suggested `--as`, and `key list --expire` suggested key create's `--expires`.

**Result.** `grants --ad` now suggests `--add`, `key list --expire` nothing, `key create --expire` `--expires`; all three pinned. `run` picks the suggestion, the parse error carries only the flag typed.

**Consequence.** None.
