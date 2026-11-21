---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.9
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/scripts/secret_guard.py
  - research/results/h1-secret-guard.json
supersedes: none
---

**What.** The first benign run held 151 of 14,587 paragraphs (1.04 percent) and denied 3, and flagged 8 of 100 generated IAM sentences.

**Why.** The high-entropy and labelled-key-material rules took repository paths and `owner/repo` names (`CONFIG=research/configs/...`) and PascalCase IAM actions (`ecr:GetAuthorizationToken` beside `secretsmanager`) for key material; the URL rule took documentation placeholders (`user:password@`).

**Result.** caura's reads-as-words gate, extended to `/`- and `=`-separated parts, and gitleaks' URL placeholder list brought it to 0 denied and 6 held, with synthetic coverage unchanged. The corpus that found the problem measured the fix, so the 0.041 percent is in-sample.

**Consequence.** X14's corpus, unseen by this tuning, gives the out-of-sample rate.
