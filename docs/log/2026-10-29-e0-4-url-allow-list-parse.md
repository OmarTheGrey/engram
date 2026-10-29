---
date: 2026-10-29
author: claude-agent
type: change
card: E0.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/setup.ts
  - packages/cli/test/redaction.property.test.ts
  - packages/cli/test/review-verification.test.ts
  - "pnpm --filter @engram/cli test"
supersedes: docs/log/2026-10-29-e0-4-review-p3-verification-fixes.md
---

**What.** The CLI's Postgres URL redaction now works from an allow-list (P3-20), and bracketed IPv6 hosts are refused (P3-21).

**Why.** Every earlier leak came from block-list splitting. The latest was a raw `?` or `#` in a password, which printed the password on the invalid-URL path.

**Result.**
- A strict parse accepts only `scheme://[userinfo@]host[:port][,...][/db][?key=value][#fragment]`, with one `@` before any `/`, `?` or `#`.
- Labels use only the parsed scheme, hosts, ports, database name and the values of `sslmode`, `application_name`, `connect_timeout` and `target_session_attrs`. Anything else prints `<hidden: unparseable>`.
- A seeded fast-check property (60 runs) found counterexample `#Q` before the fix and passes after it.
- postgres.js splits hosts on `:`, so IPv6 is refused as usage.
- 135 CLI tests pass.

**Consequence.** E0.4 awaits re-verification.
