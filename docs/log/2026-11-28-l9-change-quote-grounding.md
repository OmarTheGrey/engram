---
date: 2026-11-28
author: claude-agent
type: change
card: L9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/lint/evidence.ts
  - packages/core/src/lint/model.ts
  - packages/core/test/unit/lint/evidence.test.ts
  - "make test-one T=packages/core/test/unit/lint/evidence.test.ts"
supersedes: none
---

**What.** Quote grounding for the contradiction and unsupported-claim lints: `lint/evidence.ts` (a port of obsidian-second-brain's `verify_quotes.py`: exact after NFC and whitespace folding, at least 12 characters) and, in `lint/model.ts`, grounded prompts, schemas and a token limit used only when `lints.model.evidence` is "on".

**Why.** Card L9: H3's model tier is weakest on precision, and a quote check is deterministic and cheap.

**Result.** A grounded flag whose every quote is in its item is a finding whose evidence adds `quote of <id>: "<quote>"` lines; a flag with a quote missing, short or not found is the judgment `ungrounded`, no finding, no event. Absent or "off", requests, judgments and findings are byte for byte as before (tested). `evidence.test.ts`: 24 passed. Mutants killed: the not-found branch removed (5 tests fail), grounding forced on (9 fail across `evidence.test.ts` and `model.test.ts`).

**Consequence.** Card R-126's deterministic sibling for unsupported claims can build on `checkQuote`.
