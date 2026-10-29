---
date: 2026-10-29
author: claude-agent
type: finding
card: E8.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/src/hook.ts
  - packages/cli/test/hook.test.ts
supersedes: none
---

**What.** Claude Code's PreToolUse contract, checked against its hooks documentation on 2026-10-29: input `tool_name`, `tool_input`, `cwd` on stdin; a deny is exit 0 with `hookSpecificOutput.permissionDecision: "deny"` and `permissionDecisionReason`; exit 2 also blocks; any other exit code lets the call through.

**Why.** Plan decision 6 asked for the format to be verified before the hook shipped.

**Result.** The hook answers in the JSON form and exits 0; an unreadable input and an unopenable log still deny a bypass. Exit 1 on an error would have let a blocked call through, so every error path was changed to answer in the JSON.

**Consequence.** A hook that crashes before writing its answer fails open in Claude Code; ADR 0022's amendments say so.
