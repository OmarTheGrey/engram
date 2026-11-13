---
date: 2026-11-06
author: claude-agent
type: decision
card: E9.2
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/pi-package/profiles/twin.yaml
  - docs/decisions/0021-twin-scopes-and-grants.md
supersedes: none
---

**What.** In the twin profile a role context reads role, team and org, never a person scope, unlike preset medium, where a role context may read its holder's person scope; "default grants" is read as none, every grant explicit.

**Why.** ADR 0021 keeps a person scope unreadable by others without a grant, and a role is handed to a successor. An agent acting in a role serves others, so personal memory in its context would reach them through what it writes; the role scope also refuses episodic records and model content, so a successor inherits work only.

**Result.** The fixture's role-context read returns the role item and none of the holder's four person items; the medium preset would return all five.

**Consequence.** A person context still reads its roles, so the holder works with both; a policy language could express default grants later.
