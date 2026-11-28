---
date: 2026-11-28
author: claude-agent
type: decision
card: E0.6
chapter: design
pillar: research
hypothesis: none
evidence:
  - scripts/check-absorbed.ts
  - docs/conventions/absorption.md
supersedes: none
---

**What.** Beyond the card's three checks, the script requires seven cells, a separator row, a 40-character commit, a mode of copy or port, a backticked landed path, CC-BY-4.0 only on a `(data)` mode, every part of an `AND`, `OR` or `WITH` expression allowed, and no table row left outside the table.

**Why.** Each is a rule of ADR 0037 or the absorption convention that review checks today, and several are needed for the card's checks to read a row at all. `OR` could be accepted on one allowed part; requiring every part is simpler and no row needs otherwise.

**Result.** All hold on main's 24 rows. Accepted limit: the convention records a commit hash and permits no other identifier, so a data source outside git (an archive with a DOI) cannot be registered until the convention says how.

**Consequence.** The form is written in the convention's "Recording it" section.
