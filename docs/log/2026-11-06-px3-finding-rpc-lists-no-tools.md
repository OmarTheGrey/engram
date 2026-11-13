---
date: 2026-11-06
author: claude-agent
type: finding
card: PX3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/pi-package/test/probe-tools.ts
  - "pi 1.3.0 docs/rpc-commands.md, section get_commands"
supersedes: none
---

**What.** Pi 1.3.0's RPC `get_commands` lists extension commands, prompt templates and skills, but no tools, and no RPC command lists tools.

**Why.** The PX3 acceptance asks that `get_commands` list the Engram tools and commands.

**Result.** The acceptance test checks commands through `get_commands` and tools through a test-only extension loaded with `-e`, whose `/probe-tools` command reports `pi.getAllTools()` as an RPC notify event (`packages/pi-package/test/probe-tools.ts`).

**Consequence.** The card's acceptance line reads as commands by `get_commands` and tools by the probe in the same RPC process.
