---
date: 2026-11-26
author: claude-agent
type: change
card: E8.15e
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/no-policy.test.ts
  - packages/cli/scripts/tui-screens.ts
  - "ENGRAM_OFFLINE=1 ENGRAM_PG=skip pnpm exec vitest run packages/cli/test/tui packages/view packages/ui packages/cli/test/view-deps.test.ts packages/cli/test/who-can-read.test.ts"
supersedes: docs/log/2026-11-26-e8-15e-change-guard-allowlist.md
---

**What.** The final verification of the allowlist guard found answers passed through an `object` or `{}` parameter (A09, A10, B05). Those types now count as lost, in both checks. All three are probes that fail.

**Why.** A type that names no field lets its contents be read blind.

**Result.** Two patterns are now permitted, each pinned by a probe that passes:
- comparing decision text with null or undefined, with "" or "-" as a fallback;
- reassigning drawn text (`line = cut(line, w)`).

N1 to N26, B1 to B7 and A09, A10 and B05 still fail. Two real `object`-typed values got types of their own: the Policy screen's values and Try it's JSON-RPC messages. The known limits now cover the walk's reach, the CLI's printed output, lint findings and the find field.

**Consequence.** The ADR 0044 amendment names the walk's reach.
