---
date: 2026-10-29
author: claude-agent
type: decision
card: E2.5
chapter: design
pillar: plane
hypothesis: H1
evidence:
  - packages/core/test/property/invariants.test.ts
  - packages/core/test/property/oracle.ts
  - packages/core/test/unit/oracle.test.ts
  - docs/conventions/testing.md
  - "make test-invariants"
supersedes: docs/log/2026-10-29-e2-5-invariants-review-fix.md
---

**What.** Invariant 2's promotion oracle and generator follow the verification of review P5.

**Why.** The verifier found the oracle encoded the same decisions as core, so it accepted a grantee's promotion (P5-15), hidden payloads (P5-14) and confirmers as reviewers (P5-16). No guard caught the loss of the confirmer-status rule (P5-17).

**Result.** The oracle requires source-scope membership (or the owner in the owner's person scope), refuses hidden text with its own code point check, compares content by whitespace only, and excludes confirmers as reviewers. The generator adds live read grants on sources, tag-character payloads, restatements by the item's own author and more retired confirmers. Guards require refusals by a grant, hidden text, a confirmer reviewer and retired confirmers alone. `make test-invariants`: 5 passed.

**Consequence.** Second reviewer: the reviewer of review P5 (its Verification section), then the lead.
