---
date: 2026-10-29
author: claude-agent
type: change
card: E8.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/test/hook.test.ts
  - packages/core/test/property/visible-events.test.ts
  - packages/server/test/contract.test.ts
  - packages/cli/test/hook.test.ts
  - "make test-e2e"
supersedes: none
---

**What.** The fix pass for the PR 3 review (findings R3-1 to R3-12), rebased onto main `fa41e29`.

**Why.** The review found the hook missing PowerShell and failing open, the session's own config editable by the model, owner data in reads, item content in the timeline, and bypass spellings the checks missed.

**Result.** The hook checks Bash and PowerShell in any case, guards the log, `.mcp.json` and `.claude/settings*.json`, denies malformed input and resolves paths against the project; `sync` goes to the owner only; events keep an item only if the read filter would return it; NotebookEdit paths, bare root names, globs and admin shares are caught; bound addresses are checked; the MCP HTTP body is capped. Each fix has a test that failed when the fix was removed (mutants listed in the PR).

**Consequence.** ADRs 0014, 0022 and 0027 carry the amendments; PR 4 rebases onto the new `visibleEvents` signature.
