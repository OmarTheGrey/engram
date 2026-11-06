# Glossary

Their words, our words. Use the right-hand column in code, documents and the thesis; cite the left-hand term when comparing to the paper it comes from.

| They say | We say |
|---|---|
| principal, shared memory pool (GateMem) | owner and scope on every item |
| leak target (GateMem) | a violation of invariant 1: no read returns an item its scope or grants exclude |
| write channel, source isolation (MPBench) | source field; write gate rule per source |
| Write, Execute, Forget checkpoints (MemSecBench) | write gate, read filter, retire event |
| t_valid, t_invalid, ingestion time (Zep) | valid_from, valid_to on the item; timestamp on the MemoryEvent |
| evidence, signal, belief (Eywa) | provenance, confidence, status |
| ADD / UPDATE / DELETE / NOOP (Mem0) | the write operations the gate intercepts; UPDATE creates a new version with lineage |
| core memory, archival memory (MemGPT, Letta) | working context (ungoverned) versus governed long-term memory |
| memory stream, reflection (Generative Agents) | episodic items; promotion to semantic |
| memory evolution (A-MEM) | a version change that must carry lineage |
| workflow (AWM), skill (Voyager, SkillWeaver) | procedural memory item |
| provisional, released, retired (SKILL.nb); probationary, active, archived (MSCE) | candidate, active, retired |
| validation gate, gated execution (SKILL.nb) | replay-validation admission gate |
| reliability score (MSCE) | drift signal that triggers retirement |
| marginal utility per dollar (MERIT) | governance tax; the frontier chart |
| tenure crossover (Ground Truth First) | why retention budgets are evaluated on a long-horizon arm |
| MemCube (MemOS) | memory item plus store_ref |

## Engram fields and states

| term | meaning |
|---|---|
| class | episodic, semantic or procedural |
| scope | person, role, team or org; where an item lives and who may read it by default |
| owner | the principal who wrote the item or on whose behalf it was written |
| provenance | kind (user, document, tool, model, import, compaction, external), ref, hash, actor, session entry id; `external` is an untrusted outsider's content, ranked last |
| confidence | 0 to 1, set at write, revised by lints |
| valid_from, valid_to | the window in which the item is true; ingestion time lives on the event |
| ttl | retention budget hint; expiry retires, never deletes |
| grants | explicit, class-scoped, expiring permissions that widen reads beyond scope |
| version, lineage | every update is a new version pointing at the one it supersedes |
| status | candidate, active, retired |
| store_ref | opaque handle into the adapter's store |
| MemoryEvent | append-only record of every write, read decision, lint finding, promotion, retirement; carries reason and policy_id |
| invariant 1 | no read returns an item its scope or grants exclude |
| invariant 2 | no write lands in a scope that forbids its class or source |
| governance tax | the utility and cost difference between the governed and ungoverned conditions |
