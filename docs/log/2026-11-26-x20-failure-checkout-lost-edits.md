---
date: 2026-11-26
author: claude-agent
type: failure
card: X20
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/research/h1-sessions.ts
supersedes: none
---

**What.** A mutation check restored its file with `git checkout`, which dropped the uncommitted utility edits in `h1-sessions.ts` along with the mutant.

**Why.** The edits were not yet committed when the mutant was applied to the same file.

**Result.** Seen at once (an empty diff); the edits were reapplied from the same script, biome and both test files passed again (answer-refusal 12, h1-sessions 31), then committed.

**Consequence.** Later mutants copy the file aside and copy it back, never `git checkout`.
