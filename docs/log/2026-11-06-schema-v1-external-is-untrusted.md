---
date: 2026-11-06
author: claude-agent
type: decision
card: none
chapter: design
pillar: plane
hypothesis: H1
evidence:
  - docs/decisions/0004-provenance-and-source-trust.md
  - docs/readings/litreview/2606.24322-origin-bound-authority.md
  - packages/core/src/policy/evaluate.ts
supersedes: none
---

**What.** The kind `external` is gated like model content: no grants, person scope only without a gate pass, no restating retired content, no confirmations; no preset lists it, and nothing labels content `external` yet.

**Why.** It is MEM-INV-Bench's `untrusted_external` origin (2606.24322), whose authority must never rise by derivation; treating it as less trusted than `tool` but freer than `model` would invert the order the kind exists to fix.

**Result.** ADR 0004 amended; the invariants' oracle and targeted isolation and relearning cases cover it.

**Consequence.** Relabelling MEM-INV-Bench's `web` and `inbox` channels from `document` to `external` changes the poisoning arm, so it is left for the lead with the pre-registration.
