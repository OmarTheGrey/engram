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
  - packages/core/test/unit/plane/bypass.test.ts
supersedes: docs/log/2026-11-21-d1-decision-secret-arguments.md
---

**What.** Under a tool argument whose name passes `isSecretName`, the whole value is replaced, whether it is a string, a number, an array or an object. Null and booleans are kept. `isSecretName` also counts `pass` as a word of the name (`pass`, `db_pass`, `dbPass`), as the flag rule counts `--pass`, but not `bypass` or `passage`. The header-name rule went into the scrub, not into the shared table.

**Why.** The review stored `{"tokens": ["shorttok1"], "auth": {"basic": ...}}` unchanged. Putting the header rule in the table would change bypass reasons, which the review asked to keep byte-identical.

**Result.** The bypass and scrub tests pass, and the 23-case bypass corpus is identical before and after the change.

**Consequence.** The over-matching of the superseded entry still holds: names such as `keyword` or `monkey` lose their values.
