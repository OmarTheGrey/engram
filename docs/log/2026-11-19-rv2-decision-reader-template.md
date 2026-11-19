---
date: 2026-11-19
author: claude-agent
type: decision
card: RV2
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/h1-sessions.ts
supersedes: none
---

**What.** `make h1-table` writes one template, `h1-blind-readings/2`, with an empty `reader` and one `verdict` per reply. Each reader fills a copy of their own. The converter's `--readers` option is gone.

**Why.** The finding asked for one file per reader but left the format open. The other option was one template per reader with the name filled in, which means more files to hand out and a path per reader name. A single per-reader shape means a file cannot hold another reader's verdict, and the name a reader types only has to be non-empty and differ from the other's.

**Result.** The join refuses an empty name, and two files under one name.

**Consequence.** If wrong, a reader might type a name inconsistently between runs. That costs nothing, because names only have to differ between the two files.
