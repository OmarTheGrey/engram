---
date: 2026-11-25
author: claude-agent
type: decision
card: ANS-2026-11-25
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0047-by-id-read-and-scope-list.md
  - docs/tasks/lead-decisions.md
  - packages/core/test/unit/plane/read-by-id.test.ts
  - packages/kit/test/kit.test.ts
supersedes: none
---

**What.** ADR 0047 (the by-id read and the scope list) is accepted by the lead, item 65 (a), as written.

**Why.** The lead wrote "accept the adrs" on 2026-11-25: his own answer, not one under the delegation, option (a) of each item.

**Result.** The text matches option (a): a by-id read drops a candidate reached only through a grant that does not admit it, so that id, one out of reach and one never held answer alike; the scope list holds readable member scopes and live-grant scopes; both are read events; the routes `POST /read/{itemId}` and `POST /scopes` are in `packages/server/src/routes.ts`; the kit forces source `model`. Tested in `packages/core/test/unit/plane/read-by-id.test.ts` ("answers as an unknown id (E8.14-1)") and `packages/kit/test/kit.test.ts`.

**Consequence.** No text change.
