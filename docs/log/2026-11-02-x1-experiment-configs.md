---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/config.ts
  - packages/runner/scripts/run.ts
  - packages/runner/test/count.test.ts
supersedes: none
---

**What.** A runner config's `kind` may be `experiment`: its `items` may be `all` (every item of the pinned data, in file order), its `model` names the pre-registration's slot (`prereg/M1`), and it runs only with `MODEL=` and `LIVE=1` or `REPLAY=1`, or is counted with `COUNT=1`; a scripted model, a script, a plain replay or `--record` is refused.

**Why.** H1's configs fix the protocol before the model is named; listing 2,218 checkpoint ids by hand would add nothing the pinned hashes do not already fix, and an experiment's cassettes must never be recorded from a script or committed.

**Result.** The live run checks the data against the pin before any session; `count.test.ts` holds each refusal.

**Consequence.** When v1 names M1, the configs stay as they are and the command line names it.
