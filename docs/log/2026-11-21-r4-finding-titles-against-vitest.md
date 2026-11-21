---
date: 2026-11-21
author: claude-agent
type: finding
card: R4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/scripts/crosswalk.py
  - "ENGRAM_PG=skip pnpm exec vitest list <44 files> --staticParse=false --json=<file>"
supersedes: none
---

**What.** The full test names the crosswalk's parser reads were compared, once, with what vitest collects by running the files.

**Why.** The parser formats `.each` titles and resolves constants as vitest should; only vitest's own collection can confirm it. `vitest list` parses statically by default and then names constants and `.each` templates literally ("invariants > I1"), so the comparison used `--staticParse=false`.

**Result.** On 44 files (the 32 the crosswalk names and 12 heavy users of `.each`), 983 names the parser resolved, 981 were in vitest's 1,452. The two others are a `.todo` and a `.runIf` off Windows, both of which the parser already counts as no evidence.

**Consequence.** The comparison is not a gate: the script stays a text check, as the card asks. It can be rerun by hand when the parser changes.
