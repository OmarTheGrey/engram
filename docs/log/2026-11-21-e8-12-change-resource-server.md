---
date: 2026-11-21
author: claude-agent
type: change
card: E8.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/auth.ts
  - packages/server/src/app.ts
  - packages/server/src/listen.ts
  - packages/server/test/auth.test.ts
supersedes: none
---

**What.** `engram serve` is an OAuth 2.1 resource server: a bearer JWT of one configured issuer, verified with jose 6.2.15 against its JWKS, or a local API key, names the actor the operator configured.

**Why.** ADR 0042 decisions 1 to 7; every surface took the actor on trust.

**Result.** Audience, issuer, exp and nbf are judged at the server's clock, with asymmetric algorithms only. An unmapped subject is 403. A request naming another id, level or membership is 403 and appends nothing. A sent source is replaced by the credential's. RFC 9728 metadata, and `WWW-Authenticate` on a 401. `make test-one T=packages/server/test/auth.test.ts`: 18 passed. Mutation: believing the sent source fails 3 of them.

**Consequence.** ADR 0040's limit closes for authenticated calls. The inspector sends no credential yet, so it works under `--insecure-loopback` only.
