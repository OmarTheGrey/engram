# ADR XXXX: Consent opt-outs are declared in the policy document and match whole words of the content

Status: proposed, 2026-11-28
Deciders: drafted by card E9.12 of the second absorb plan; for the lead's acceptance

## Context

- Card E2.14 put a `consent` block in the policy schema (ADR 0002, decision D2): opt-outs naming a person scope and optionally a topic, a provenance source, a window and carve-outs. Its finding (`docs/log/2026-11-28-e2-14-finding-consent-gaps-for-e9-12.md`) left two choices to card E9.12 and said the first might need an ADR: who declares an opt-out, and how a topic matches an item that has no topic field.
- Builds on ADR 0021 (Twin's person scope, which only its person writes into by membership), ADR 0034 (a grant is the owner's consent), ADR 0040 (trust floors and their owner exemption), ADR 0041 (the Cedar export exports faithfully or refuses) and ADR 0049 (the owner accepts candidates in their own person scope, which the CLI trusts as far as the single-user machine it runs on). It amends none of them.

## Decision

1. **Where an opt-out is declared.** In the policy document the plane decides with. For Twin that is the person's own profile file on their own machine (the twin dogfood). The plane records which policy and version decided and the opt-out's index in every refusal (`engram/write/consent`); it does not record who wrote the opt-out, as it records no author for any other policy field. No command declares one.
2. **How a topic matches.** Deterministically, by whole words: the content's strings (text, a record's keys and string, number and boolean leaves, a procedure's body and tools) are NFKC-normalised, stripped of default-ignorable code points and lower-cased, cut into words of letters, marks and digits, and the topic's words must appear consecutively within one string. No stemming, no synonyms, no model.
3. **Which writes are judged.** Every write that puts content into the scope or makes it live: a first write in any status, a move into the scope, new content, an un-retire, a candidate made active. A same-scope, same-content rewrite that makes it no more live is not judged, so a retire always passes.
4. **What it is.** A control the person's own cooperative agent and tools meet at the write gate, judged at the time a write reaches the plane; not a filter an adversarial writer cannot evade, and not a control over the pi session tree or over what is produced during a window and written later.

## Alternatives considered

- **A per-person consent record with its own events** (a person declares and withdraws opt-outs through a command, each an event naming the declarer). It answers who declared and works on a shared server, but it is a schema change and a new surface; left to a later card.
- **A topic field on MemoryItem.** Exact and cheap to match, but a persisted schema change and a version bump, which the second absorb plan forbids before the tag; and writers would have to set it.
- **Matching by a model** (EverOS leaves `do_not_record` to its extractor model). Catches paraphrase, but the plane never calls a model (AGENTS.md rule 4), and a refusal must be explainable and reproducible.
- **Substring matching.** Catches "healthcare" for "health", and also "wealth" for "health"-like topics; not predictable.

## Consequences

- Known evasions are stated, not closed: plurals and inflections, an accent inside a word, compounds and camelCase, glued digits, split letters, homoglyphs NFKC does not fold, a topic split across writes, and lower case where full case folding differs. They appear in `packages/core/src/policy/consent.ts`, the twin profile's comment and `research/configs/consent-gate.json`.
- An owner cannot accept a covered candidate (ADR 0049) while the opt-out holds.
- The Cedar export refuses a policy that declares an opt-out (ADR 0041).
- Changing this decision needs a new ADR and a `decision` log entry.

## Sources

- `docs/tasks/E9.12.md`, `docs/tasks/absorb-plan-2.md` section 5, entry 22
- `docs/log/2026-11-28-e2-14-finding-consent-gaps-for-e9-12.md`, `docs/log/2026-11-28-e2-14-decision-consent-shape.md`
- EverOS `src/everos/memory/models.py` at e594efe59cc6 (Apache-2.0), `Profile.do_not_record`
