---
date: 2026-11-22
author: claude-agent
type: change
card: E8.15d
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/setup.ts
  - packages/cli/src/tui/screens/surface.ts
  - packages/cli/src/registry.ts
  - packages/cli/test/tui/snippets.test.ts
  - packages/cli/test/tui/flows-surfaces.test.ts
supersedes: none
---

**What.** After the ConPTY drive: Try it and a server's start scroll to what they printed; a snippet draws a URL's credentials redacted, as the command row does, and copies them whole; the tui entry names PATH and PATHEXT, which the snippets read.

**Why.** The drive showed Try it's results below the fold; docs/design/tui.md 10.3 says every message shown has passed `redactSecrets`, and a Postgres `--db` in the hook's args was drawn whole; the registry test fails a variable the CLI reads but no entry names.

**Result.** Three tests added first: a snippet with a Postgres password draws no password and copies it; a text field types every key the screen binds, `:` included; with a server, the hook protects the log Serve's `--db` named and says why. registry.test.ts passes.

**Consequence.** Nothing further.
