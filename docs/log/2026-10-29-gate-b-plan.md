---
date: 2026-10-29
author: claude-orchestrator
type: decision
card: none
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/gate-b-plan.md
  - docs/decisions/0027-http-contract-client-and-inspector.md
  - docs/decisions/0028-letta-adapter-over-memfs.md
  - docs/decisions/0029-poisoning-arm-mem-inv-bench.md
supersedes: none
---

**What.** The lead asked for a plan that finishes Gate B's engineering in at most six PRs and for its execution; the orchestrating session wrote `docs/tasks/gate-b-plan.md` and took its seven decisions.

**Why.** Gate B's criteria and the open Phase 1 cards (A2, B3, B4, E8.1 to E8.6) were unplanned, and three choices blocked them: which Letta to reach without Docker, which benchmark carries the poisoning arm, and how the surfaces share one contract.

**Result.** Letta through MemFS (ADR 0028); the poisoning arm on MEM-INV-Bench, dated 2026-10-29 (ADR 0029); one HTTP route table with generated OpenAPI and client, in process by default, loopback only (ADR 0027). The primary-model half of criterion 4 becomes Gate B exception (c), since the pre-registration names that model and is backlogged.

**Consequence.** PRs 2, 3, 5 and 6 start on main; PR 4 stacks on PR 3. Every decision stays pending the lead's review.
