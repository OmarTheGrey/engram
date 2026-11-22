# ADR 0048: The contradiction lint's local NLI tier is an injected scorer behind its own lint id, its scores cached as cassettes

Status: proposed, 2026-11-22
Deciders: drafted by card L7 of the absorb plan; for the lead's acceptance
Supersedes: nothing. It adds a tier to ADR 0008's two (and its L3 amendment) without changing either.

## Context

- **The model contradiction lint pays a call per candidate pair**: 95,217 on card L2's full set (lead-decisions item 47). A small natural-language-inference cross-encoder scores a pair locally in about 20 ms on a laptop (card L7's spike).
- **Core calls no model and imports no runtime** (AGENTS.md rule 4). The scorer has to be injected, as `ModelCall` is.
- **L3's model lints are registered H3 behaviour.** The arm that would use the tier, P3, is proposed in the pre-registration and not registered, so the tier must be off in every registered preset and must leave every registered lint run unchanged.
- **The schema may not change** (rule 5): `LintFinding.tier` is `deterministic`, `model` or `procedural`.

## Decision

1. Core defines `NliScore` (a request of model, premise and hypothesis to three probabilities) and the tier (`packages/core/src/lint/nli.ts`). It runs only when a policy lists `contradiction-nli` and the plane has `PlaneDeps.lintNli`. The thresholds are `contradiction-nli.upper` and `contradiction-nli.lower` under `lints.thresholds`; the loader refuses the id without both, in [0, 1], the lower not above the upper.
2. Every contradiction pair the model lint would send is scored in both directions; the pair's score is the larger contradiction probability. At or above the upper it is a finding of lint `contradiction-nli`, tier `model`, on the later item; below the lower it is dropped; between, it goes to the model lint with the request the model lint would have sent anyway.
3. The real scorer lives in `packages/model/src/nli.ts`: `cross-encoder/nli-deberta-v3-small` at revision fa2804872c3b, its fp32 ONNX export and tokenizer pinned by sha256 and fetched into `.engram/upstream`, run by onnxruntime-node 1.31.1 with @huggingface/tokenizers 0.2.0, one pair per run on one thread, imported only when a real scorer is built.
4. Every score is cached under the model's sha256, the runtime string (both package versions) and the pair's hash. The scorer draws nothing, so there is no seed. Scores are committed as cassettes; offline a miss is an error, so a replay computes no score. Only `make nli-scores` computes and records one.

## Alternatives

- **transformers.js as the runtime.** Rejected for its weight (sharp, onnxruntime-web, a second onnxruntime-node); its tokenizer is the package used.
- **A new tier value in the schema.** Not available outside card E2.8's schema pull request; the lint id already names the rule.
- **One direction only.** Cheaper, and on card L3's near-miss pair it would have given a lower score (0.5157 against 0.9961); rejected before any score was seen, because a contradiction either way is one. The lead may revisit it before P3 is registered (finding `docs/log/2026-11-22-l7-finding-flag-band-empty.md`).
- **Recomputing scores in a replay when they prove deterministic.** Two processes gave bitwise identical scores on 200 pairs, but a second machine was not checked; caching every score keeps a replay independent of the runtime.

## Consequences

- No registered preset, profile or condition changes; the lint runs of L3 and L4 replay byte for byte.
- The runner's lint configs take an `nli` block; `research/scripts/h3_lint_nli.py` reports the tier on the fixture as an engineering check.
- A schema card may later give the tier its own `tier` value.
