---
date: 2026-10-29
author: claude-agent
type: finding
card: E2.4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/core/policies/medium.yaml
  - fixtures/cassettes/rn1-gatemem-probe
  - research/configs/rn1-gatemem-probe.json
  - "make fixtures MSG=..."
supersedes: none
---

**What.** Adding a retention paragraph to the preset header comments changed two of the six scripted cassettes of the runner fixture `rn1-gatemem-probe`, so `make fixtures` recorded them afresh.

**Why.** Condition C3 puts the preset file's text, comments included, into the model's prompt, so the prompt hash, and with it the cassette key, follows any edit to a preset comment.

**Result.** The two new cassettes differ from the old ones only in the seven added comment lines and the key; the recorded responses are identical, and the other four cassettes are unchanged.

**Consequence.** A preset comment edit is a prompt change for C3. Before any recorded or live run, preset text is frozen with the pin, or C3 should be given the policy without its comments; the lead decides which.
