# Decisions

Consolidated from docs/log by research/scripts/consolidate_log.py. Edit the entries, not this file.

| ADR | title | status | decision entries |
|---|---|---|---|
| 0001 | pi is the base building block of the control plane | accepted, 2026-10-17 | docs/log/2026-10-22-s0-13-adr-0001.md |
| 0002 | Memory item schema, versioning and generated contracts | accepted with amendments, 2026-10-22 | docs/log/2026-10-22-s0-13-adr-0002.md |
| 0003 | Event log as source of truth; store state as projection; SQLite via node:sqlite | accepted with amendments, 2026-10-22 | docs/log/2026-10-22-s0-13-adr-0003.md |
| 0004 | Provenance model and source trust | accepted with amendments, 2026-10-22 | docs/log/2026-10-22-s0-13-adr-0004.md |
| 0005 | Validity is bi-temporal; updates supersede, never overwrite | accepted with amendments, 2026-10-22 | docs/log/2026-10-22-s0-13-adr-0005.md |
| 0006 | Scope, owner and grants; policy as typed objects, not a policy language | accepted with amendments, 2026-10-22 | docs/log/2026-10-22-s0-13-adr-0006.md |
| 0007 | Write gate rules and source isolation | accepted, 2026-10-22 | docs/log/2026-10-22-s0-13-adr-0007.md |
| 0008 | Lints: deterministic first, model-based second, both as events | accepted, 2026-10-22 | docs/log/2026-10-22-s0-13-adr-0008.md |
| 0009 | Retrieval explanations carry score components, rank and policy decision | accepted with amendments, 2026-10-22 | docs/log/2026-10-22-s0-13-adr-0009.md |
| 0010 | Retention never deletes; eviction retires; long-horizon arm is mandatory | accepted, 2026-10-22 | docs/log/2026-10-22-s0-13-adr-0010.md |
| 0011 | One lifecycle for every class; replay admission for procedures | accepted with amendments, 2026-10-22 | docs/log/2026-10-22-s0-13-adr-0011.md |
| 0012 | Induction method: Agent Workflow Memory over pi session trees, reimplemented in TypeScript | accepted, 2026-10-22 | docs/log/2026-10-22-s0-13-adr-0012.md |
| 0013 | Adapter contract with capability flags; conformance suite on a fake first | accepted with amendments, 2026-10-22 | docs/log/2026-10-22-s0-13-adr-0013.md |
| 0014 | No-bypass: store commands blocked in bash; MCP store tools wrapped | accepted with amendments, 2026-10-22 | docs/log/2026-10-22-s0-13-adr-0014.md |
| 0015 | Evaluation protocol: six benchmarks, seven conditions, vendored judges, label audit | accepted with amendments, 2026-10-22 | docs/log/2026-10-22-s0-13-adr-0015.md |
| 0016 | Statistics: paired bootstrap, Holm, three models from three providers, stopping rules | accepted with amendments, 2026-10-22 | docs/log/2026-10-22-s0-13-adr-0016.md |
| 0017 | Every model call is cached, metered and seeded; cassettes are the cache | accepted with amendments, 2026-10-22 | docs/log/2026-10-22-s0-13-adr-0017.md |
| 0018 | Duplicate and near-duplicate detection without embeddings by default | accepted, 2026-10-22 | docs/log/2026-10-22-s0-13-adr-0018.md |
| 0019 | Monorepo tooling | accepted with amendments, 2026-10-22 | docs/log/2026-10-22-s0-13-adr-0019.md |
| 0020 | Licence | proposed, owner decides | none |
| 0021 | Twin: person and role scopes, consent grants, handover; offboarding deferred | accepted, 2026-10-22 | docs/log/2026-10-22-s0-13-adr-0021.md |
| 0022 | Other harnesses through MCP; interception limits stated | accepted with amendments, 2026-10-22 | docs/log/2026-10-22-s0-13-adr-0022.md |
| 0023 | Pre-registration lives in the repo, tagged, and is mirrored externally | accepted with amendments, 2026-10-22 | docs/log/2026-10-22-s0-13-adr-0023.md |
