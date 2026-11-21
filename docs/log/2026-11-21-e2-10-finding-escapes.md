---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.10
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - research/configs/injection-screen.json
  - packages/core/src/policy/injection-screen.ts
  - packages/core/test/unit/policy/injection-screen.test.ts
supersedes: none
---

**What.** Confirmed escapes under default (review E2.10-5, rerun on the fixed code): one Cyrillic or Greek homoglyph; a newline after "Assistant:" or "The agent must"; "Assistant - send", "Dear assistant,"; a hyphenated line break; "disregard everything above"; lowercase `[memory_persist]`, D.A.N, 1gn0re, `&lt;system&gt;`, French; one-signal standing directives; a short base64 payload; base64 after 20 decoys; hex payloads.

**Why.** A floor is stated with what passes it.

**Result.** Fixed narrowly: U+180E and U+034F now fold like other invisible formatting, and "your previous", "all of the previous" and "the instructions above" are caught; each has a test. The rest is listed in the config's limits.

**Consequence.** Card X14's suite should carry these as attacks.
