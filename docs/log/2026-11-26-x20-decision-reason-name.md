---
date: 2026-11-26
author: claude-agent
type: decision
card: X20
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/model/cassette.ts
supersedes: none
---

**What.** The new exclusion reason is named `answer refused`, beside `turn limit`, as one `Exclusion` type every probe's `excluded` field and summary use.

**Why.** The card leaves the name open. It reads as what happened (the provider refused the answer call), it is distinct from GateMem's own `refuse` action and MEM-INV-Bench's REFUSED verdict by its second word, and h1.py counts reasons by their string, so it needs no table change.

**Result.** The same string reaches results.jsonl, summary.json's `excluded`, and the H1 row's `exclusion`.

**Consequence.** If wrong, a rename is one constant before the tag; after the tag it would be an amendment.
