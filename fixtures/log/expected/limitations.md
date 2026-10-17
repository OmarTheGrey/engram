# Limitations

Consolidated from docs/log by research/scripts/consolidate_log.py. Edit the entries, not this file.

## Failures

- **2026-10-19, S0.1, failure.** CI failed because an action tag did not exist. Consequence: Actions are pinned to tags that exist.
- **2026-10-22, D2, failure, H5.** Replay validation admitted a procedure that failed on held-out tasks. Consequence: Replay sets are disjoint from induction sets.

## Distill

**2026-10-22, D2, failure, H5.** Replay validation admitted a procedure that failed on held-out tasks. The replay set shared tasks with the induction set. The admitted procedure failed on the held-out session. Replay sets are disjoint from induction sets.[^1]

## Plane

**2026-10-18, PX1, finding.** The context event sees messages but not the system prompt. The read filter must know what reaches the model. The session fixture shows the event payload without the system prompt. Recall injected through the system prompt is outside the filter.[^2]

[^1]: `fixtures/sessions/s0-interception.jsonl`
[^2]: `fixtures/sessions/s0-interception.jsonl`
