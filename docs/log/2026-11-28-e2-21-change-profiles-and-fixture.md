---
date: 2026-11-28
author: claude-agent
type: change
card: E2.21
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/pi-package/profiles/twin.yaml
  - packages/pi-package/profiles/knowledge.yaml
  - fixtures/profiles/twin-reads.json
  - packages/core/test/unit/profiles/twin.test.ts
  - make test-one T=packages/core/test/unit/profiles/twin.test.ts
supersedes: none
---

**What.** `grants.expiry_cap: "on"` is set in the twin and knowledge profiles, and the twin fixture's write 4 takes its own write time.

**Why.** The lead's answer of 2026-11-25 puts the option there and nowhere else. With it on, write 4 (written at the fixture's `at`, 2026-10-25, with a grant that expired 2026-10-01) is a first write the rule refuses; the card keeps the read-side case it exists for.

**Result.** Write 4 now carries `"at": "2026-09-15T12:00:00.000Z"`, read by a new optional per-write `at` in `twin.test.ts`; it lands with a live grant inside the cap, and the reads at the fixture's `at` still find it expired. Before it the test failed for the right reason ("write 4: expected 'deny' to be 'allow'"); after it, 8 passed. No registered preset or research config sets it (`load-options.test.ts`).

**Consequence.** The expired-grant refusal on a first write has its own counterexample test instead.
