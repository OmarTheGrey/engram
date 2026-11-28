---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.18
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - tools/symcc/Cargo.toml
  - tools/symcc/Cargo.lock
  - docs/deps.md
  - research/configs/h2-cedar-properties.json
supersedes: none
---

**What.** Pins and placement: cvc5 1.4.2 as the card names it, though the crate's README names 1.3.1; exact crate versions with a committed Cargo.lock; cvc5 fetched at its sha256 into .engram/upstream; the TypeScript under tools/symcc, its tests under scripts/test.

**Why.** The card named crate 0.8.1 and cvc5 1.4.2; the README's 1.3.1 is what upstream tested; the rest the card left open.

**Result.** With 1.4.2 every check answers and Cedar's authorizer reproduces each counterexample, so no incompatibility showed. The direct crates (cedar-policy-symcc 0.8.1, cedar-policy 4.14.1, tokio 1.54.1, serde_json 1.0.154) were published at least two weeks ago; the transitive ones are pinned by Cargo.lock but their dates were not checked one by one. tsconfig.json now includes `tools`.

**Consequence.** If 1.4.2 misbehaves, the pin moves to 1.3.1 in the config and deps.md, and the result is rerun.
