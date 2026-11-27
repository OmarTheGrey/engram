---
date: 2026-11-25
author: claude-agent
type: change
card: L8
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/lint.ts
  - packages/core/src/lint/det.ts
  - packages/core/test/unit/plane/lint-read-filter.test.ts
  - packages/core/test/property/lint-read-filter.test.ts
supersedes: docs/log/2026-11-22-l6-finding-lint-reads-scope.md
---

**What.** Plane.lint's default reach is now the read filter: `LintContext.canReach` is `evaluateRead(...).admitted`, the deterministic lints take only admitted items as subjects, and source-changed and orphan treat a refused item as absent.

**Why.** The open item of L6: under `readableAt` a finding named or described candidates, retired items, items past their ttl reached by a grant, and items not yet valid.

**Result.** Six counterexamples failed before the change and pass after it. The property, over 200 generated worlds, also checks that rewriting a refused item's content changes no finding. Mutation: restoring the old default fails six of seven tests. The model lints' units are unchanged under either reach.

**Consequence.** The CLI, the server route and the TUI's Lint screen, which goes through that route, get the filtered reach. The MCP server and the pi extension do not lint.
