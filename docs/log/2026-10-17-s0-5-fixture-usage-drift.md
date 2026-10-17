---
date: 2026-10-17
author: omar
type: failure
card: S0.5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/pi-extension/test/harness.ts
  - "pnpm --filter pi-extension test"
supersedes: none
---

**What.** The S0.5 session fixture recorded on Windows failed on Linux CI.

**Why.** Three values were not stable: the faux provider's default API id embeds a timestamp and a random suffix; the system prompt carries the temporary working directory with forward slashes; and the faux provider estimates token usage from prompt length, which depends on that path.

**Result.** The first two were caught locally across repeated runs; usage was caught by CI, where input token counts differed by seven per call. The scripted model now takes a fixed API id, and the normalizer replaces both path spellings and the usage object.

**Consequence.** Session fixtures are accepted only after a green run on both Windows and Linux.
