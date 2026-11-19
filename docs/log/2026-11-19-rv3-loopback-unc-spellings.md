---
date: 2026-11-19
author: claude-agent
type: change
card: RV3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/no-bypass/paths.ts
  - packages/core/src/no-bypass.ts
  - packages/core/test/unit/no-bypass.test.ts
  - packages/mcp/test/hook.test.ts
  - packages/pi-extension/test/attacks.test.ts
supersedes: none
---

**What.** The no-bypass path check reads more of this machine's loopback UNC spellings as their drive paths (review finding RV-ADP-7): the device namespace's `\\?\UNC\<host>\` and `\\.\UNC\<host>\`, IPv6's `[::1]` and `0--1.ipv6-literal.net`, and any 127.0.0.0/8 address in full or short form.

**Why.** The reviewer's probe `winpath2.mts` wrote into a store root through `\\?\UNC\localhost\C$\...`, `\\.\UNC\localhost\C$\...`, `\\[::1]\C$\...` and `\\0--1.ipv6-literal.net\C$\...` while the Claude Code hook allowed each.

**Result.** Each spelling is blocked for a file tool and a shell command in core's unit test, through the Claude Code hook and in a real pi session; another machine's share stays unmapped. On the old code the mapping and file-tool tests failed (core 16, hook 4, pi 1); the shell forms were already refused, so their tests guard against regression. The Windows-only tests ran on this Windows machine.

**Consequence.** ADR 0014's amendment of card RV3 updates its list; the machine's network name stays a stated limit.
