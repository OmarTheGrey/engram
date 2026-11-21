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
  - packages/core/test/unit/distill/scrub.test.ts
supersedes: none
---

**What.** If a tool argument's name passes the table's secret-name rule (`isSecretName`: KEY, TOKEN, SECRET, PASSWORD, AUTH and the like, with a hyphen read as an underscore), the scrub replaces its string or number value with `<redacted>`, whatever the value is.

**Why.** The table's first rule reads `NAME=value` in text. A JSON argument `{"api_key": "abc"}` has no `=`, so the table alone would keep a short key.

**Result.** The scrub test "redacts a tool argument whose name says it holds a secret" passes. Other values still go through the table.

**Consequence.** The rule over-matches names such as `keyword` or `monkey`, as the table's own name rule does. Those values are redacted. That costs some evidence for induction, never a leak.
