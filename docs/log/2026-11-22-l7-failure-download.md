---
date: 2026-11-22
author: claude-agent
type: failure
card: L7
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/model/src/nli.ts
supersedes: none
---

**What.** The first download of the 568 MB ONNX file stopped with curl exit 56 (connection reset) at about 190 MB.

**Why.** The Hub connection on this network is slow and drops long transfers.

**Result.** Resumed with `curl -C -` and retries; the file's sha256 matched the pin 59fd8dd7...0897. `fetchNliModel` downloads a file whole and keeps it only when its hash matches, so a reset there fails cleanly and a rerun fetches it again.

**Consequence.** A resumable fetch may be worth adding if the full-set run needs a fresh machine.
