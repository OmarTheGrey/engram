---
date: 2026-10-29
author: claude-agent
type: failure
card: E0.4
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/setup.ts
  - packages/cli/test/setup.test.ts
supersedes: none
---

**What.** The first Postgres wiring of E0.4 leaked secrets in three ways, and its redaction tests could not have caught them.

**Why.**
- Redaction replaced only the WHATWG password.
- An unparseable URL hung for 60 s, then crashed quoting it.
- `?password=` values and `postgress://` paths were printed as given.
- Removing the redaction from `openDb` left every test green.

**Result.**
- Redaction is string-based and covers the userinfo and secret-like parameters.
- Bad URLs are usage errors before any connection.
- A test makes the server echo a secret (`password_encryption=...`).
- A first attempt used a hand-built bad URL. It passed without the redaction, since core's error no longer quotes the URL, so it was replaced.

**Consequence.** A redaction test must exercise a path where a secret really reaches a message.
