---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/secrets.ts
  - packages/core/test/unit/policy/secrets-upstream.test.ts
supersedes: docs/log/2026-11-21-e2-9-decision-aws-example.md
---

**What.** AWS's example key id (`...EXAMPLE`) is allowed by the key id rule; its example secret key (`...EXAMPLEKEY`) only by the bare high-entropy rule.

**Why.** The superseded entry said two walrus vectors on the example secret had to end EXAMPLEKEz. They did not: `AWS_SECRET_ACCESS_KEY=...EXAMPLEKEY` is found by the keyed AWS secret rule and "my AWS secret access key is ...EXAMPLEKEY" by the label rule, so the port now uses walrus' own text (V-4).

**Result.** Tests pin both skips and that a made-up key is found.

**Consequence.** Any key id ending EXAMPLE passes; listed in the result's limits.
