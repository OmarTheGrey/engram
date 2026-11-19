---
date: 2026-11-20
author: claude-agent
type: failure
card: RV6
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/test/live-fakes.ts
  - packages/runner/test/rv6.test.ts
supersedes: none
---

**What.** The first run of the one-shard-against-three-shards test failed: results and events matched, but every second call's cache key differed between the two runs.

**Why.** pi-ai's faux provider draws each tool call's id at random (`fauxToolCall` uses `randomId`), and the id is in the next call's transcript, so the faux answer model was not deterministic across processes. It was the test's fake, not the runner: a recorded live run replays its own ids from the cassettes.

**Result.** `fauxLive` takes `stableIds`, which derives the id from a hash of the session's user messages; the RV1 tests keep random ids. With it the test passes, and the cassette sets of the two runs are byte-identical.

**Consequence.** A byte-identity claim between two live recordings holds only for a deterministic model; for a real live run it holds between a sharded recording and its own replays, which is what H1 needs.
