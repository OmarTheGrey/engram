---
date: 2026-11-28
author: claude-agent
type: decision
card: E1.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/log/chain.ts
supersedes: none
---

**What.** The attestation's digest is stored in the event entry's data under the key `attestation`, beside the commitments, and an event without a row carries no key.

**Why.** The card asks for the digest in the chain record; storing it rather than recomputing it lets the verifier say which row changed, and omitting the key keeps unattested records byte for byte version 1's.

**Result.** No migration: `chain.data` already holds a JSON object. Records of unattested events, every test helper that recomputes a record, and every existing tamper work unchanged. Cost if wrong: a reader of `chain.data` must ignore the key, which the verifier does.

**Consequence.** AGENTS.md rule 5 does not apply: no schema.ts change, no schema_version bump.
