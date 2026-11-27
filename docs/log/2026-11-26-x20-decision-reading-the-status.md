---
date: 2026-11-26
author: claude-agent
type: decision
card: X20
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/model/retry.ts
  - packages/runner/src/model/cassette.ts
  - packages/runner/test/answer-refusal.test.ts
supersedes: none
---

**What.** The status is read from pi-ai's `errorMessage` with retry.ts's one parser (`httpStatus`, review X20-5), plus any `"code"` in the body pi-ai folds in; a refusal needs pi-ai's own `isContextOverflow` patterns, a leading 400 or 413 or none, and no credit or key words.

**Why.** pi-ai 1.3.0 reports an HTTP error as text: `<status>: <body>` or the SDK's `<status> <message>`. The order is stop status, transient, refusal, stop, so a doubt stops the run and never excludes. A plain `400 Bad Request` still stops: rv1.test.ts requires it and a bad parameter would hit every session.

**Result.** Held on OpenRouter's documented bodies for 400 overflow, 401, 402, 403, 404 and moderation.

**Consequence.** A provider whose overflow text pi-ai does not know stops the run rather than excluding; the operator reads it.
