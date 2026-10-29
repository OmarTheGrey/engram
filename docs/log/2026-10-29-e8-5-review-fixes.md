---
date: 2026-10-29
author: claude-agent
type: change
card: E8.5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/static.ts
  - packages/server/test/ui.test.ts
  - packages/ui/src/view.ts
  - packages/mcp/test/explain-audit.test.ts
  - packages/server/test/contract.test.ts
  - test/e2e/inspector.e2e.test.ts
  - "make test-e2e"
supersedes: none
---

**What.** The fix pass for the PR 4 review (#22), findings R4-1 to R4-10.

**Why.** The review found the page served for API paths, an unescaped-content gap untested, a selection and filters surviving a viewer change, audit counts unguarded on the model's side, a log scan per explain, and gaps in two tests.

**Result.** Any path whose first segment decodes to `api` gets the JSON 404; a segment with `:` is refused; a junction tests the link rule. A hostile item renders as text. Selection and filters follow the viewer; explain rows label item text as current (chosen over omitting it). `counts` is documented as audit data and `memory_explain` is tested to carry none. Explain finds its event with core's `eventById`. React is 19.3.1. Each fix has a mutation that fails its test.

**Consequence.** None for other cards.
