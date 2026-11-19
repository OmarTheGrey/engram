---
date: 2026-11-19
author: claude-agent
type: decision
card: RV1
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/runner/scripts/run.ts
  - packages/runner/src/journal.ts
supersedes: none
---

**What.** A rerun continues the run in its output folder only when asked (`RESUME=1`); without it the folder's run files are removed and the run starts afresh, as before.

**Why.** An automatic resume would show stale rows after a code change: a developer who reruns a fixture config to see the effect of an edit would get the earlier rows back. Starting afresh costs no money, since the cassettes still answer every call already made; it costs the replay's time, which is what RESUME=1 saves.

**Result.** The journal refuses to resume a folder whose `run.json` names another config or another fingerprint, or a folder with rows and no `run.json`.

**Consequence.** The lead's live H1 and H2 runs, if interrupted, are restarted with the same command and `RESUME=1`.
