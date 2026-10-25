---
date: 2026-10-25
author: claude-agent
type: change
card: E8.2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/commands.ts
  - packages/cli/src/run.ts
  - packages/cli/test/read.test.ts
  - packages/cli/test/commands.test.ts
  - "pnpm exec vitest run packages/cli"
supersedes: none
---

**What.** Card E8.2's Gate A slice added the `engram` CLI: read (folder memories adopted, then `Plane.read`, each item with rank, score components and admitting rule, plus the filtered count), write, explain, doctor, `--json`; lint, simulate, promote and serve exit 2 naming their cards.

**Why.** Gate A asks that the files adapter show a team member's Claude Code memory in the CLI. The generated clients (E8.3) do not exist, so the CLI calls core and adapters directly through the Plane; E8.3 swaps in the client.

**Result.** 36 CLI tests pass on the synthetic fixture folder, help snapshot included. The real memory folder of the repository owner, read once as its owner under the medium preset: 2 memories listed, 2 adopted, 2 items returned, 0 filtered. No content was recorded.

**Consequence.** Gate A's CLI criterion holds; A3's acceptance is met.
