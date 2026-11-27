---
date: 2026-11-22
author: claude-agent
type: change
card: E8.15d
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/surface.ts
  - packages/cli/src/tui/screens/surfaces.ts
  - packages/cli/src/tui/screens/policy.ts
  - packages/cli/src/tui/screens/machine.ts
  - packages/cli/src/tui/screens/serve.ts
  - packages/cli/src/tui/screens/setup.ts
  - packages/cli/src/tui/screens/data.ts
supersedes: none
---

**What.** Twelve hand-made screens on one frame (`SurfaceScreen`): Retention sweep, Lint, Simulate, Doctor, Serve, MCP server, Claude Code hook setup, Export, Import, Keys, Create a key, Revoke a key, Log verify.

**Why.** docs/design/tui.md 8.9 to 8.15 and 8.20 to 8.24; E8.15b's generated forms could not run serve, mcp or the hook, and showed every result as plain text.

**Result.** Each screen lays out its main fields and keeps every other flag of its entry under "More flags"; it builds the generated form's argument vector, validates with the CLI's own checks, runs through the router's `act`, so `writes` decides the confirmation, and shows the result in its own view, the command's text (v) or its `--json` (J). The router opens them in place of the generated form through one factory. There is no Procedures screen: the palette's entry has no action.

**Consequence.** E8.15c's screens share the router and key table.
