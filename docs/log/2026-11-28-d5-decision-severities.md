---
date: 2026-11-28
author: claude-agent
type: decision
card: D5
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/lint/procedural.ts
  - docs/absorbed.md
supersedes: none
---

**What.** Severities follow caura except that its known sink hosts (webhook.site, requestbin, transfer.sh and the rest) and `base64 -d | sh` are critical, and a warning overlapping a critical finding in one field is dropped.

**Why.** Caura warns on both because it scans skill docs at write time; here exfiltration is one of the card's four classes, and a class that can never hold would never keep a procedure from admission. A pipe of decoded text into a shell runs hidden code, which caura's own attack patterns treat as critical elsewhere.

**Result.** Exfiltration holds on sink hosts, credential uploads, credentials piped to the network and "send the secrets to"; the generic webhook POST stays a warning.

**Consequence.** If wrong: More false holds on operations procedures that post to such hosts on purpose.
