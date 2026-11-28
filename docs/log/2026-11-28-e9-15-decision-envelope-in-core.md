---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.15
chapter: design
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/audit/dsse.ts
  - packages/cli/src/signing.ts
supersedes: none
---

**What.** The DSSE envelope's encoding (PAE, the JSON fields, the order of verification) lives in core as a pure port, with the signer and the signature check injected; only the Ed25519 key and its crypto stay in the CLI's `signing.ts`, as for checkpoints (ADR 0038, decision 7).

**Why.** The card puts signing in the CLI but its acceptance test, verify on a fixture log, in core; core cannot verify an envelope it cannot decode. Keeping the key out of core keeps rule 4's spirit and ADR 0038's split.

**Result.** The core test verifies with the test key helper; the CLI signs with `checkpointSigner`.

**Consequence.** No new ADR: this follows ADR 0038's injected signer. Other choices settled with it: the predicate type is `urn:engram:audit-report:v1` (no domain to own), the subject's digest is the chain head's SHA-256 link, the window is half-open on event times, and the schema version is core's.
