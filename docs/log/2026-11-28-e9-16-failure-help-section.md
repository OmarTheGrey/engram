---
date: 2026-11-28
author: claude-agent
type: failure
card: E9.16
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/registry.test.ts
  - packages/cli/test/help-main.txt
supersedes: none
---

**What.** Adding the --subject lines to export's help section broke the registry test that rebuilds main's help byte for byte from main's commands.

**Why.** help-main.txt is main's help before the registry and is not to be edited for a new flag.

**Result.** Moved --subject to its own registry entry (decision subject-entry); the help literal in commands.test.ts gained only the new entries' lines.

**Consequence.** nothing
