---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.5
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/dogfood.ts
  - packages/core/test/unit/dogfood-report.test.ts
supersedes: none
---

**What.** The printed report holds counts, fixed keys, rule ids of the bundled shape (`engram/...`, `preset.<name>/...`, `profile.<name>/...`, others counted as `other`) and the sha256 of the policy; no date, id, principal, scope or content. `--detail` names violations on stderr only.

**Why.** Rule 12 of AGENTS.md: only aggregate counts leave a member's machine. A custom policy's id could carry a name; the policy hash lets members check they ran the same profile.

**Result.** Tested: planted names, content words, item ids and a custom rule id are absent from the output; every leaf is a count but the hash and the format tag; the bytes are stable.

**Consequence.** A violation's ids stay on the member's machine; the team learns its count and rule.
