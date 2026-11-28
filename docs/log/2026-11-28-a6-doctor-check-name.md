---
date: 2026-11-28
author: claude-agent
type: decision
card: A6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/doctor.ts
  - packages/cli/src/run.ts
  - packages/cli/src/tui/screens/machine.ts
supersedes: none
---

**What.** Doctor's new check is named `adapter mcp-mem`, not `adapter mcp-memory`, and is replaceable through `Io.doctorProbes` as the mem0 and letta checks are.

**Why.** Doctor pads check names to 16 characters; an 18-character name would run into its detail, and widening the column would change every doctor line and its TUI frames.

**Result.** Doctor's text and JSON list the check after `adapter letta`; two tests show it fails when a delete leaves the item or a write drops another client's line.

**Consequence.** If the lead prefers the full name, the column width changes in one place and the frames are regenerated.
