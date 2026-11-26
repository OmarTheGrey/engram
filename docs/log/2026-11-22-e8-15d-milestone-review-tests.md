---
date: 2026-11-22
author: claude-agent
type: milestone
card: E8.15d
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/snippets.test.ts
  - packages/cli/test/tui/parity-surfaces.test.ts
  - packages/cli/test/tui/flows-surfaces.test.ts
  - packages/cli/test/tui/frames-surfaces.test.ts
  - "ENGRAM_OFFLINE=1 pnpm exec vitest run packages/cli/test"
supersedes: docs/log/2026-11-22-e8-15d-milestone-tests.md
---

**What.** Card E8.15d's tests after the review's fix pass: snippets 22, parity-surfaces 22, key flows 24, snapshot frames 96.

**Why.** The review asked for tests of each fix first, its surviving mutants killed, and the mutant set run again.

**Result.** All pass. The reviewer's mutant set, 23 mutants each applied and restored by git checkout, run on the six test files snippets, parity-surfaces, flows, frames, keys and review: 23 killed, 0 survived (it had 7 survivors, and an eighth among the reviewer's later ones). New flows: a reopened Serve stops the server it left running; `q` stops one with the summary's note; two keys, the second revoked; two lint findings with their own rules; the server from `ENGRAM_SERVER_URL` in both snippets; `--root` kept with `--server`. Under ConPTY, `q` with a running server exits 0 with its summary, and a reattached `s` stops it, the port freed.

**Consequence.** The coordinator's merge.
