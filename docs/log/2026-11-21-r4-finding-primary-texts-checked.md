---
date: 2026-11-21
author: claude-agent
type: finding
card: R4
chapter: related-work
pillar: research
hypothesis: none
evidence:
  - research/configs/crosswalk.json
  - docs/research/absorb/13-compliance.md
  - "uv run python research/scripts/crosswalk.py --config research/configs/crosswalk.json --out research/results/h1-crosswalk.json --legal .engram/upstream/legal --fetch"
supersedes: none
---

**What.** The research note's regulatory facts, taken from commentary, checked against the Official Journal texts of Regulations (EU) 2024/1689, 2016/679 and 2026/1744.

**Why.** The note marked them unverified, and the card forbids quoting from memory.

**Result.** Confirmed: AI Act 12(1) asks for automatic recording of events over the system's lifetime; 19(1) and 26(6) ask providers and deployers to keep logs at least six months unless other law, in particular on data protection, provides otherwise. Regulation (EU) 2026/1744 exists (OJ L, 24.7.2026), enters into force the third day after publication, names none of Articles 12, 13, 14, 15, 19 or 26 among its amendments, and makes Chapter III, Sections 1 to 3 apply from 2 December 2027 (Annex III) and 2 August 2028 (Annex I). All 27 quotations stand in their cited paragraph and point.

**Consequence.** `docs/research/absorb/13-compliance.md`'s "Unverified" list can drop these items; GDPR corrigenda remain unread.
