---
date: 2026-11-21
author: claude-agent
type: failure
card: R4
chapter: limitations
pillar: research
hypothesis: none
evidence:
  - research/configs/crosswalk.json
  - "curl -sSL -A Mozilla/5.0 https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32024R1689"
supersedes: none
---

**What.** EUR-Lex's HTML pages for both acts could not be read by a script: curl got HTTP 202 with an empty body, and the web fetch tool saw an empty page.

**Why.** EUR-Lex answers automated clients with a browser challenge.

**Result.** The texts were fetched instead from the Publications Office's CELEX resource (`http://publications.europa.eu/resource/celex/32024R1689` and `32016R0679`, asking for XHTML), which serves the same Official Journal documents EUR-Lex shows. The script's own `--fetch` gets byte-identical files (the config's sha256 matched).

**Consequence.** The config cites the Official Journal reference, the ELI and the Publications Office URL for each act; a reader can open the same text on EUR-Lex by its ELI.
