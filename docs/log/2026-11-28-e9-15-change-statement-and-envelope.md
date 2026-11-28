---
date: 2026-11-28
author: claude-agent
type: change
card: E9.15
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/audit/report.ts
  - packages/core/src/audit/dsse.ts
  - make test-one T=packages/core/test/unit/audit/report.test.ts
supersedes: none
---

**What.** Core gains `packages/core/src/audit/`: a pure statement builder (`auditPredicate`), the in-toto Statement around it, a DSSE envelope with PAE and an injected signer, and `verifyAuditReport`, which checks envelope, signature, statement, chain, head, checkpoint and counts in order.

**Why.** Card E9.15: the artefact an auditor keeps, content-free, signed, checkable against the log offline.

**Result.** The acceptance test passes: 25 tests and 3 Postgres runs skipped under ENGRAM_PG=skip ("Tests 25 passed | 3 skipped (28)"); verify passes on the fixture log, a tampered statement fails at signature and an edited log at chain. DSSE's own PAE vector and its ECDSA P-256 envelope verify. Mutation checks, each restored: with the signature check off, the tampered statement fails at `counts` and its test fails; with the viewer filter off, the viewer's test fails.

**Consequence.** Card E9.16 adds `audit/ropa.ts` beside these files and `audit ropa` to the CLI's `audit` handler.
