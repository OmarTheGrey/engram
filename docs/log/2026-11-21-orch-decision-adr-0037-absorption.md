---
date: 2026-11-21
author: claude-orchestrator
type: decision
card: none
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0037-absorbing-open-source.md
  - docs/conventions/absorption.md
  - docs/absorbed.md
  - NOTICE
  - AGENTS.md
supersedes: none
---

**What.** ADR 0037 is accepted on the lead's instruction of 2026-11-21: code and data are copied or ported only from MIT, ISC, BSD, Apache-2.0, Unlicense or CC0 sources, in one of four modes (copy, port, depend, idea), and every copy and port is a row in `docs/absorbed.md`.

**Why.** The lead instructed that useful open-source repositories be absorbed. Rule 11 covered only installed packages, and the repository is to be public under Apache-2.0 (ADR 0020).

**Result.** New: the procedure `docs/conventions/absorption.md`, the empty register `docs/absorbed.md`, the root `NOTICE`, AGENTS.md rule 16 and a line in the pull request checklist. MPL-2.0 is a dependency only; AGPL, GPL, LGPL, SSPL, BUSL, Elastic and unlicensed sources are read for ideas only.

**Consequence.** Each absorbing card reads the licence at the commit it takes from. The register's file check in `make lint-docs` is built by the first card that adds a row.
