---
date: 2026-11-28
author: claude-agent
type: change
card: E9.15
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - packages/cli/src/audit.ts
  - packages/cli/src/registry.ts
  - make test-one T=packages/cli/test/audit.test.ts
supersedes: none
---

**What.** `engram audit export --from --to --key <private.pem> [--out] [--as --member]` writes the signed report, and `engram audit verify --report --key <public.pem>` checks it, both registered with `home: false` in the audit group, reading the log on this machine only, as `engram log` does.

**Why.** Card E9.15, step 2: the envelope and signing at the boundary, with the operator's Ed25519 key through `signing.ts`.

**Result.** `make test-one T=packages/cli/test/audit.test.ts`: 8 passed. Export then verify exits 0 OK; the same log, clock and key print the same bytes; a tampered report exits 1 at signature, an edited log 1 at chain, no key 3 UNSIGNED. Mutation check: verify without the pinned key fails 4 of the 8 tests; restored.

**Consequence.** Card E9.16 adds `ropa` to `auditCommand`'s dispatch.
