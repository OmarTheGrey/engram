---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.12
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/auth.ts
  - packages/server/test/auth.test.ts
  - docs/decisions/0042-verified-actors.md
supersedes: none
---

**What.** The resource server does not require the `typ: at+jwt` header of RFC 9068. This is the lead's answer to review finding E8.12-9.

**Why.** The header tells an access token apart from an ID token. An ID token's `aud` is the client id, never this server's resource URL, so the audience check already refuses one unless the operator configures the client id as the audience. Many issuers also do not set `at+jwt`, so requiring it would refuse valid access tokens.

**Result.** Tokens are refused on signature, algorithm, issuer, audience, exp, nbf and subject mapping. A new test signs HS256 with the issuer's public JWK as the secret (algorithm confusion). All three variants get 401 `invalid_token` and append nothing (`make test-one T=packages/server/test/auth.test.ts`: 21 passed).

**Consequence.** An operator must never set `--audience` to a client id. A later card can make `at+jwt` an option.
