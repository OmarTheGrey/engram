---
date: 2026-11-21
author: claude-agent
type: decision
card: D1
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/plane/bypass.ts
  - packages/core/src/distill/scrub.ts
  - packages/core/test/unit/distill/scrub.test.ts
  - docs/tasks/backlog.md
supersedes: docs/log/2026-11-21-d1-review-decision-secret-arguments.md
---

**What.** `isSecretName`, which only the scrub reads, counts `pass`, `passphrase`, `pw` and `cookie` as words of a name. In arrays, a flag whose name is a secret's takes the next element, and so does `-p` when a MySQL client is named beside it. An object's `value` goes when its `name` or `key` is a secret's. The named-value rule's `auth` is the word `auth`, `authorization` or `auth_token`.

**Why.** The verifier showed each shape leaking, and showed `Author: Jane Doe` redacted in every `git log` result.

**Result.** All the shapes are tested, and the bypass corpus is unchanged.

**Consequence.** `-p` for a port (ssh, docker, mkdir) is kept. The over-match of the table's name rule (`max_tokens`, `keyword`) predates D1 and is left as is, in a backlog row for card E2.9.
