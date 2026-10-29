---
date: 2026-10-29
author: claude-agent
type: failure
card: E8.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/no-bypass.ts
  - packages/core/test/unit/no-bypass.test.ts
  - docs/decisions/0014-no-bypass.md
supersedes: none
---

**What.** The narrowed commit-message exemption of R3-19 to R3-22 still had three literal holes: an unquoted newline did not end a segment (R3-23), a git alias could evaluate the message (R3-24), and index, stage and stash `rev:path` forms hid a path (`:memory/a.md`, `:0:memory/a.md`, `stash@{0}:memory/a.md`, R3-25).

**Why.** Each fix narrowed one route through a rule that read double-quoted text as inert and trusted any word after `git`; the tokenizer split segments only at `;`, `&` and `|`; the colon rule looked only at the first colon, after brace expansion.

**Result.** Found by the verifier. The exemption is now the smallest safe form: single-quoted, in command position, after a built-in message subcommand.

**Consequence.** An exemption from a security check is built from what is safe by construction, not by excluding known attacks.
