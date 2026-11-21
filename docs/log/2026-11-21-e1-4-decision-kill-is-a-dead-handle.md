---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.4
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/helpers/failpoint.ts
supersedes: none
---

**What.** EverOS's hard kill (exit 137) is ported as a dead handle: the call that reaches the point and every later Db and store call through that handle throw; `raise` stays a transient fault the handle survives.

**Why.** A test cannot observe its own process exiting. The existing cross-handle tests throw at a transaction while the handle lives on, so the plane's catch block appends a store-failure deny; a killed process appends nothing. Both windows are real and differ (W2 against W5 in crash-windows.test.ts).

**Result.** The next process is another handle over the same log and store: a second connection in crash-windows.test.ts, a new wrapper over one in-memory log in the stateful model. Commit points take only crash and raise, as EverOS's synchronous point does.

**Consequence.** If wrong, a window only a real exit reaches is uncovered; none is known, the queue being per Db object.
