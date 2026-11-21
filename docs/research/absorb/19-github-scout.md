# 19. GitHub scout: memory control planes and novel memory systems

Six scouts swept GitHub (topics, keywords, MCP servers, awesome lists and papers, coding-agent PKM, rising repos). About 140 unique repos were listed. 45 were deep-read (shallow clones or API reads, nothing executed). This report adds to the earlier reports in this folder (01 to 18d) and to `00-master-plan.md`; where a source overlaps a master-plan card the overlap is said by id.

Conventions. Mode: copy (licence-compatible code lifted with attribution), port (re-implemented in TypeScript from a design or algorithm), idea. Effort S/M/L. Almost every repo is Python or Rust, so very little is literally copyable; the copyable material is TypeScript or data: Remnic (MIT, TS), graphCTX (MIT, TS), claude-mem (Apache-2.0, TS), TencentDB-Agent-Memory (MIT, TS), Mnemosyne 28naem-del (MIT, TS), regex tables and corpora in Python repos (data, with attribution).

## 1. Executive summary

What the sweep found. Engram's governance core (scope matrix, grants, bi-temporal reads, replayable log, explain, invariants) is ahead of every repo found. The closest siblings (LE0-Lin/governed-memory, Mimir, dent8, agentic-memory-fabric, Scuttie, mind-mem, caura) have fewer of the properties and mostly no reads-replay model. What they have, and Engram lacks, falls into six groups, each confirmed by grep on `packages/*/src` by the deep readers:

1. No content inspection on writes: no secret or PII scan, no injection screen (found independently in 12 repos). Engram's gate decides on scope, kind, confidence, class and budget only.
2. No derivation graph: `lineage` records versions, not premises. A retired or erased source leaves derived summaries and procedures trusted (anda-brain, Mnemosyne, governed-memory, agentledger, caura, honcho all solve it).
3. No tamper evidence: the log is append-only by convention (huqan, caura, Compartment, DKG, governed-memory triggers, agentic-memory-fabric). Master plan MP-21/22 already covers a chain; this sweep refines it.
4. No outcome or usage signal feeding retention, promotion or Distill (Remnic Memory Worth, mnemoverse feedback, caura evolve, Scuttie credit).
5. Read-side gaps: no authority fence on returned text, no why-not-returned explanation, no read manifest, no token budget (Remnic, memory.cpp, caura, anda-brain, graphCTX).
6. Novel verification tooling: retrieval bisect by delta debugging (Mnemosyne), failpoints for crash windows (EverOS), quote-grounding checks for model lints (obsidian-second-brain, Remnic).

The 5 most valuable absorptions (ranked by value over effort and fit with the thesis):

1. GH-01 Write-gate secret and PII guard, built from claude-mem's 45-pattern table, graphCTX's entropy and keyword rules, and Luhn/mod-97 validators (caura, Hindsight). Overlaps MP-14/MP-15; this supplies a better pattern source and the BLOCK/REVIEW tier design.
2. GH-02 Deterministic injection screen plus provenance-conditioned detectors and the read-time authority fence (Remnic MIT TS, copy; OWASP detectors, port). Gives the poisoning arm (ADR 0029) a second, explainable defence.
3. GH-06 `derived_from` edges with a stale-dependency lint and logged cascade (anda-brain, Mnemosyne, governed-memory). Builds on MP-65 (schema PR) and adds the semantics MP-65 lacks (parent version pinning, cascade as events).
4. GH-05 Tombstone non-resurrection invariant (Remnic) with the erase-epoch and origin-time stale-work guard (Honcho, EverOS). Nearly free in an event log, one new testable invariant, directly serves Distill retire-on-drift and Twin erasure.
5. GH-10 Retrieval bisect by `ddmin` (Mnemosyne, MIT TS, copy of about 100 pure lines). Novel, model-free answer to "what pushed the right item out", and a measurable thesis result.

Honourable mentions: GH-21 failpoints (S, makes E2.6 crash windows deterministic tests), GH-23 quote-grounding for model lints (S, precision gain for H3), GH-19 an mcp-memory JSONL adapter (the store most Claude users already run).

## 2. Landscape table

Columns: name, URL (github.com/...), stars, last push, licence, language, one line, found by (scout keys: T topics, K keywords, M mcp, A awesome-papers, C coding-pkm, R rising). Deep-read verdict in brackets where one exists.

### 2.1 Control planes and governance layers

| Name | URL | Stars | Pushed | Licence | Lang | One line | By |
|---|---|---|---|---|---|---|---|
| OWASP/www-project-agent-memory-guard | OWASP/www-project-agent-memory-guard | 209 | 2026-11-21 | Apache-2.0 | Python | ASI06 reference: detectors, SHA-256 baselines, AMSB benchmark [absorb] | K,M,A,C,R |
| phenomenoner/openclaw-mem | phenomenoner/openclaw-mem | 28 | 2026-07-26 | MIT | Python | Governance sidecar, per-item receipts, dry-run migration [port-idea] | K,A,R |
| coder-company/graphCTX | coder-company/graphCTX | 17 | 2026-07-05 | MIT | TS | Commit-valid fact store, injection planner, secrets scanner [absorb] | K,C,R |
| caura-ai/caura | caura-ai/caura | 573 | 2026-11-20 | Apache-2.0 | Python | Governed multi-agent memory, outcomes, hash audit [port-idea] | T,A |
| caura-ai/caura-memclaw | caura-ai/caura-memclaw | 573 | 2026-11-20 | Apache-2.0 | Python | Same product as caura (formerly MemClaw), eToro case study | R |
| HKUDS/MGP | HKUDS/MGP | 64 | 2026-07-20 | MIT | Python | Memory Governance Protocol, 60 schemas, thin gateway [port-idea] | K,R |
| ali-ulu/huqan | ali-ulu/huqan | 31 | 2026-11-21 | Apache-2.0 (enterprise dirs proprietary) | JS | Execution-path gate, hash chain, seals, halt, break-glass [absorb] | M,A |
| MerakOsiris/memoryguard | MerakOsiris/memoryguard | 4 | 2026-09-30 | MIT | Python | MCP memory governance for coding agents [port-idea] | K,M |
| LE0-Lin/governed-memory | LE0-Lin/governed-memory | 2 | 2026-11-20 | MIT | Python | Approval-gated bitemporal, snapshot dependency invalidation, triggers [port-idea] | K,M |
| buildepicshit/Mimir | buildepicshit/Mimir | 2 | 2026-05-26 | Apache-2.0 | Rust | Draft to librarian to append-only log, decay, mirror [port-idea] | A,C |
| ratharo-gitty/agentledger | ratharo-gitty/agentledger | 1 | 2026-10-15 | MIT | Python | Read-set cascade quarantine, receipts [port-idea] | K,M |
| alignment-farm/agentic-memory-fabric | alignment-farm/agentic-memory-fabric | 1 | 2026-04-09 | MIT | Python | Event-sourced fabric, signed events, SBOM export [port-idea] | K,R |
| Scuttie/enterprise-shared-memory-poc | Scuttie/enterprise-shared-memory-poc | 1 | 2026-09-24 | Apache-2.0 | Python | Frozen reason codes, USE/ABSTAIN router, outcome credit [port-idea] | K,R |
| star-ga/mind-mem | star-ga/mind-mem | 22 | 2026-11-16 | Apache-2.0 | Python | Propose, review, approve_apply, audit chain, drift scan | M |
| Metaworkers-ai/governedmemory | Metaworkers-ai/governedmemory | 10 | 2026-08-06 | MIT | Python | Write governor, trust labels, purpose bindings, chained audit | M |
| fjwood69/mori | fjwood69/mori | 32 | 2026-11-11 | AGPL-3.0 | Python | Governed memory MCP for coding agents | M |
| tenurehq/tenure | tenurehq/tenure | 31 | 2026-09-21 | MIT | TS | Governed shared memory between clients and model, per-request injection | A |
| xyzzylabs/dent8 | xyzzylabs/dent8 | 4 | 2026-07-30 | Apache-2.0 | Rust | Memory firewall: authority arbitration, entrenchment, hash-chained log | K,R |
| aetna000/atmem | aetna000/atmem | 15 | 2026-11-21 | Apache-2.0 | Python | Agent black box, reversible memory control plane | M |
| Mnemowall/mnemowall-sdk | Mnemowall/mnemowall-sdk | 0 | 2026-11-09 | Apache-2.0 | Python | Firewall plus version control, red-team pack | K |
| aureliocpr-ctrl/verimem | aureliocpr-ctrl/verimem | 4 | 2026-09-30 | AGPL-3.0 | Python | Gated writes, bi-temporal, abstention | M |
| Die-Namic-Systems/Nestor | Die-Namic-Systems/Nestor | 1 | 2026-11-20 | Apache-2.0 | Python | Seal/serve/audit over verified matches | M |
| iouxm10000/salience-ledger | iouxm10000/salience-ledger | 0 | 2026-10-23 | Apache-2.0 | Python | Record roles, immutable hashed generations, atomic CURRENT pointer | R |
| ovitrac/memctl | ovitrac/memctl | 0 | 2026-03-04 | MIT | Python | Unix-native SQLite control plane, 21 MCP tools | R |
| nexusailabs/sentinel-mesh | nexusailabs/sentinel-mesh | 0 | 2026-06-11 | MIT | Python | Verified-memory plane for ADK/A2A, signed trust passport | R |
| Atman36/decision-memory-control-plane | Atman36/decision-memory-control-plane | 0 | 2026-08-17 | MIT | JS | Evidence-linked decision memory, human review | K |
| qiontoo/memory-harbor | qiontoo/memory-harbor | 1 | 2026-08-01 | MIT | Python | Executable local memory control plane | K |
| agentlas-ai/agent_memory_curator_agent | agentlas-ai/agent_memory_curator_agent | 5 | 2026-06-05 | MIT | Python | Scoped memory curator for multi-agent flows | K |
| Gwendolenmave/mnemosyne | Gwendolenmave/mnemosyne | 15 | 2026-09-12 | Other (unverified) | TS | Auditable policy-governed memory (do not copy) | K |
| jin-bo/agentao | jin-bo/agentao | 314 | 2026-11-20 | MIT | Python | Governed local agent runtime with permissions and memory | M |
| songs-aaa/shared-memory-vault | songs-aaa/shared-memory-vault | 100 | 2026-09-05 | MIT | Markdown/Py | Multi-agent shared markdown KB governance | K |
| nexi-lab/nexus | nexi-lab/nexus | 195 | 2026-11-20 | Apache-2.0 | Python | VFS shared context plane, ReBAC, zone isolation | T |
| pipeshub-ai/pipeshub-ai | pipeshub-ai/pipeshub-ai | 4140 | 2026-11-21 | Apache-2.0 | Python | Permission-aware retrieval over connected sources | T |
| ClickHouse/loom | ClickHouse/loom | 174 | 2026-11-21 | Apache-2.0 | Python | Shared memory MCP, namespace-scoped role tokens | A |
| kody-hq/kody | kody-hq/kody | 984 | 2026-11-20 | NOASSERTION | TS | Team agent memory on Workers, OAuth, grants | R |
| Danielfoojunwei/A-Reference-Monitor-for-LLM-Agent-Memory... | Danielfoojunwei/A-Reference-Monitor-for-LLM-Agent-Memory-Provenance-Based-Write-Integrity-with-Empirical-Detection- | 1 | 2026-02-12 | Apache-2.0 | Python | Research artifact: reference-monitor write integrity | K |
| memtomem/memtomem-stm | memtomem/memtomem-stm | 5 | 2026-11-21 | Apache-2.0 | Python | MCP proxy gateway with candidate_propose review | K |
| mcncarl/agent-memory-vault | mcncarl/agent-memory-vault | 348 | 2026-10-04 | MIT | Python | Git vault, content-bound write intents, approvals, receipts | C |
| 9thLevelSoftware/Daem0n-MCP | 9thLevelSoftware/Daem0n-MCP | 75 | 2026-11-19 | MIT | Python | Covenant forcing preflight before protected writes | M |
| octoryn/octopus-blackboard | octoryn/octopus-blackboard | 8 | 2026-07-15 | Apache-2.0 | TS | Local shared blackboard for coding agents | M |
| mustafa-bharmal-shipveho/brainstack | mustafa-bharmal-shipveho/brainstack | 1 | 2026-09-24 | Apache-2.0 | Python | Human-gated lesson memory, secret-scanner-gated push | M |
| chenhz01/transcript-memory-diff | chenhz01/transcript-memory-diff | 0 | 2026-10-15 | Apache-2.0 | Python | Transcript to proposed memory diff, nothing auto-merges | C |
| chenhz01/memory-expiry-gate | chenhz01/memory-expiry-gate | 0 | 2026-10-20 | Apache-2.0 | Python | TTL semantics test harness | M |
| chenhz01/agent-memory-doctor | chenhz01/agent-memory-doctor | 3 | 2026-11-13 | Apache-2.0 | Python | Boot-time integrity check for memory and convention files | A |
| EternalNight996/memory-eternal | EternalNight996/memory-eternal | 212 | 2026-11-21 | MIT | JS | Review before admit, pending queue, recycle bin | T |

### 2.2 Tamper-evident and audit layers

| Name | URL | Stars | Pushed | Licence | Lang | One line | By |
|---|---|---|---|---|---|---|---|
| OriginTrail/dkg | OriginTrail/dkg | 133 | 2026-11-19 | Apache-2.0 | TS | Decentralised KG, Merkle, ed25519 seals, CCL rules [port-idea] | T,A |
| MaxFreedomPollard/Compartment | MaxFreedomPollard/Compartment | 472 | 2026-11-18 | Apache-2.0 | Python | Encrypted offline vault, per-record keys, hash chain with anchor [port-idea] | T,A |
| ZIZKA-AI-SL/ZizkaDB | ZIZKA-AI-SL/ZizkaDB | 164 | 2026-11-20 | AGPL-3.0 | Python | Tamper-evident decision log (ideas only) | A |
| RonaldSit/atelya | RonaldSit/atelya | 0 | 2026-11-05 | Apache-2.0 | Python | Hash chain with external witness, GDPR marker | M |
| aayushcodebook/memtrail | aayushcodebook/memtrail | 0 | 2026-06-11 | MIT | Python | Zero-dep JSONL hash-chained audit over Mem0/Zep/LangGraph | M |
| CloudLLM-ai/mentisdb | CloudLLM-ai/mentisdb | 92 | 2026-11-17 | MIT | Rust | Hash-chained typed memory log, signed skill registry | A |
| SaravananJaichandar/world-model-mcp | SaravananJaichandar/world-model-mcp | 24 | 2026-11-20 | MIT | Python | SQLite KG with Ed25519 plus SLH-DSA audit chain | M |
| rahulsub/synapse-mem | rahulsub/synapse-mem | 0 | 2026-11-09 | MIT | Go | Signed hash-chained event log that syncs | M |
| DanceNitra/inspeximus | DanceNitra/inspeximus | 8 | 2026-11-20 | MIT | Python | Signed forget tombstones, erasure certificate | A |
| mozgsml/memgres | mozgsml/memgres | 1 | 2026-09-24 | MIT | Python | Authored diffs, content-hash locking, GDPR-erasable history | A |
| Nifty0x/memora | Nifty0x/memora | 3 | 2026-07-30 | MIT | Python | BPMA reference: erasure-with-receipt | M |
| doronp/gitmemory | doronp/gitmemory | 19 | 2026-11-04 | Apache-2.0 | Python | Transcript capture to git, tiling proof | A |

### 2.3 Mount-on-top and sidecar memory layers

| Name | URL | Stars | Pushed | Licence | Lang | One line | By |
|---|---|---|---|---|---|---|---|
| joshuaswarren/remnic | joshuaswarren/remnic | 235 | 2026-11-21 | MIT | TS | Local-first markdown memory, injection screen, tombstones, worth [absorb] | T,K,A,C |
| thedotmack/claude-mem | thedotmack/claude-mem | 118734 | 2026-11-21 | Apache-2.0 | TS | Capture, compress, inject via hooks; redaction table [absorb] | T,C |
| 28naem-del/mnemosyne | 28naem-del/mnemosyne | 162 | 2026-11-10 | MIT | TS | SQLite memory: bisect, dependency edges, consolidation gate [absorb] | T,M |
| tigerless-labs/agent-memory | tigerless-labs/agent-memory | 4324 | 2026-11-12 | MIT | Python | Markdown truth, deletable index, sleep pass [port-idea] | C,R |
| TencentCloud/TencentDB-Agent-Memory | TencentCloud/TencentDB-Agent-Memory | 31086 | 2026-11-19 | MIT (verified) | TS | Team memory hub, proxy, API keys [port-idea] | T,R |
| LucieEveille/kiwi-mem | LucieEveille/kiwi-mem | 353 | 2026-10-09 | Other | Python | OpenAI-compatible memory proxy (licence unverified) | K |
| okf-memory/okf-agent-memory | okf-memory/okf-agent-memory | 872 | 2026-11-14 | MIT | Go | Git-native OKF bundle memory [port-idea] | T,C,R |
| EverMind-AI/EverOS | EverMind-AI/EverOS | 13958 | 2026-11-20 | Apache-2.0 | Python | Markdown-native layer; purge tombstones, failpoints [port-idea] | T |
| oceanbase/powercontext | oceanbase/powercontext | 1764 | 2026-11-21 | Apache-2.0 | Python | Source/Artifact/Trigger context service | R |
| mem9-ai/mem9 | mem9-ai/mem9 | 1236 | 2026-11-04 | Apache-2.0 | TS | OpenClaw memory plugin | A |
| AVIDS2/memorix | AVIDS2/memorix | 942 | 2026-11-19 | Apache-2.0 | TS | Shared project memory, review-gated workspace, doctor | R |
| mnemon-dev/mnemon | mnemon-dev/mnemon | 732 | 2026-11-19 | Apache-2.0 | Go | LLM-supervised graph memory | T |
| plur-ai/plur | plur-ai/plur | 318 | 2026-11-20 | Apache-2.0 | TS | Shared engrams for agent teams | T |
| smaramwbc/statewave | smaramwbc/statewave | 259 | 2026-11-19 | Apache-2.0 | Python | Episodes, typed memories, bounded bundles, delete by subject | A |
| zilliztech/memsearch | zilliztech/memsearch | 2915 | 2026-11-19 | MIT | Python | Markdown-first layer, Milvus search | T |
| Goldentrii/AgentRecall-X | Goldentrii/AgentRecall-X | 376 | 2026-11-21 | MIT | JS | Correction-first memory | T |
| mtrnix/metronix-memory | mtrnix/metronix-memory | 107 | 2026-11-17 | Apache-2.0 | Python | Freshness detection, dedup, one-command compose | R |
| Uranid/mnem | Uranid/mnem | 124 | 2026-08-03 | Apache-2.0 | Rust | Git for knowledge, revoke-a-fact filters retrieval | A |
| zhangfengcdt/memoir | zhangfengcdt/memoir | 632 | 2026-10-27 | Apache-2.0 | Python | Git-like versioned memory, merge policy [port-idea] | A,R |
| memvid/memvid | memvid/memvid | 17434 | 2026-07-14 | Apache-2.0 | Rust | Single-file append-only frames [port-idea] | C |
| MystenLabs/walrus-memory | MystenLabs/walrus-memory | 138 | 2026-11-17 | Apache-2.0 | TS | Portable memory on Walrus storage | T |
| huggingface/funes | huggingface/funes | 600 | 2026-11-20 | Apache-2.0 | Rust | Durable searchable session memory | T |
| aerovato/operator-memory | aerovato/operator-memory | 521 | 2026-11-05 | BSD-3-Clause | TS | Self-improving context engine | T |
| juyterman1000/entroly | juyterman1000/entroly | 488 | 2026-11-21 | Apache-2.0 | Python | Context assurance, receipts | T |
| KirtiRamchandani/memory.cpp | KirtiRamchandani/memory.cpp | 662 | 2026-11-02 | MIT | Rust | Context compiler, read manifest, negative memory [port-idea] | T,A |
| LeoYeAI/talewell | LeoYeAI/talewell | 550 | 2026-10-01 | MIT | JS | AMP: one md per record, git commit per write, provenance tainting | R |
| agentscope-ai/ReMe | agentscope-ai/ReMe | 3828 | 2026-11-21 | Apache-2.0 | Python | Personal, task, tool memory | A |
| memodb-io/memobase | memodb-io/memobase | 2962 | 2026-01-11 | Apache-2.0 | Python | Profile slots plus events | T |
| MemMachine/MemMachine | MemMachine/MemMachine | 3089 | 2026-11-21 | Apache-2.0 | Python | Episodic graph, profile, REST and MCP | T |
| zjunlp/LightMem | zjunlp/LightMem | 1228 | 2026-11-17 | MIT | Python | Sleep-time consolidation (ICLR 2026) | T |
| kayba-ai/agentic-context-engine | kayba-ai/agentic-context-engine | 2609 | 2026-09-24 | Apache-2.0 | Python | Evolving skillbook | T |
| TiMEM-AI/TiMEM | TiMEM-AI/TiMEM | 189 | 2026-11-01 | Other (dual, core Apache-2.0) | Python | Temporal-hierarchy consolidation [port-idea] | K,R |
| plastic-labs/honcho | plastic-labs/honcho | 8214 | 2026-11-20 | AGPL-3.0 | Python | Peer models, derivation graph [ideas only] | T |
| vectorize-io/hindsight | vectorize-io/hindsight | 62321 | 2026-11-20 | MIT | Python | Retain/recall/reflect, defense rules [port-idea] | T,R |
| volcengine/OpenViking | volcengine/OpenViking | 42553 | 2026-11-21 | AGPL-3.0 | Python | Context database, L0/L1/L2 [ideas only] | T,R |
| basicmachines-co/basic-memory | basicmachines-co/basic-memory | 4652 | 2026-11-20 | AGPL-3.0 | Python | Markdown KG with observation grammar [ideas only] | C |
| ruvnet/RuVector | ruvnet/RuVector | 4714 | 2026-11-21 | MIT | Rust | Vector/graph DB, receipts [port-idea] | R |
| sachitrafa/YourMemory | sachitrafa/YourMemory | 274 | 2026-09-19 | other | Python | Ebbinghaus decay | A |
| samvallad33/vestige | samvallad33/vestige | 662 | 2026-11-20 | AGPL-3.0 | Rust | FSRS decay, safety kernel (ideas only) | A |
| zensation-ai/zenbrain | zensation-ai/zenbrain | 30 | 2026-11-16 | Apache-2.0 | TS | 7 neuro-inspired layers, FSRS decay | K |
| aayoawoyemi/Ori-Mnemos | aayoawoyemi/Ori-Mnemos | 337 | 2026-10-01 | Apache-2.0 | TS | ACT-R, Hebbian, forget module (supersede, release, purge) | C |
| deeplethe/lethe | deeplethe/lethe | 20 | 2026-06-16 | MIT | Python | Built to forget, ForgetEval | C |
| itpartypattaya/hermes-dreaming | itpartypattaya/hermes-dreaming | 32 | 2026-11-18 | MIT | Python | Nightly deterministic consolidation | K |
| JingxuanC/causal-memory | JingxuanC/causal-memory | 110 | 2026-11-04 | Apache-2.0 | Rust | Decision to outcome graph, bias audit [port-idea] | T,A |
| neo4j-labs/agent-memory | neo4j-labs/agent-memory | 611 | 2026-11-19 | Apache-2.0 | Python | Graph-native memory, reasoning traces [port-idea] | T,R |
| ldclabs/anda-brain | ldclabs/anda-brain | 87 | 2026-11-19 | Apache-2.0 | Rust | Formation/Recall/Maintenance, dependent re-check [port-idea] | K,A,R |
| liliang-cn/cortexdb | liliang-cn/cortexdb | 529 | 2026-11-21 | MIT | Go | Shared KG with ontology constraints | A |
| mnemoverse/mcp-memory-server | mnemoverse/mcp-memory-server | 30 | 2026-11-19 | MIT | TS | MCP client of hosted engine; memory_feedback [port-idea] | C,R |
| Fengzdadi/memory-bench-registry | Fengzdadi/memory-bench-registry | 209 | 2026-10-12 | MIT | HTML | Registry of memory benchmarks | R |

### 2.4 MCP memory servers

| Name | URL | Stars | Pushed | Licence | Lang | One line | By |
|---|---|---|---|---|---|---|---|
| modelcontextprotocol/servers (src/memory) | modelcontextprotocol/servers | 92140 | 2026-11-19 | MIT and Apache-2.0 mix | TS | JSONL knowledge graph, the default memory most users run [port-idea] | M |
| doobidoo/mcp-memory-service | doobidoo/mcp-memory-service | 2138 | 2026-11-20 | Apache-2.0 | Python | Popular MCP memory, REST, belief layer [port-idea] | M,C |
| Dataojitori/nocturne_memory | Dataojitori/nocturne_memory | 1437 | 2026-11-03 | MIT | Python | Rollbackable memory with review UI [port-idea] | T,C |
| petabridge/memorizer | petabridge/memorizer | 221 | 2026-11-18 | MIT | C# | Vector MCP memory with versioning | M |
| JinHo-von-Choi/anchormind | JinHo-von-Choi/anchormind | 173 | 2026-11-21 | AGPL-3.0 | JS | Fragment memory MCP | M |
| memory-graph/memory-graph | memory-graph/memory-graph | 258 | 2026-09-16 | MIT | TS | Graph MCP memory with relations | R |
| GreatScottyMac/context-portal | GreatScottyMac/context-portal | 769 | 2026-01-27 | Apache-2.0 | Python | ConPort SQLite KG of decisions | C |
| klarlabs-studio/mnemos | klarlabs-studio/mnemos | 5 | 2026-11-21 | MIT | Go | Evidence-backed claim memory, contradiction surfacing | M |
| saloni-garg/memfix | saloni-garg/memfix | 1 | 2026-10-17 | MIT | Python | Assert/retract/supersede tombstones, mem0 importer | M |

### 2.5 Coding-agent memory

| Name | URL | Stars | Pushed | Licence | Lang | One line | By |
|---|---|---|---|---|---|---|---|
| DeusData/codebase-memory-mcp | DeusData/codebase-memory-mcp | 48966 | 2026-11-21 | MIT | C | Code graph over MCP, content digest, fail-open hook [port-idea] | C |
| oraios/serena | oraios/serena | 31562 | 2026-11-19 | GPL-3.0 (SolidLSP MIT) | Python | LSP toolkit with memory files [ideas only] | C |
| gastownhall/beads | gastownhall/beads | 28880 | 2026-11-21 | MIT | Go | Dolt-backed issue graph, CAS, claims [port-idea] | C |
| trailhq/Trail-Code | trailhq/Trail-Code | 11387 | 2026-11-21 | MIT | TS | Learnings anchored to code, secret scanner, quote verify [port-idea] | C |
| breferrari/obsidian-mind | breferrari/obsidian-mind | 5552 | 2026-10-17 | MIT | TS | Vault memory, near-dup guard, supersession fixpoint [port-idea] | C |
| eugeniughelbur/obsidian-second-brain | eugeniughelbur/obsidian-second-brain | 5405 | 2026-11-18 | MIT | Python | Vault memory, quote verification, freshness lint [port-idea] | C |
| Ar9av/obsidian-wiki | Ar9av/obsidian-wiki | 3794 | 2026-11-20 | MIT | Python | Agent-built wiki with lint skills | C |
| vanzan01/cursor-memory-bank | vanzan01/cursor-memory-bank | 3055 | 2026-05-26 | none | none | Cursor memory-bank prompts (no licence) | C |
| GreatScottyMac/roo-code-memory-bank | GreatScottyMac/roo-code-memory-bank | 1670 | 2025-05-15 | Apache-2.0 | Batch | Roo memory-bank prompts | C |
| iwe-org/iwe | iwe-org/iwe | 1833 | 2026-11-20 | Apache-2.0 | Rust | Markdown KG engine, LSP and MCP | C |
| riponcm/projectmem | riponcm/projectmem | 877 | 2026-11-20 | MIT | Python | Event-sourced precheck before edits (arXiv 2606.12329) | R |
| AgentMemoryRepo/agentmemoryrepo | AgentMemoryRepo/agentmemoryrepo | 876 | 2026-10-06 | MIT | spec | Cognition spec for a separate memory git repo | R |
| rinfa0108/openbrain | rinfa0108/openbrain | 5 | 2026-11-01 | Apache-2.0 | Rust | Typed versioned memory objects | K |
| danielmarbach/mnemonic | danielmarbach/mnemonic | 32 | 2026-11-21 | Apache-2.0 | TS | Markdown MCP with per-project policies | R |
| mbeacom/adrkit | mbeacom/adrkit | 26 | 2026-11-20 | Apache-2.0 | TS | Machine-readable ADRs as decision memory | M |
| AskTheWay/dsh-auto-memory | AskTheWay/dsh-auto-memory | 137 | 2026-11-21 | MIT | TS | 4-state trust machine, hygiene guard | T |
| AfridaMehanaz/memanchor | AfridaMehanaz/memanchor | 2 | 2026-10-21 | MIT | TS | Memories anchored to files, flagged STALE on change | C |
| asymptopialtd/nocetta | asymptopialtd/nocetta | 1 | 2026-11-05 | MIT | TS | Anchored bitemporal coding memory | K |
| stalebrainlabs/stalebrain | stalebrainlabs/stalebrain | 5 | 2026-07-31 | MIT | Python | Typed claim audit of CLAUDE.md and AGENTS.md | K |
| tonydzi/claude-memory-tidy | tonydzi/claude-memory-tidy | 2 | 2026-11-14 | MIT | Python | Keep MEMORY.md under truncation limit | A |
| ozgurcd/scrinium | ozgurcd/scrinium | 7 | 2026-11-14 | MIT | Go | Repo-owned evidence claims with freshness | M |
| chenhz01/agent-memory-benchmark | chenhz01/agent-memory-benchmark | 1 | 2026-10-15 | Apache-2.0 | Python | Behaviour-layer conformance benchmark, 11 clauses | C |
| veersaraf/forgetting-bench | veersaraf/forgetting-bench | 0 | 2026-09-04 | MIT | Python | Contradiction and decay benchmark | C |

### 2.6 Graph and temporal memory

| Name | URL | Stars | Pushed | Licence | Lang | One line | By |
|---|---|---|---|---|---|---|---|
| dolthub/dolt | dolthub/dolt | 24950 | 2026-11-21 | Apache-2.0 | Go | SQL with git semantics, three-way merge [port-idea] | C |
| project-minigraf/minigraf | project-minigraf/minigraf | 229 | 2026-11-19 | Apache-2.0 | Rust | Embedded bitemporal graph DB | A |
| jscott3201/aionforge-memory | jscott3201/aionforge-memory | 12 | 2026-07-11 | Apache-2.0 | Rust | Bi-temporal agent memory on selene-db | M |
| shane-farkas/memento-memory | shane-farkas/memento-memory | 12 | 2026-08-10 | MIT | Python | Bitemporal KG with entity resolution | A |
| RooAGI/Membrick | RooAGI/Membrick | 11 | 2026-11-20 | Apache-2.0 | Rust | Chronological supersession inference | A |
| veracium-ai/Veracium | veracium-ai/Veracium | 11 | 2026-11-21 | MIT | Python | Who-said-it tracking so read content never becomes asserted fact | A |
| davccavalcante/gaptime | davccavalcante/gaptime | 2 | 2026-09-11 | Apache-2.0 | TS | Bi-temporal KG memory in TS | K |
| memvara/memvara | memvara/memvara | 1 | 2026-10-22 | Apache-2.0 | Python | Bitemporal contradiction resolution | K |
| NotEl1gible/mcp-bitemporal-memory | NotEl1gible/mcp-bitemporal-memory | 0 | 2026-08-15 | MIT | Python | Pure-stdlib bitemporal MCP | K |
| openminion/sophiagraph | openminion/sophiagraph | 6 | 2026-11-06 | Apache-2.0 | Python | KG with provenance, trust, namespaces | K |

### 2.7 Other novel, benchmarks and reference

| Name | URL | Stars | Pushed | Licence | Lang | One line | By |
|---|---|---|---|---|---|---|---|
| rzhub/GateMem | rzhub/GateMem | 136 | 2026-10-12 | MIT | Python | Benchmark already ported; pin matches upstream HEAD [ignore] | K,R |

Notes: about 140 unique repos in the candidate list; dent8 appeared twice and caura and caura-memclaw are one product under two URLs. A few short-tail repos not deep-read (Ori-Mnemos, lethe, memorix, projectmem, talewell, memory-eternal, mind-mem) are flagged for a second pass in section 5.

## 3. Absorption specs

Only repos with verdict absorb or port-idea are specced; for each, only features worth a card are listed (low-value rows were dropped by the deep readers and are not repeated). "Has" = Engram already has it (G = grep found nothing; P = partial). Paths are in the source repo; Engram targets are under `packages/`.

### 3.1 joshuaswarren/remnic (MIT, TypeScript, absorb)
Licence read from root LICENSE. Check per-package licences under `packages/bench` before copying anything from there.

| Feature | How it works | Source files | Engram target | Mode | Effort | Value |
|---|---|---|---|---|---|---|
| Deterministic injection screen, weighted rules, threshold 4 quarantines, default and hardened profile | About ten rule families (imperative-to-agent, ignore-previous, authority-escalation, conditional trigger, encoded blob); ReDoS-bounded regex; Unicode whitespace normalised; findings carry rule and 180-char excerpt | `remnic-core/src/security/injection-screen.ts`, `audit-memory.ts` | `core/src/policy/injection-screen.ts`, gate step in `plane/write.ts`, lint `injection_signature` in `lint/det.ts` | copy | M | High |
| Origin classes and recall-time authority fence | Untrusted origin never gains user authority; recalled text quoted `> ` under a data-not-instructions header, delimiter lines escaped | `security/origin-authority.ts` | new `core/src/fence.ts`, used by mcp read, pi context handler, cli `--fenced` | copy | S | Med-high |
| Memory Worth: Laplace success rate with decay, multiplier p/0.5 | `p=(s+1)/(s+f+2)` after half-life decay; no data gives 0.5 and multiplier 1 | `memory-worth.ts`, `memory-worth-filter.ts`, `memory-worth-outcomes.ts` | `core/src/worth.ts`, `outcome` event kind, `worth` component in `retrieve.ts`; counts projected from events, never mutable fields | port | M | High |
| TrustScore blend of eight signals, bands, quarantine band | Weights normalised over present signals; absent signals drop out | `trust-score.ts`, `trust-zones.ts` | `core/src/trust.ts`, component in `retrieve.ts` and `read-reason.ts` | port (structure only; weights untuned) | M | Med-high |
| Tombstone store, non-resurrection at the persist chokepoint | Content hash of corrected, superseded or retracted fact recorded per namespace; a write with a live tombstone lands pending_review; revocation re-allows | `lifecycle/tombstones.ts`, `storage/supersession-audit.ts` | gate step in `plane/write.ts` over retired-hash projection per scope; reason `resurrection:<id>`; new invariant | port | M | High |
| Cycle-safe supersession head resolver | Walk to head, typed error on unknown id, cycle, depth over 32; fork resolves to smallest successor | `shared-context/supersession-chain.ts`, `authority-precedence.ts` | `core/src/supersede.ts` used by `lint/det.ts` and `plane/read.ts` | copy | S | Med |
| Recall-audit anomaly flags (repeat query, namespace walk, high cardinality, rapid fire) | Pure function over ordered read entries plus thresholds | `recall-audit-anomaly.ts` | read-behaviour lints in `lint/det.ts`; thresholds in policy | port | S | Med |
| AES-256-GCM sealed envelope, scrypt or Argon2id KDF with stored params | `[v1][salt16][iv12][tag16][ct]`, AAD optional | `secure-store/cipher.ts`, `kdf.ts` | `core/src/crypto/seal.ts` on `node:crypto` | port | L (design) | High for Twin |
| Quote-anchored extraction grounding | Verbatim whitespace-normalised substring, min 12 chars, content-word coverage 35 percent local and 75 percent source | `extraction-quote-grounding.ts`, `extraction-source-grounding-rules.ts` | lint `quote_not_in_source` in `lint/det.ts` | port | M | Med |
| Plan-then-apply correction flow with TTL and undo | Read-only plan with diff persisted 24 h; executor applies; undo via derived_from snapshots | `correction/*`, `consolidation-undo.ts` | `plane/correct.ts` plan and apply; undo as compensating events | idea | L | Med |
| Write rate limiter with reservations | Rolling window per principal; commit or release reservation | `write-rate-limiter.ts` | `policy/rate.ts` derived from log, not in-memory map | idea | S | Low-med |

### 3.2 OWASP/www-project-agent-memory-guard (Apache-2.0, Python, absorb)

| Feature | How it works | Source files | Engram target | Mode | Effort | Value |
|---|---|---|---|---|---|---|
| Content detectors: injection, persistence ("once stored", `[SYSTEM-MEMORY-PERSIST]`), privilege escalation, tool abuse, excessive autonomy | Regex lists over stringified value; severity maps to allow/quarantine/redact/block | `detectors/injection.py`, `memory_persistence_injection.py`, `privilege_escalation.py`, `tool_abuse.py`, `excessive_autonomy.py` | `core/src/policy/content.ts` (pure), rule `engram/write/content-injection`; policy `content_rules` block (schema PR) | port | M | High |
| Standing-directive detector, only for untrusted provenance | "from now on", "always recommend", "new payment details" fire only for external kinds | `detectors/standing_directive.py` | same module, conditioned on `provenance.kind` | port | S | High (poisoning arm) |
| AMSB corpus: 23 scenarios, canary survival after context reset, severity-weighted grade, benign-control penalty | Adapter has remember, recall, context_reset | `bench/scenarios.py`, `scoring.py`, `harness.py` | `fixtures/bench/amsb`, `packages/bench/src/amsb`; needs prereg line and PINS row | copy (data) | M | High for thesis, supplementary arm |
| Self-reinforcement loop detector | At least 3 agent writes in 60 s with 0.85 similarity; only non-agent writes decay it | `detectors/self_reinforcement.py` | rule in `policy/promotion.ts`: same-actor or model-kind confirmations never count; use log state and injected clock | idea | M | Med |
| Size and growth anomaly | Over 64 KiB or 10x growth | `detectors/anomaly.py` | `max_content_bytes` in policy | port | S | Low-med |
| Hardening lessons | Over-depth value treated as violation; detector exception emits error and fails closed; redaction failure blocks | tests `test_stringify_depth.py`, `test_detector_error_event.py` | tests plus reason `engram/write/content-error` | idea | S | Med |

### 3.3 coder-company/graphCTX (MIT, TypeScript, absorb)

| Feature | How it works | Source files | Engram target | Mode | Effort | Value |
|---|---|---|---|---|---|---|
| Secret scanner, 20 named regexes plus Shannon entropy, hex rule needs credential keyword nearby, redact to `[REDACTED:name]` | Refuse on write, drop on read | `src/security/secrets.ts`, `intake.ts`, `send-edge.ts` | `core/src/policy/secrets.ts` | copy | S | High |
| Commit-anchored validity (valid_from_commit, valid_until_commit, patch-id equivalence, revert revalidation) with injected ancestry oracle | Sync predicate testable without git | `src/git/anchors.ts`, `dag.ts` | optional `anchor` field (schema PR), predicate in `core/src/visible.ts`, git layer in adapters or cli | port | M | High for harness story |
| Deterministic precedence and conflict resolver with winner and loser note, never-silent-LWW reconcile | Rank 0 to 8 by source; reconcile returns apply, partition, invalidate, disputed | `src/resolve/precedence.ts`, `conflicts.ts` | `core/src/plane/resolve.ts` mapped to provenance kinds | port | M | Med-high |
| Token-budgeted selection with omit reasons (max_cards, budget, redundant) | Must-include tiers, greedy admit, min of event cap, total cap, window fraction | `src/inject/budget.ts` | `core/src/plane/budget.ts`, `budget_tokens` on read | port | M | Med |
| Per-session anti-repetition ledger | Projection of read events keyed by session, TTL, open loops exempt | `src/inject/ledger.ts` | filter in `plane/` with reason `recently_delivered`, injected clock | port | S | Med |
| Perishable-fact verification (path gone, drop) | Injected existence check | `src/inject/staleness.ts` | lint `referent_missing` | port | S | Med |

### 3.4 thedotmack/claude-mem (Apache-2.0, TypeScript, absorb)

| Feature | How it works | Source files | Engram target | Mode | Effort | Value |
|---|---|---|---|---|---|---|
| About 45 secret patterns with bounded lookbehinds, size cap, per-name disable | Typed markers with counts | `src/utils/redaction.ts` | `core/src/policy/secrets.ts` (best table; keep SPDX and NOTICE) | copy | M | High |
| Balanced `<private>` and injected-context tag stripper, private prompt suppresses what follows | Linear-time nested scanner | `src/utils/tag-stripping.ts` | `core/src/privacy-tags.ts`, called by gate for model and user sources | copy | S | Med-high |
| Two-tier near-duplicate detection, IDF-weighted cosine with IDF veto on rare tokens | Tier 1 only emits a review candidate | `src/services/dedup/nearDuplicate.ts`, `idf.ts`, `idfVeto.ts` | precision guard for MinHash lint (MP-11) | port | M | Med |
| ACT-R base-level reinforcement ranking | `ln(1 + a^-0.5 + alpha*sum(r^-0.5))`, pinned newest rows | `src/services/reinforcement/strength.ts` | score component in `retrieve.ts`; prereg first | port | M | Med |
| Progressive disclosure (index, timeline, fetch ids) | Three-step MCP flow | `src/servers/mcp-server.ts` | mcp index mode, per-item fetch through `Plane.read` | idea | M | Med |
| Hook output budget (10,000 chars, silent stub beyond) | Drop most expensive part until it fits | `src/services/context/ContextBudget.ts` | mcp and hook fitter; dropped items logged `budget_dropped` | idea | S | Med |
| Durable hook spool, idempotent file per event | Key hashes session plus tool_use_id; order in body | `src/shared/hook-spool.ts` | hook spool drained into log, event id = key | port | M | Med |

### 3.5 28naem-del/mnemosyne (MIT, TypeScript, absorb; not the Gwendolenmave repo of the same name)

| Feature | How it works | Source files | Engram target | Mode | Effort | Value |
|---|---|---|---|---|---|---|
| Retrieval bisect, `ddmin` over visible records with cached-rank oracle and re-execution confirm; unconfirmed blame never reported as blame | Oracle A skips ids in a cached ranking; Oracle B rebuilds and reruns | `src/local/bisect.ts`, `src/evaluation/seeded-faults.ts` | `core/src/bisect.ts`, `engram bisect`, bench blame-precision | copy | M | High |
| Declared `dependencies`, `correct()` cascade, trust inherited downward, replay-exact as-of | Walk descendants, mark invalidated with cause | `src/local/index.ts` (`correct`, `#descendants`) | schema `depends_on`, `plane/cascade.ts`, lint `stale-dependency` | port | L | High |
| Co-use inference with Wilson lower bound, lift, support; rejection taxonomy; premise guard hold | Disjoint kinds so no cycle | `src/dependencies/index.ts` | Distill premise-edge proposals from read events | port | M | Med-high |
| Consolidation gate: replay on scratch copies, 11 invariants, signed hash-chained receipts | Failed invariant forces rollback even if outcome improves | `src/consolidation/gate.ts`, `invariants.ts`, `signing.ts` | Distill replay admission and no-trust-raise invariants | port | L | Med-high |
| State hash with versioned algorithm id and explicit exclusion list | Canonical stream | `src/local/replay.ts` | `core/src/replay.ts` `stateHash(cut)`, determinism invariant | port | S | Med |
| Ancestry-disjoint corroboration (rule M3) | Source and author nodes in ancestry; refused if active dependents | `src/local/index.ts` `promote` | `policy/promotion.ts` | port | S | Med |
| Retrieval ledger of rejected candidates per stage with config hash | Feeds bisect | `src/local/ledger.ts` | read event payload (scope-safe) | port | M | Med |
| Seeded byte-stable poisoning corpus with benign controls | 227 cases, regenerate equals committed file | `src/evaluation/poisoning/` | template for a bench arm | idea | M | Med |

Self-reported claims in its README (409/500 LongMemEval-S, 0 escapes) were not reproduced; do not cite.

### 3.6 Port-idea repos with a worthwhile item (one table)

| Repo (licence, lang) | Feature | Source files | Engram target | Mode | Effort | Value |
|---|---|---|---|---|---|---|
| ldclabs/anda-brain (Apache-2.0, Rust) | Dependent re-check after revision: cursor over superseded rows, bounded LIST DEPENDENTS, worklist not auto-stale | `settlement/mod.rs`, `space/metabolism.rs` | `stale-dependency` lint plus cursor (with GH-06) | port | M | High |
| ldclabs/anda-brain | Budgeted recall packet: required set fails closed as `insufficient`; request budget can only narrow the operator ceiling; coverage honest | `recall_budget/mod.rs` | `plane/read.ts` budget, `omitted`, `insufficient` | port | M | Med-high |
| ldclabs/anda-brain | Recall receipt with per-item content-digest pins; read does not reinforce (invariant) | `recall_receipt.rs` | read event pins; eighth invariant "read never changes projection" | port | S | Med |
| LE0-Lin/governed-memory (MIT, Python) | Snapshot-pinned dependency edges, transitive invalidation in one transaction, reason "dependency changed" | `dependencies.py`, `ledger.py` | GH-06 design source (pins parent version) | port | M | High |
| LE0-Lin/governed-memory | Immutability triggers on history tables, revision must bump by one | `constraints.py` | `db/migrate.ts` triggers on events | port | S | High |
| LE0-Lin/governed-memory | Optimistic review: decision carries candidate revision and fact-head revision | `ledger.py` | `plane/promote.ts` expected_version | port | S | Med |
| LE0-Lin/governed-memory | OpenLineage RunEvent mapping with high-water-mark export | `lineage.py` | `core/src/export/openlineage.ts`, `engram export lineage` | port | S | Med |
| ali-ulu/huqan (Apache-2.0, JS; enterprise dirs excluded) | Hash chain, per-chain genesis, fail-closed verifier, read-index cross-check for tail truncation | `lib/hash-chain.js`, `lib/receipt/receipt-chain.js` | refine MP-22 (see GH-07) | port | M | High |
| huqan | Portable receipt bundle spec, pinned canonical JSON, standalone Python verifier | `specs/huqan-trust-protocol/0.2/*` | `research/scripts/verify_bundle.py`, `engram export` | port | M | High |
| huqan | Emergency halt (record plus chain, integrity mismatch means stopped) and break-glass (can only relax review to allow) | `lib/emergency-stop*.js`, `lib/break-glass*.js` | `plane/halt.ts`, grant type `window` | port | M, S | Med-high |
| huqan | Self-checking canary tripwire (24 hex plus 8-hex domain-separated check, decodings) | `lib/context-canary.js` | `lint/canary.ts` and bench leak probe | port | S | Med |
| caura-ai/caura (Apache-2.0, Python) | Outcome propagation (+0.1, -0.15, +0.03, clamp 0.05 to 1.0) and six passive inference signals | `evolve_service.py`, `outcome_inference/*` | GH-12; signals computed from read events | port | M | High |
| caura | Trust-ranked contradiction resolution, nine actions, outranked author cannot overturn | `contradiction/resolution.py` | `policy/conflict.ts` | port | M | Med-high |
| caura | Weakest-source trust inheritance for derived rows | `source_trust.py` | distill and promote invariant | idea | S | Med |
| caura | Why-not-returned explainer naming the first removing stage; cross-scope reports not_found | `recall_explain.py` | `Plane.explainAbsence` | idea | S | Med-high |
| caura | Correction propagation to agents that read the old version | `memory_corrections.py` | recipients from read events | idea | M | Med |
| caura | 60-pattern PII table with Luhn, mod-97, entropy; offsets-only evidence | `common/governance/pii_patterns.py` | data for GH-01 | port (data, NOTICE) | M | High |
| Mimir (Apache-2.0, Rust) | Confidence decay by (memory kind, source kind) with 256-entry integer table, pinned and authoritative flags | `decay.rs`, `confidence.rs` | GH-13 | port | M | Med-high |
| Mimir | Data-only boundary markers on every recall plus adversarial corpus driving real path | `docs/sanitisation.md`, `tests/fixtures/adversarial_corpus.json` | GH-03, fixtures | port | S | High |
| Mimir | Per-source confidence ceiling | `source_kind.rs` | policy `confidence_ceiling` by kind | port | S | Med |
| Mimir | Log mirror with prefix-only push and destructive restore drill | `docs/bc-dr-restore.md` | `plane/mirror.ts`, `engram log push|pull|drill` | port | M | Med-high |
| Dataojitori/nocturne_memory (MIT, Python) | Net-delta review pool, first-touch-freeze, causal-anchor grouping, group rollback | `backend/db/snapshot.py`, `api/review.py` | GH-16 compensating-event revert, derived review view | idea | M | High |
| nocturne | Fuzzy unique-match patch (`old_string` with NFC, quote and dash folding, position map) | `backend/text_patch.py` | `core/src/text-patch.ts`, patch tool in mcp and pi | port | S | Med |
| nocturne | Stale-unread, oversize, crowded lints from read events | `system_views.py` | `lint/det.ts` | port | S | Med |
| zhangfengcdt/memoir (Apache-2.0, Python) | Per-type conflict strategy on key collision (replace, append, confidence-gated, reject with ConflictInfo) | `services/merge_policy.py` | policy write-collision rule | port | M | Med-high |
| memoir | Keyed state diff between two refs without moving HEAD | `services/branch_service.py` | `engram diff --from --to` | port | M | High |
| memoir | UserPromptSubmit recall gate and YAML prompt-harness cases | `plugins/claude-code/hooks/*`, `tests/prompt-harness` | GH-20 | port | S | Med |
| dolthub/dolt (Apache-2.0, Go) | Three-way item merge with convergent edits and pluggable merge policy; promote right distinct from write | `three_way_differ.go`, `branch_control/access.go` | `plane/merge.ts`, scope matrix right | port | M | Med-high |
| gastownhall/beads (MIT, Go) | Compare-and-set preconditions with typed conflict carrying actual value; remedy hint on denials; event journal tail | `claim.go`, `PROPOSAL-cas-conditional-update.md`, `internal/eventsjournal` | GH-09, `engram events tail` | port | M | High |
| OriginTrail/dkg (Apache-2.0, TS) | Sealed attestation stating what was and was not verified; RFC 6962 Merkle with domain separation; `min_trust` read parameter; policy hash on events | `assertion-seal.ts`, `crypto/merkle.ts`, `ccl-policy.ts` | GH-07, GH-32 | port | M | Med-high |
| MaxFreedomPollard/Compartment (Apache-2.0, Python) | Per-record data key wrapped under master key, record id as AAD, key destruction is erasure; anchored chain head and count; signed packs with trusted-key set | `crypto.py`, `audit.py`, `packs.py` | GH-31, GH-32 | port | M | High |
| KirtiRamchandani/memory.cpp (MIT, Rust) | Content-addressed read manifest and lock diff | `ledger.rs`, `lockfile.rs` | GH-11 | port | M | High |
| memory.cpp | Typed negative-memory reasons shown in explain; unknown-versus-fail freshness | `negative.rs`, `freshness.rs` | retire reason enum; lint state | port | M, S | Med |
| tigerless-labs/agent-memory (MIT, Python) | BM25 plus recency plus weight with RRF, admission before ranking; handle-restricted supersede for model writers; level reads | `core/search_index.py`, `core/reconcile.py` | GH-14, GH-25 | port | M | Med-high |
| TencentDB-Agent-Memory (MIT, TS) | Hashed per-user API keys with prefix, mask, expiry; `rrfMerge` 20 lines; capture-side sanitiser plus key-masking walker | `metadata/utils/user-key.ts`, `store/search-utils.ts`, `utils/sanitize.ts` | GH-28, GH-14 | copy | S | Med |
| TencentDB-Agent-Memory | Generation log with prompt hash; strict admission rubric; reverse proxy on model API | `memory-generation-log/*`, `MemoryProxy/*` | Distill log; proxy is an L idea | idea | M | Med |
| doobidoo/mcp-memory-service (Apache-2.0, Python) | Fourth adapter over REST; mutability triage; cascade ungrounded status | `web/api/memories.py`, `storage/source_retraction.py` | GH-19 | port | M | Med |
| modelcontextprotocol/servers memory (MIT/Apache mix, TS) | JSONL KG adapter with unreadable-line and unknown-field preservation; MCP resource | `src/memory/index.ts` | GH-19 | port | M | High (adoption) |
| EverMind-AI/EverOS (Apache-2.0, Python) | Failpoints; origin-time tombstones and run gate; do_not_record; read-only adapter for its file layout | `core/failpoints.py`, `purge_marks.py`, `infra/ome/gate.py` | GH-21, GH-05, GH-27, GH-19 | port | S, M | High |
| trailhq/Trail-Code (MIT, TS) | Secret scanner; `touches: path#Symbol` anchor staleness; save-time quality gate with fix-it reasons; always-follow needs the person's typed words | `notes/secrets.ts`, `notes/stale.ts`, `notes/note-gate.ts`, `notes/always-follow-gate.ts` | GH-01, GH-22, GH-26 | port | M | Med-high |
| breferrari/obsidian-mind (MIT, TS) | Write-time near-dup guard 0.6 title plus 0.4 body Jaccard, thresholds 0.75 and 0.35, facet gating; visibility-aware supersession fixpoint | `memory-similarity.ts`, `memory-recall.ts` | GH-18, GH-24 | port | M | Med-high |
| eugeniughelbur/obsidian-second-brain (MIT, Python) | `verify_quotes.py` gate for model-reported contradictions; secret redaction list; freshness lint | `scripts/verify_quotes.py`, `session_archive.py`, `freshness_lint.py` | GH-23, GH-01 | port | S | High |
| JingxuanC/causal-memory (Apache-2.0, Rust) | Population-level bias audit (polarity skew, zero-variance repeat, confidence drift); drift report; session parsers | `store/bias_audit.rs`, `drift.rs`, `session/claude.rs` | GH-26, GH-34 | port | M | Med-high |
| phenomenoner/openclaw-mem (MIT, Python) | Dry-run migration plan with row-count invariant; compare-and-restore rollback receipts; itemised exclusion records | `core/db.py`, `core/curation.py`, `pack_trace_v1.py` | GH-29, GH-16, GH-11 | port | S, M | Med |
| vectorize-io/hindsight (MIT, Python) | Secret and PII defense with fingerprinted hits, ASCII lookarounds for CJK, Luhn | `extensions/memory_defense.py` | GH-01 | port | M | High |
| MerakOsiris/memoryguard (MIT, Python) | Sensitive content table; bigram Dice near-dup; promotion with distinct sessions, dominance cap, negative veto, cooldown; idempotency with request fingerprint | `sensitive_content.py`, `rule_merge_policy.py`, `change_history.py` | GH-01, GH-18, GH-25, GH-09 | port | S, M | Med-high |
| HKUDS/MGP (MIT, Python) | Graded return modes with `redaction_info`; named retention lifetimes with `manual_review_required`; conformance profiles | `reference/policy/hook.py`, `spec/retention.md` | read degrade mode; retention vocabulary; adapter profiles | idea | M | Med |
| Scuttie/enterprise-shared-memory-poc (Apache-2.0, Python) | Frozen reason-code enum; metadata-then-browse; outcome credit; anti-scope plus negative replay case | `router/reason_codes.py`, `agentic/service.py`, `promotion/policy.py` | GH-15, GH-12, GH-34 | idea | M | Med |
| ratharo-gitty/agentledger (MIT, Python) | Read-set on every write plus BFS cascade quarantine | `engine.py` (`revert_cascade`) | GH-06 optional read_set | port | L | Med-high |
| alignment-farm/agentic-memory-fabric (MIT, Python) | Signed events with resolver and revocation; SBOM snapshot versus provenance slice export | `crypto.py`, `export.py` | GH-07, GH-33 | port | M, S | Med |
| memvid/memvid (Apache-2.0, Rust) | Sealed bundle with per-segment hashes; log doctor plan and report | `MV2_SPEC.md`, `memvid/doctor.rs` | GH-07 | idea | M | Med |
| DeusData/codebase-memory-mcp (MIT, C) | Identity-free content digest; MinHash plus LSH; fail-open advisory hook; cursor bound to graph generation | `store/store_content_digest.c`, `simhash/minhash.c`, `cli/hook_augment.c` | GH-18, GH-20, GH-15 | port | S | Med |
| mnemoverse/mcp-memory-server (MIT, TS) | `memory_feedback` (helped or misled by id) as a gated event | `src/tools.ts` | GH-12 | port | M | High |
| okf-memory/okf-agent-memory (MIT, Go) | BM25 with matched-on; governance level bound to code paths; `stale_after` with horizon; OKF import adapter | `pkg/okf/search.go`, `filter.go` | GH-14, GH-19, GH-26 | port | S | Med |
| neo4j-labs/agent-memory (Apache-2.0, Python) | Reasoning-trace schema, B-cubed F1 for duplicate lint evaluation | `memory/reasoning.py`, `core/metrics.py` | GH-34, GH-35 | port | S | Low-med |
| TiMEM (Apache-2.0 core, Python) | Windowed rollups with child ids, missing-rollup lint | `models/memory.py` | consolidation idea | idea | M | Low-med |
| ruvnet/RuVector (MIT, Rust) | Lineage-collapsed corroboration (count independent roots, downgrade-only) | `ruvector-agent-memory/src/arbitration.rs` | GH-25 | port | S | Med |
| memoryguard, Metaworkers, aetna000 and others | Unread beyond summaries; second pass in section 5 | | | | | |

Read-only reference (not specced further): GateMem (already ported at pin a983828; only an optional dataset validator `bench/eval/validator.py` to port, S), vestige, honcho, OpenViking, basic-memory, serena (section 5).

## 4. Itemised PR plans (deduplicated)

Suggested waves: W0 = before Gate C (13 December), only if trivially safe (docs, tests, research scripts, no core behaviour change); W1 = between Gate C and Gate D (24 January); W2 = after Gate D. Every card obeys AGENTS rules: one card per PR, schema changes alone (rule 5), no model call in core (rule 4), prereg before any new benchmark, method or statistic, a log entry per PR, no em dashes, new deps one line in `docs/deps.md`. "Master plan" refers to ids in `00-master-plan.md`; note that file's addenda reuse MP-61 to MP-66 numbers (the addendum for baselines has its own MP-62 to MP-65), so ids below are quoted with their addendum where ambiguous.

### GH-01 Write-gate secret and PII detectors with tiers
- Absorbs: claude-mem `src/utils/redaction.ts` (Apache-2.0, copy table, keep SPDX and NOTICE); graphCTX `src/security/secrets.ts` (MIT, entropy and hex-near-keyword rules); Hindsight `memory_defense.py` (MIT, ASCII lookarounds, fingerprints); caura `pii_patterns.py` (Apache-2.0, Luhn, mod-97, entropy); Trail-Code `notes/secrets.ts` (MIT, ReDoS-hardened); obsidian-second-brain IAM false-positive case.
- Engram files: `core/src/policy/secrets.ts`, gate step in `plane/write.ts`, det lint in `lint/det.ts`, `docs/deps.md` not needed (data only), NOTICE entries, fixtures under `fixtures/faults/`.
- Design: BLOCK (secret, PII) versus REVIEW (high entropy, source excerpt) tiers from Scuttie; deny reason names kind and offsets only (never the value) with a value fingerprint of first and last 4 characters; redaction changes the content hash, so default is refuse or route to candidate, redact only by policy.
- Effort M. Depends on: MP-14 (schema) then MP-15. Value: High. Risks: false positives on long hex (git shas), CJK adjacency, regex ReDoS; mitigate with bounded quantifiers and a corpus of benign controls.
- Acceptance: `make test-one T=packages/core/test/policy/secrets.test.ts`; fixture set with one secret per kind plus benign controls (shas, UUIDs, IAM action names) with golden reasons; `make test-invariants` still green; a fault class `secret-in-content` for H3.
- Wave W1. Master plan overlap: MP-14 and MP-15 already cover a guard. This card is an improvement of source: it replaces an unspecified pattern source with a verified table plus the tier design and validators. Recommend MP-15 take its patterns from here.

### GH-02 Deterministic injection screen and provenance-conditioned detectors
- Absorbs: Remnic `injection-screen.ts` (MIT, copy, strip Remnic tool names and CANARY terms); OWASP `injection.py`, `memory_persistence_injection.py`, `standing_directive.py` (Apache-2.0, port patterns); memory.cpp `poison.rs` scenarios (MIT, fixtures only); Trail-Code hold-words idea.
- Engram files: `core/src/policy/injection-screen.ts`, gate step `plane/write.ts`, policy `injection_screen: off|default|hardened` in `policy/load.ts`, lint `injection_signature`, fixtures.
- Notes: standing-directive and persistence rules apply only to external, tool, document, model and compaction kinds. Reported as a deterministic floor, never a defence (regexes are evadable). Fail closed on rule exception (OWASP lesson).
- Effort M. Depends on: MP-14 schema PR (new lint id and policy field need a schema_version bump, rule 5). Value: High. Risks: false quarantines hurt utility (measure with benign controls); English-only.
- Acceptance: unit tests per rule; corpus run (GH-04) shows escape rate and false-quarantine rate; `engram simulate` shows effect on a recorded workload.
- Wave W1. Master plan overlap: AB-SEC-3 injection classifier lint (model-based, after MP-28) is the heavier tier; this is its free deterministic tier. Not in the plan before; add as MP-15b.

### GH-03 Authority fence and data-only boundary on every read surface
- Absorbs: Remnic `security/origin-authority.ts` (MIT, copy `renderAuthorityFence`); Mimir `docs/sanitisation.md` boundary block (Apache-2.0, idea); graphCTX claim framing (MIT, idea); mnemoverse `safeInline` control, bidi and zero-width stripping (MIT, port).
- Engram files: `core/src/fence.ts` (pure), calls in `packages/mcp` read output, `packages/pi-extension` context handler, `packages/cli read --fenced`; tests including a delimiter-escape case.
- Effort S. Depends on: none. Value: Med-high. Risks: changes MCP output shape; gate behind a flag so existing fixtures replay. Acceptance: tests show an item whose text contains the delimiter cannot close the block; MCP handshake fixtures updated alongside.
- Wave W1 (trivially safe candidate for late W0 if flag defaults off). Master plan overlap: none found.

### GH-04 Poisoning and content-guard benchmark arm (AMSB plus controls)
- Absorbs: OWASP AMSB scenarios (Apache-2.0, copy data with attribution); Mnemosyne seeded generator design (idea); Mimir adversarial corpus (idea).
- Engram files: `fixtures/bench/amsb/`, `packages/bench/src/amsb/`, `packages/bench/PINS.md` row, `docs/research/preregistration.md` entry first, `research/scripts/`, config, MANIFEST row.
- Effort M. Depends on: GH-01, GH-02 and a reviewed hypothesis (as MP-09). Value: High for thesis (cost side of content screens via benign controls). Risks: 23 scenarios is small; severity weights arbitrary; report as supplementary arm.
- Acceptance: `make bench BENCH=amsb` offline, byte-stable regeneration, escape and false-quarantine rates with Wilson intervals.
- Wave W1 after prereg review (not before Gate C). Overlap: MP-27 paired fault-injection arm for H3; this is complementary.

### GH-05 Tombstone non-resurrection, erase epoch and stale-work discard
- Absorbs: Remnic `lifecycle/tombstones.ts` (MIT, port); Honcho epoch counter (AGPL, idea only); EverOS `purge_marks.py`, `ome/gate.py` (Apache-2.0, port idea); inspeximus (MIT, idea).
- Engram files: `plane/write.ts` gate step over a per-scope retired-hash projection (from existing retire and supersede events), `plane/offboard.ts` erase-epoch check for queued model lints and Distill writes, new invariant in the invariants file, `engram/write/resurrection` reason, policy flag.
- Effort M. Depends on: none for the first half; scoped purge with confirm nonce is a later add. Value: High. Risks: legitimate re-adoption after correction needs a revocation event; tombstones must be scope-keyed so one scope's never blocks another.
- Acceptance: property test "a retired content hash is not re-admitted in its scope without a revocation"; two-handle test with an offboarding in between (extends E2.6).
- Wave W1. Overlap: MP-10 Quint spec of commit and erasure protocol should include this transition; MP-50 crypto-shred keeps the re-adoption refusal (decision 38a), same intent, so this card is the non-crypto enforcement. No contradiction.

### GH-06 `derived_from` edges, stale-dependency lint, logged cascade
- Absorbs: governed-memory `dependencies.py` and `ledger.py` (MIT, port: edges pin parent version, check at approval, transitive invalidation in one transaction, depth 32 and cycle guards); Mnemosyne `correct()` (MIT, port: trust inherited downward, replay-exact); anda-brain settlement cursor and bounded dependents (Apache-2.0, idea: reachability is topology, cycle decides); agentledger read-set (MIT, optional follow-up); caura weakest-source trust (idea).
- Engram files (three PRs): (a) schema PR alone: `derived_from: [{item_id, version, source_ref}]` in `schema.ts`, migration, `make api`; (b) `lint/det.ts` `stale-dependency` plus `plane/cascade.ts` emitting one retire event per dependent with reason `engram/cascade/premise-corrected`, bounded walk; (c) offboard and erase walk the reverse edges.
- Effort L total (S, M, M). Depends on: MP-14 merged first as per MP-65. Value: High. Risks: over-approximation if edges come from reads; start with declared edges and Distill-produced procedures only; cascade must respect scope (an edge may not reach into scopes the writer cannot read).
- Acceptance: eighth invariant "no active derived item outlives a retired or erased premise after a cascade"; fixture with a procedure mined from a corrected memory.
- Wave W2 schema group (a), W2 for (b) and (c). Master plan overlap: MP-65 (`derived_from` schema PR, baselines addendum) and MP-54 (authority ceiling on derived items). This card improves MP-65 by specifying version pinning and cascade-as-events, and MP-54's ceiling becomes the weakest-source rule. Merge GH-06(a) into MP-65 rather than opening a second schema PR.

### GH-07 Hash-chain refinements and portable verifier bundle
- Absorbs: huqan `hash-chain.js`, per-chain genesis, read-index cross-check, `specs/.../RECEIPT-BUNDLE.md`, `verify_bundle.py` (Apache-2.0, port; enterprise paths excluded); caura `audit_chain.py` canonicalisation lessons (UTC microsecond, integral floats to ints, one function for writer and verifier; port); Compartment head hash plus entry count anchor against tail truncation (port); DKG note: use RFC 6962 leaf and node prefixes, ordered leaves, never duplicate the last node.
- Engram files: refine `core/src/log/chain.ts` (from MP-22): anchor (head, count) in a meta row and signed checkpoints; `engram export --bundle` and `engram log verify`; `research/scripts/verify_bundle.py` standalone; test fixtures.
- Effort M. Depends on: MP-21 ADR and MP-22. Value: High (independent reproduction of the log is a thesis claim). Risks: interaction with erasure and content redaction (MP-21 settles by a side-table chain over a content-free skeleton); canonical JSON key order (UTF-16 code units).
- Acceptance: tamper test (edit, delete, truncate tail) all detected; Python verifier reproduces head hash from a bundle with no Engram code.
- Wave W1 as acceptance additions to MP-22, bundle in W2. Overlap: MP-21, MP-22, MP-43. The GitHub sources improve MP-22 on truncation detection and canonicalisation; they do not change its erasure-compatible design.

### GH-08 Store-enforced immutability on the event table
- Absorbs: governed-memory `constraints.py` (MIT, port): BEFORE UPDATE and BEFORE DELETE triggers for SQLite (RAISE ABORT) and Postgres (plpgsql).
- Engram files: `core/src/db/migrate.ts` (two dialect branches), test that UPDATE and DELETE abort, extend first invariant and E2.6 cross-handle test. Must allow the retention sweep path (events are never deleted today; verify) and any crypto-erasure content redaction (use a separate content table, per MP-21).
- Effort S. Depends on: MP-21 ADR decisions about what may be rewritten. Value: High, cheap. Risks: blocks legitimate redaction E9.7 unless redaction targets a side table.
- Acceptance: direct SQL `UPDATE events` aborts on both backends; replay unchanged. Wave W1 after MP-21.

### GH-09 Compare-and-set writes, review head-binding, idempotency key
- Absorbs: beads CAS proposal and typed conflict carrying actual state (MIT, port); governed-memory preview and decide with candidate and head revision (MIT, port); memoryguard idempotency key with request fingerprint (MIT, port); mnemoverse indeterminate-write wording (idea).
- Engram files: schema PR alone (optional `expected_version`, `idempotency_key` on the write request); `plane/write.ts`, `plane/commit.ts`, `plane/promote.ts`, review queue item gains head version; reason `stale-write` carrying the actual seq; MCP and CLI flags; `make api`.
- Effort M (S schema plus M logic). Depends on: none. Value: Med-high (multi-agent, MCP retries, two reviewers). Risks: a key reused with a different payload must be rejected, not replayed.
- Acceptance: new invariant "no write applies over a version the writer did not see"; counterexample test with two handles. Wave W2 schema group.

### GH-10 Retrieval bisect (ddmin blame finder)
- Absorbs: Mnemosyne `src/local/bisect.ts` (MIT, copy `ddmin`, `rankOracle`, `ablationClosure` about 100 pure lines, attribution; port re-execution oracle onto `Plane.read` with the core retrieval pipeline).
- Engram files: `core/src/bisect.ts`, `packages/cli` `engram bisect --task <file>`, tool in mcp, `packages/bench` seeded-fault blame precision, preregistration entry if used in a result.
- Effort M. Depends on: none (value rises with GH-11 candidate ledger). Value: High, novel. Risks: Oracle B must replay a log projection, not a SQLite snapshot; unconfirmed blame must never be reported as blame (keep that rule).
- Acceptance: on seeded faults, blame set equals the planted fault in at least the claimed fraction; deterministic output. Wave W1 for code, W2 for the bench claim.
- Master plan overlap: none.

### GH-11 Read manifest, itemised exclusions and why-not-returned
- Absorbs: memory.cpp `ledger.rs` and `lockfile.rs` (MIT, port: ordered ids, content hashes, policy_id, instant, diff of two reads); anda-brain recall receipt pins (idea); openclaw-mem exclusion receipts (idea, in-reach items only, ADR 0027 D5 keeps out-of-reach as count); caura `recall_explain.py` (Plane.explainAbsence, not_found for out-of-reach); Mnemosyne per-stage rejected-candidate ledger (scope-safe).
- Engram files: schema PR alone (`read_manifest` on read event; optional `excluded[]`), `plane/read.ts`, `read-reason.ts`, `engram diff-read`, `engram explain --absent`.
- Effort M. Depends on: schema group. Value: High (verifiable record of what the model saw; reproducibility claim). Risks: leaking out-of-reach item ids (never log them); size of events.
- Acceptance: replaying a read reproduces the manifest hash; `explain --absent` never distinguishes "forbidden" from "nonexistent" for a caller without reach.
- Wave W2. Overlap: MP-29 inspector provenance graph and version diff consumes this; no direct card.

### GH-12 Recall feedback and outcome events (Memory Worth)
- Absorbs: Remnic `memory-worth.ts` (MIT, port: Laplace success rate, decay, 0.5 prior); mnemoverse `memory_feedback` (MIT, port: helped or misled by id, gated by read reach); caura `evolve_service.py` and passive signals (Apache-2.0, idea: asymmetric deltas, repeat-recall, supersession and contradiction as failure, distinct-actor reuse); Scuttie outcome credit (idea: compute-only gain class).
- Engram files: schema PR (event kind `outcome` with item ids, actor, session); `core/src/worth.ts`, projection from events (never mutable fields); `worth` score component in `retrieve.ts` (off by default); mcp and pi tool; lint "repeatedly misled".
- Guards (missing in every source): an outcome write is a write, so the gate checks that the actor actually read the item (from read events), feedback never changes trust or confidence floors directly.
- Effort M. Depends on: schema group; prereg before any benchmark use. Value: High (closes loop to retention, promotion, Distill drift). Risks: feedback loops and poisoning via feedback; ranking change touches Part I, so opt-in only.
- Wave W2. Overlap: none directly; relates to MP-64 decay (baselines addendum) and utility eviction.

### GH-13 Deterministic decay with per-(kind, source) half-life and ceiling
- Absorbs: Mimir `decay.rs`, `confidence.rs` (Apache-2.0, port: integer 256-entry lookup for bit-identical results, pinned and authoritative skip, half-life 0 means none, stored confidence immutable); agentledger and AMF (idea); Mimir per-source confidence ceiling.
- Engram files: `core/src/policy/decay.ts`, read-side filter in `visible.ts`, component in `read-reason.ts`, policy `decay` and `confidence_ceiling` blocks, simulator comparison.
- Effort M. Depends on: ADR 0025 amendment. Value: Med-high. Risks: any float formula must be reproducible (use the integer table); prereg first.
- Wave W2. Overlap: MP-64 Governed decay `retention.decay` (baselines addendum). This source improves on it with determinism (integer table), a source-kind table and pinned items; fold into MP-64 rather than a parallel card.

### GH-14 Retrieval ranking components: BM25, RRF, usage and recency
- Absorbs: okf `pkg/okf/search.go` BM25 with matched-on (MIT, port); tigerless-labs `search_index.py` BM25 x weight x recency, eligibility before relevance (MIT, port); TencentDB `rrfMerge` (MIT, copy, 20 lines); claude-mem ACT-R reinforcement (Apache-2.0, port); graphCTX RRF plus MMR with content-key tiebreak (MIT, idea).
- Engram files: `plane/retrieve.ts` new named components under a new pipeline version so existing results reproduce (rule 9); ADR note on ADR 0009 per-item independence (corpus-level BM25 statistics break "a subset orders like the set"; fix statistics at read time or amend); preregistration entry.
- Effort M. Depends on: MP-38 (MiniSearch BM25 formula port). Value: Med. Risks: touches thesis-load-bearing retrieval, so versioned pipeline, off by default.
- Wave W2. Overlap: MP-38. Additions beyond it: RRF, matched-on explanation, and the independence caveat.

### GH-15 Token budget, coverage honesty, progressive disclosure
- Absorbs: anda-brain `recall_budget/mod.rs` (Apache-2.0, port: required set fails closed, ceiling only narrows); graphCTX `inject/budget.ts` (MIT, port: omit reasons); claude-mem hook 10,000-character limit and measure-and-drop (Apache-2.0, idea) plus index-then-fetch MCP flow; codebase-memory-mcp snapshot-bound cursor (idea); Scuttie metadata-then-browse.
- Engram files: `plane/read.ts` `budget_tokens` (caller-supplied counter, no tokenizer in core), `omitted` and `insufficient` in result, mcp index mode, hook fitter logging `budget_dropped`.
- Effort M. Depends on: GH-11 helpful. Value: Med. Risks: two-step reads create two read events, so tag each with its step (schema).
- Wave W2.

### GH-16 Governed revert, net-delta review and state diff
- Absorbs: nocturne `snapshot.py`, `review.py` (MIT, idea: first-touch-freeze, net-zero filter, causal grouping); openclaw-mem `rollback_optimize_assist` (idea: refuse if current hash differs from after-hash); memoir `diff_keys` (Apache-2.0, port); dolt diff (idea); governed-memory withdrawn-source fallback.
- Engram files: `plane/revert.ts` appending compensating events that pass the gate, each referencing the reverted event id and carrying before and after content hashes; `core/src/diff.ts` `diffProjections(a, b)` with causing event and reason; `engram diff`, `engram revert <event-id|--since>`; server route (then `make api`); inspector panel.
- Effort M. Depends on: none for diff; revert after GH-09. Value: High (demo: violation, human revert, log shows why). Risks: revert must be applied to the whole causal group (an eviction sweep, an offboarding), never one member.
- Wave W1 for `engram diff` (read-only), W2 for revert. Overlap: MP-29 inspector version diff, MP-42 policy diff (different object). 

### GH-17 Three-way item merge and merge-resolution policy
- Absorbs: dolt `three_way_differ.go` (Apache-2.0, port: classify base, left, right; convergent edits); memoir `merge_policy.py` strategies (port); graphCTX `reconcileWrite` outcomes (idea).
- Engram files: `plane/merge.ts` pure `mergeItem(base, left, right)`, policy rule class (prefer higher provenance kind, role over person, else conflict) with conflict events carrying reasons.
- Effort M. Depends on: GH-09. Value: Med. Wave W2 (after Gate D, handover and multi-writer).

### GH-18 Near-duplicate lint tiers and write-time duplicate decision
- Absorbs: codebase-memory-mcp MinHash and LSH (MIT, port, parameters unverified); claude-mem IDF cosine with IDF veto as the precision tier (Apache-2.0, port); obsidian-mind title-weighted Jaccard with thresholds 0.75 and 0.35 and facet gating (MIT, port); memoryguard bigram Dice (MIT, port); Mimir time-windowed dedup (idea).
- Engram files: `lint/det.ts` near-duplicate (the `LINT_THRESHOLD_KEYS` already reserves `near-duplicate`), optional write-gate decision `duplicate_of:<id>` using exact hash only.
- Effort M. Depends on: MP-11. Value: Med. Risks: prereg line and a precision and recall check on the fault catalogue before joining the preregistered lint set; ADR 0018 (no embeddings).
- Wave W1. Overlap: MP-11 MinHash lint and MP-41 semantic dup. Recommend MP-11 keep MinHash and take the IDF-veto precision tier from claude-mem as an acceptance criterion.

### GH-19 New adapters and importers
- Absorbs (priority order): modelcontextprotocol/servers `src/memory` JSONL adapter with unknown-field and unreadable-line preservation (port); EverOS memory-root read-only adapter (port); OKF bundle adapter (okf, port); mcp-memory-service REST adapter (port, carry own id map for content-hash identity); clean-room observation grammar parser for basic-memory and Obsidian vaults (format compatibility, no AGPL code); obsidian-second-brain sample vault as a fixture (MIT).
- Engram files: `packages/adapters/src/<name>/`, conformance on fakes, fixtures under `fixtures/stores/`, cli `--store` flag. Round-trip test that unknown content survives a governed write.
- Effort M each. Depends on: none. Value: High for the first (the default memory most Claude users run), medium for the rest. Wave W1 for mcp-memory (S-M, adapter only, no core change), W2 for the others. Overlap: master plan lists ING (ingestion) cards; check Mem0 and Letta adapter plan for the profile mechanism before starting.

### GH-20 Claude Code and Codex hook extensions
- Absorbs: codebase-memory-mcp fail-open advisory hook with 256 KB cap (MIT, idea; deny path stays fail-closed); Serena auto-approve only in acceptEdits and auto modes (GPL, idea only); obsidian-mind SessionStart compact re-injection (MIT, port); memoir deterministic UserPromptSubmit gate and YAML cases (port); claude-mem durable spool (port); obsidian-second-brain idempotent installer that merges and tracks its own command strings (idea).
- Engram files: `packages/mcp` hook modes, `engram hook install claude-code|codex`, `fixtures/harness/`.
- Effort M. Depends on: none. Value: Med. Wave W1 for installer and compact re-injection (no core), W2 for the rest.

### GH-21 Failpoints for crash-window tests
- Absorbs: EverOS `core/failpoints.py` (Apache-2.0, port about 60 lines): env-gated crash (exit 137), pause, skip, raise at a named step.
- Engram files: `core/src/failpoint.ts` used in `plane/commit.ts`, `plane/offboard.ts` and adapter delete paths; tests in `packages/core/test`, counterexamples for E2.6's store-then-log windows.
- Effort S. Depends on: none. Value: High (turns "random kills never hit the window" into deterministic tests). Risks: must be a no-op when the env var is unset; no behaviour change.
- Acceptance: tests that kill between "store written" and "event appended" and show recovery. Wave W0 candidate (tests plus an inert module).
- Overlap: MP-10 Quint spec of the protocol; failpoints are the executable counterpart.

### GH-22 Anchor-based staleness lint and commit-anchored validity
- Absorbs: Trail-Code `notes/stale.ts` (`touches` as path#Symbol, text-only check, path containment, MIT, port); graphCTX `git/anchors.ts` (MIT, port with injected ancestry oracle); memanchor (MIT, idea); stalebrain per-type half-lives (idea).
- Engram files: optional `anchor` field (schema PR), lint `anchor-gone` in `lint/det.ts`, resolver injected from the files adapter, predicate in `visible.ts`.
- Effort M. Depends on: schema group. Value: Med-high for the repo-scoped role memory story. Wave W2.

### GH-23 Quote-grounding for model lints and extraction
- Absorbs: obsidian-second-brain `scripts/verify_quotes.py` (MIT, port: exact after NFC and space collapse, minimum 12 chars, line number is only a hint, path containment); Remnic grounding thresholds (port); Trail-Code "every cited quote must appear" (idea).
- Engram files: extra `evidence` field in `LINT_SCHEMAS`, deterministic verify step in `lint/model.ts` that downgrades unverifiable flags to judgments; cassette fixtures under `fixtures/faults/model`.
- Effort S. Depends on: L3 variance data. Value: High (measurable precision delta in H3 lint-delta). Risks: must be added to the preregistration before any run.
- Wave W1 (code plus scripted-model tests), results after prereg review.

### GH-24 Supersession head resolver and visibility-aware supersession
- Absorbs: Remnic `supersession-chain.ts` (MIT, copy); obsidian-mind greatest-fixpoint `supersededOutOfReach` (MIT, idea).
- Engram files: `core/src/supersede.ts`, `visible.ts` pass, property test that a retired item is withheld only when a visible replacement exists, and that an out-of-reach replacement does not hide the old version incorrectly (or leak it).
- Effort S to M. Depends on: none. Value: Med-high as a correctness property. Wave W0 candidate for the property test only (test, no behaviour change), W1 for the code.

### GH-25 Promotion hardening
- Absorbs: Mnemosyne rule M3 ancestry-disjoint corroboration (MIT, port); RuVector lineage-collapse and downgrade-only (MIT, port); memoryguard diversity, dominance cap, negative veto, cooldown (idea); OWASP self-reinforcement (idea); caura weakest-source (idea); tigerless handle-restricted supersede for model writers (idea).
- Engram files: `policy/promotion.ts`, `plane/promote.ts`, oracle rules, ADR if the ceiling semantics change.
- Effort S to M. Depends on: GH-06 for ancestry. Value: Med. Wave W2. Overlap: MP-54 authority ceiling on derived items; fold weakest-source in there.

### GH-26 Population-level and read-behaviour lints
- Absorbs: causal-memory `bias_audit.rs` and `drift.rs` (Apache-2.0, port: polarity skew per tag, zero-variance repeat, confidence drift, weekly buckets); Remnic `recall-audit-anomaly.ts` (port); nocturne stale-unread, oversize, crowded (port); okf `stale_after` horizon (port).
- Engram files: `lint/det.ts`, thresholds in policy, `engram lint --drift`, inspector panel.
- Effort M. Depends on: prereg for thresholds. Value: Med-high. Wave W2.

### GH-27 Write-side consent: do-not-record and derivation opt-out (Twin)
- Absorbs: EverOS `do_not_record` with except carve-outs (Apache-2.0, port, deterministic enforcement); Honcho `observe_me` (AGPL, idea).
- Engram files: schema PR plus `policy/evaluate.ts` rule `engram/write/do-not-record`, Twin policy entry, explain line. Invariant: no allowed write matches an active opt-out.
- Effort M. Depends on: schema group. Value: High for Twin. Wave W2.

### GH-28 Server authentication before non-loopback
- Absorbs: TencentDB `user-key.ts` and `crypto.ts` (MIT, copy: prefixed keys for scanners, masked display, expiry, timingSafeEqual); Remnic per-token ops and namespaces with "absent means unrestricted, empty means none" (idea); governed-memory process-bound identity.
- Engram files: `packages/server` middleware, key store mapping key to actor and scopes, doctor refuses non-loopback without auth.
- Effort S to M. Depends on: decision to expose the server. Value: Low-med today. Wave W2.

### GH-29 Dry-run migration plan with row-count invariant
- Absorbs: openclaw-mem `core/db.py` (MIT, port). Files: `core/src/db/migrate.ts` `planMigrations`, `engram migrate --dry-run`. Effort S. Value: Med (schema bumps in W2). Wave W1.

### GH-30 Halt switch and break-glass window
- Absorbs: huqan `emergency-stop*.js`, `break-glass*.js` (Apache-2.0, port). Files: `plane/halt.ts`, grant type `window`, cli, MCP operator-only tool. Notes: halt is events in the chain, a mismatch fails to stopped; break-glass relaxes only an ask into allow, never a deny; lifting needs an operator decision. Effort M and S. Depends on: GH-07. Wave W2.

### GH-31 Crypto-erasure primitives
- Absorbs: Compartment per-record keys wrapped under a master key with record id as AAD and KDF parameter bounds (Apache-2.0, port design); Remnic `secure-store/cipher.ts` (MIT, copy, node:crypto AES-256-GCM, scrypt, no new dependency); okf vault envelope with version byte as AAD (idea); DKG per-recipient wrap (idea, not the ratchet).
- Engram files: `core/src/crypto/seal.ts`, key-provider interface; ADR first. Effort L (design) plus S (cipher). Value: High for Twin. Wave W2.
- Overlap: MP-50 Crypto-shredded erasure and MP-51 key-metadata schema PR. These sources improve MP-50 by supplying a tested cipher file (copy), the record-id AAD binding, and bounded KDF parameters.

### GH-32 Policy content hash and signed policy packs
- Absorbs: DKG content-addressed policy and approval binding (Apache-2.0, port); Compartment signed packs verified against operator-held trusted keys, never the pack's own key (port); huqan policy-seal (idea).
- Engram files: `policy_hash` already planned; add optional signature check in `policy/load.ts` and a `trusted_keys` setting. Effort S. Wave W2. Overlap: MP-43 policy_hash on events. This adds the signature half only.

### GH-33 OpenLineage and SBOM exports
- Absorbs: governed-memory `lineage.py` mapping (MIT, port); AMF `export.py` pair (snapshot of the sound set versus provenance slice, MIT, port). Files: pure mapping in `core/src/export/`, `engram export lineage|snapshot|log-slice`. Effort S. Wave W2.

### GH-34 Distill inputs and admission checks
- Absorbs: causal-memory Claude, Codex session parsers (Apache-2.0, port, verify against current session format); neo4j-labs trace, step, tool-call schema (idea); TencentDB strict admission rubric and generation log with prompt hash (idea); Scuttie anti-scope field with negative replay case that must be rejected (idea); Mnemosyne co-use inference (see 3.5).
- Files: `distill.ts`, `packages/mcp` parser, fixtures. Effort S to L. Depends on: master plan AWM induction card. Wave W2.

### GH-35 Test and bench hygiene
- Absorbs: Compartment `offline_guard.py` (idea: enforce ENGRAM_OFFLINE with socket, dns and fetch patch in test setup); Scuttie `hidden_call_audit.py` (idea: zero model calls from Mem0 adapter); neo4j B-cubed F1 for duplicate lint scoring (port, 30 lines); graphCTX p95 latency budget; GateMem dataset validator (port, S); EverOS-style failpoints in GH-21.
- Effort S each. Depends on: none. Wave W0 candidates for the offline guard and hidden-call audit (tests only), W1 for the rest. Overlap: MP-05 plane-overhead benchmark and latency budget.

## 5. Not absorbable (licence) but worth studying

| Repo | Licence | Why study it | Take only |
|---|---|---|---|
| plastic-labs/honcho | AGPL-3.0 | Derivation graph with reasoning levels, fail-closed derived items under narrowed reads, observe_me consent, erase epoch, per-run change history with replaced_by | Ideas in GH-05, GH-06, GH-27; no code, no dependency |
| volcengine/OpenViking | AGPL-3.0 | Tiered budgeted assembler (L0, L1, L2), hotness score, per-field merge operators (immutable, patch, sum), ovpack manifest | Ideas in GH-15 and a future per-class merge policy |
| basicmachines-co/basic-memory | AGPL-3.0, CLA | Observation and relation grammar, per-type schema notes with inference, authored valid-time qualifiers, file-borne lock checked against predecessor | Clean-room grammar for GH-19 (format is not copyrightable); schema lint idea |
| oraios/serena | GPL-3.0 (SolidLSP MIT) | Declared tool profiles by context and mode, permission-mode-aware hook auto-approve, dangling-link lint with repair suggestions | Ideas only; recipe that puts `.serena/memories` behind the files adapter and hook |
| samvallad33/vestige | AGPL-3.0 | FSRS decay with safety kernel | Related work |
| ZIZKA-AI-SL/ZizkaDB | AGPL-3.0 | Tamper-evident decision log with replay | Related work for GH-07 |
| JinHo-von-Choi/anchormind, fjwood69/mori, aureliocpr-ctrl/verimem | AGPL-3.0 | Fragment memory, governed MCP, verified memory with abstention | Related work |
| TiMEM-AI/TiMEM | Dual: core Apache-2.0, other paths MIT or unverified | Hierarchical windowed rollups with child links; much is placeholder code | Idea in a later consolidation card |
| LucieEveille/kiwi-mem, Gwendolenmave/mnemosyne, YourMemory | Unverified or "other" | Memory-as-OpenAI-proxy, policy-governed TS memory | Check LICENSE before reading deeper; do not copy |
| vanzan01/cursor-memory-bank | No licence declared | Memory-bank prompt structure | Do not copy |
| kody-hq/kody | NOASSERTION | Org, team and grants for agent memory on Workers | Look for a real LICENSE before any reuse |
| huqan `lib/saml`, `lib/oidc`, `lib/siem`, `lib/evidence-pack` | Proprietary enterprise licence | Evidence pack signature, SIEM export | Never copy; GH-07 ports only the Apache paths |
| modelcontextprotocol/servers | Mixed MIT and Apache, per-contribution | Default JSONL memory | Copy permitted, attribute both; ask a maintainer if a specific file's licence matters |

### Second-pass list (promising, not deep-read)
Ori-Mnemos (ACT-R, forget module with supersede, release, purge; Apache-2.0 TS), lethe and ForgetEval (MIT), memorix (Apache-2.0 TS, review-gated workspace and doctor), projectmem (MIT, precheck before edits), talewell (MIT, AMP protocol, provenance tainting, recall-driven promotion), memory-eternal (MIT), mind-mem (Apache-2.0, 107 MCP tools, audit chain, drift scan), dent8 (Apache-2.0 Rust, authority arbitration, entrenchment by independent sources, signed identity grants), mentisdb (MIT Rust, signed skill registry), agentic-memory-fabric gaps, agent-memory-benchmark and Metaworkers governedmemory. dent8 and mind-mem are the two most likely to add items to GH-06 and GH-25.

### Gaps in this sweep
Hindsight's separate agent-memory-benchmark repo was not read. memory.cpp, anda-brain and governed-memory were read from shallow clones, not run. Every star count and self-reported benchmark in the source READMEs is unverified. Where a deep reader marked an Engram gap by grep only, the gap should be confirmed against `plane/retrieve.ts`, `plane/read.ts` and `actor.ts` before the card opens (three readers flagged this explicitly: adapter-returned-id recheck, Principal reserved prefixes, known_at metadata leak).


## Addendum: the remaining 106 repositories

Scope note. The second sweep triaged 106 further repositories. Deep reads came back for the 64 repos below (each licence read from its LICENSE file; none of their code was run). The other 42 were skipped at triage, and their names were not carried in the data handed to this step, so they are counted here but not named. Stars are given only where the readers recorded them ("n/s" means not supplied). Three repos are AGPL-3.0 (verimem, mori, anchormind): ideas only, nothing may be copied, and the plans below restate their mechanisms in Engram's own words. "Mode" in the specs is copy (file or table copyable under a permitted licence), port (rewrite the logic in TypeScript or Python) or idea.

### A.1 Triage table

| Repo | Stars | Licence | Verdict | Reason |
|---|---|---|---|---|
| caura-ai/caura-memclaw | n/s | Apache-2.0 | deep-read and absorb | Sentinel procedure scan, untrusted-data wrapper, why-not-found explain, shadow basis-invalidation lint; same codebase as the caura repo already mined |
| iouxm10000/salience-ledger | n/s | Apache-2.0 | deep-read and port-idea | Fail-closed keyed conflict with human-only resolution, permanent-rejection record, pinned tier |
| AVIDS2/memorix | n/s | Apache-2.0 | deep-read and port-idea | Abstain as a recall outcome with reason codes, outcome signals driving quality, probation rule |
| riponcm/projectmem | n/s | MIT | deep-read and port-idea | Best concrete anchor-drift source (threshold, exemptions, one git call per file, UTC fix); pre-edit recall hook |
| ovitrac/memctl | n/s | MIT | deep-read and port-idea | Quarantine verdict, named content-scan patterns, MCP size and rate guards |
| oceanbase/powercontext | n/s | Apache-2.0 | deep-read and port-idea | Review lifecycle with versions, decision-policy shadow modes with adjudicated coverage, migration replay across backends |
| DanceNitra/inspeximus | n/s | MIT | deep-read and port-idea | Post-erasure residue scan, cross-target deletion manifest with independent re-check |
| tenurehq/tenure | n/s | MIT | deep-read and port-idea | Reverse index of reads per item, read shadow mode, encrypted export archive |
| mtrnix/metronix-memory | n/s | Apache-2.0 | deep-read and port-idea | Real-data contradiction fixtures with labels and look-alike near-misses |
| danielmarbach/mnemonic | n/s | Apache-2.0 | deep-read and port-idea | External-fact write predicate (git branch), read-only source guard at one choke point |
| veracium-ai/Veracium | n/s | MIT | deep-read and absorb | Unattested-write trust floor, source revocation planner, non-revival matrix, exercised-guarantees census |
| mozgsml/memgres | 1 | MIT | deep-read and port-idea | memory_blame, client-facing content-hash precondition, min-reader floor |
| CloudLLM-ai/mentisdb | n/s | MIT | deep-read and port-idea | Audience-scoped supersession (no leak by redirect), typed edges, correction audit |
| smaramwbc/statewave | n/s | Apache-2.0 | deep-read and port-idea | Policy snapshot per decision, read replay under a policy, signed-verifier taxonomy |
| RooAGI/Membrick | 11 | Apache-2.0 | deep-read and port-idea | Unlinked-supersession suggestion lint with negative-control audit catalogue; read-bound feedback |
| Uranid/mnem | 5 | Apache-2.0 | deep-read and port-idea | Counting invariant for recall, coded warnings, fuzzing and dual-run determinism |
| doronp/gitmemory | n/s | Apache-2.0 | deep-read and absorb | Session capture-completeness proof, hardened pi JSONL reader, two-tier credential scanner |
| liliang-cn/cortexdb | 529 | MIT | deep-read and port-idea | Five-value trust grade, min_grade read filter, cardinality-driven conflict, hook context-size rules |
| ClickHouse/loom | n/s | Apache-2.0 | deep-read and absorb | Cross-principal leakage suite, history-aware policy rules, SPRT revision gate, data-block fence |
| rahulsub/synapse-mem | n/s | MIT | deep-read and port-idea | Decision records with suspect propagation, known-at read, write-time clock bounds |
| star-ga/mind-mem | n/s | Apache-2.0 | deep-read and port-idea | Byte-stable hashing toolkit, maturity guard on eviction, recall attestation |
| Metaworkers-ai/governedmemory | n/s | MIT | deep-read and port-idea | Privileged-action gate over session evidence, purpose binding, AgentDojo harness |
| aetna000/atmem | n/s | Apache-2.0 | deep-read and port-idea | Shadow-to-active lifecycle with generation CAS and rollback, hash-chained flight verifier |
| saloni-garg/memfix | 1 | MIT | deep-read and port-idea | Adoption audit report shape and importer mappings; its 97.8 percent figure is not reproducible from its code |
| SaravananJaichandar/world-model-mcp | n/s | MIT | deep-read and absorb | RFC 6962 Merkle, epoch seal, ordered verifier with UNSIGNED verdict, tamper test matrix |
| RonaldSit/atelya | n/s | Apache-2.0 | deep-read and port-idea | External anchor ledger, digest-only chain with redaction records, post-purge hook contract |
| Nifty0x/memora | n/s | MIT | deep-read and port-idea | AuditEval generator and destructive-update baseline arm |
| klarlabs-studio/mnemos | n/s | MIT | deep-read and port-idea | Retraction with impact report and generations, source dependence, BrainHealth |
| ozgurcd/scrinium | n/s | MIT | deep-read and port-idea | Three-valued validation outcome, derived evidence grade, freshness binding |
| mustafa-bharmal-shipveho/brainstack | n/s | Apache-2.0 | deep-read and port-idea | Predicate-keyed bulk retraction with restore overlay, deterministic contradiction proposals |
| octoryn/octopus-blackboard | 8 | Apache-2.0 | deep-read and port-idea | Ed25519 helper, signed head checkpoints, head anchor and external anchor check |
| 9thLevelSoftware/Daem0n-MCP | n/s | MIT | deep-read and port-idea | Deny-with-remedy, single-use argument-bound confirmation token |
| jscott3201/aionforge-memory | n/s | MIT OR Apache-2.0 | deep-read and absorb | Cross-family guard, red-team report convention, erasure residency report, no-bypass identity gate |
| Die-Namic-Systems/Nestor | n/s | Apache-2.0 | deep-read and port-idea | Item seal with per-verifier keyring, rotated versus compromised revocation, mutation guard |
| mbeacom/adrkit | n/s | Apache-2.0 | deep-read and port-idea | ADR-to-code affects and marker scanner, observed-failing rule, cursor bound to a fingerprint |
| aureliocpr-ctrl/verimem | n/s | AGPL-3.0 | deep-read and port-idea (ideas only) | Admit-but-hold write outcome, deterministic unsupported-claim detectors, figure check |
| fjwood69/mori | n/s | AGPL-3.0 | deep-read and port-idea (ideas only) | Interference benchmark arm, per-read applicability narrowing, counts-only rule |
| JinHo-von-Choi/anchormind | n/s | AGPL-3.0-only | deep-read and port-idea (ideas only) | Session-unique lesson outcomes with contested rule, evidence status on recall |
| petabridge/memorizer | n/s | MIT | deep-read and port-idea | Tolerant argument coercion, owned-error backstop, correctable error messages |
| xyzzylabs/dent8 | 4 | Apache-2.0 OR MIT | deep-read and absorb | Trust-gated retire and rewrite (candidate invariant 8), retraction taint, adversarial corpus |
| Mnemowall/mnemowall-sdk | n/s | Apache-2.0 | deep-read and absorb | Confusable fold, session taint, sink and obfuscation signals, signed ledger, rollback through policy |
| openminion/sophiagraph | n/s | Apache-2.0 | deep-read and port-idea | Delegation grant with lineage, depth and budgets; narrowing-only child projection |
| asymptopialtd/nocetta | 1 | MIT | deep-read and port-idea | Best anchor and staleness reference; push-recall selector; plugin packaging |
| itpartypattaya/hermes-dreaming | n/s | MIT | deep-read and port-idea | Day-spread corroboration gate, loss guard, numbers veto on duplicates, wake gate |
| davccavalcante/gaptime | n/s | Apache-2.0 | deep-read and port-idea | Allen interval algebra, heal-on-retract property |
| caspianmoon/memoripy | n/s | Apache-2.0 | deep-read and port-idea | Re-ingestion write barrier, population audit with fail threshold, memory contracts |
| AskTheWay/dsh-auto-memory | n/s | MIT | deep-read and port-idea | Reversible owner hold state, tool-taint flag from host metadata |
| rinfa0108/openbrain | 5 | Apache-2.0 | deep-read and port-idea | Max-TTL with recorded decision, keyed value-hash conflict, idempotency reuse mismatch |
| NotEl1gible/mcp-bitemporal-memory | n/s | MIT | deep-read and port-idea | Belief-time fixture grid, single-clock baseline arm, negative-control MCP server |
| plur-ai/plur | n/s | Apache-2.0 | deep-read and absorb | Scan views, pattern tables, fail-closed truncation, recall rater, guarantee inventory, bite check |
| nexi-lab/nexus | n/s | Apache-2.0 | deep-read and port-idea | Severity-action table, lineage reverse index from read set |
| Goldentrii/AgentRecall-X | n/s | MIT | deep-read and port-idea | Evidence-tiered outcome semantics, local versus egress content guard tiers |
| mnemon-dev/mnemon | n/s | Apache-2.0 | deep-read and port-idea | gc suggest-then-keep, keyed receipt export |
| vasikmansuri/devmemory | 14 | MIT | deep-read and absorb | Copy-ready secret table, untrusted-data envelope, retrieval eval corpus |
| MemMachine/MemMachine | n/s | Apache-2.0 | deep-read and port-idea | Deferred reclaim sweep, backoff, proven-empty completion criterion |
| chenhz01/agent-memory-benchmark | n/s | Apache-2.0 (docs say MIT) | deep-read and port-idea | Mutation-audit discipline; NMR as a stale-read rate; marketing claims unsupported |
| huggingface/funes | n/s | Apache-2.0 | deep-read and port-idea | Egress secret gate on publish, turn format with deterministic ids; the converters repo has no licence |
| zjunlp/LightMem | n/s | MIT | deep-read and port-idea | Two-phase sleep-time consolidation, per-phase cost ledger |
| MystenLabs/walrus-memory | n/s | Apache-2.0 | deep-read and absorb | Copy-ready credential redactor with refuse outcomes, signed-request scheme, token-budget helper |
| AfridaMehanaz/memanchor | n/s | MIT | deep-read and port-idea | Cleanest file-anchor reference (null hash for absent file), confirm re-anchor |
| deeplethe/lethe | n/s | MIT | deep-read and absorb | ForgetEval generators and adversarial cases; signed purge receipt |
| mcncarl/agent-memory-vault | n/s | MIT | deep-read and port-idea | Write lease with fencing token, authority tier on recall, shadow cutover |
| veersaraf/forgetting-bench | 0 | MIT | deep-read and port-idea | Seeded drift workload and stale metrics; baselines |
| aayoawoyemi/Ori-Mnemos | n/s | Apache-2.0 | deep-read and port-idea | ForgetEval bridge, null-system floor, blast-radius cap |
| Ar9av/obsidian-wiki | n/s | MIT | deep-read and port-idea | Held-write staging with compare-and-swap, Stop-hook classifier |
| 42 further repos | n/s | n/s | skipped at triage | Names not carried into this step's data; no spec exists for them |

### A.2 Absorption specs

Only the features worth a card are kept. "Has": G = Engram has none (grep found nothing), P = partial. Targets are Engram paths.

#### caura-memclaw (Apache-2.0; NOTICE must be carried)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Sentinel procedure scan: prompt-injection, shell-injection, destructive, exfiltration checks with severity tiers | G | port | M | `core/src/lint/procedural.ts`, Distill candidate path |
| Untrusted-data wrapper (marker, rule preamble, neutralise, JSON-quoted records) | P | port | S | `core/src/prompt-data.ts` for the Distiller prompt |
| Why-not-found explain reusing the real predicates | P | port | M | `plane/read.ts`, `Plane.explainAbsent` |
| Basis invalidation as a shadow-mode model lint (batch per subject) | G | port | L | `lint/model.ts`, L3 and H3 configs |
| Rejected-candidate fingerprint with cooloff | G | port | M | `distill.ts`, `plane/promote.ts` |
| Writer-trust write hold with recorded reason | P | port | M | `policy/evaluate.ts` |
| Empty-result diagnostics (warn when the named scope or owner is unknown) | G | idea | S | `plane/read.ts` warnings |
| Evidence registry (claims.json with approved wording) | P | idea | M | `research/results/claims.json` plus lint-docs rule |

#### salience-ledger (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Fail-closed keyed conflict, resolution only by user confirmation | P | port | M | `lint/det.ts`, `policy/evaluate.ts`, schema PR |
| Permanent-rejection record keyed by content hash | P | port | S | `distill.ts`, `plane/promote.ts`, `content-hash.ts` |
| Non-evictable pinned tier with hard size budget | P | port | M | `plane/read.ts`, `policy/retention.ts` |
| Blocking records and completion gate | G | idea | M | MCP tool, Stop hook |

#### memorix (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Abstain as recall outcome with disposition and reason codes | G | port | M | new `plane/recall-plan.ts` |
| Outcome signals driving a derived quality state; review alone never raises quality | P | port | M | `core/src/quality.ts` |
| Probation that ends only on outside evidence | P | idea | M | `policy/promotion.ts` |
| Memory-quality gate and session-replay scorers (abstention accuracy, duplicate-show rate) | P | port | S | `packages/bench`, separate scorer |

#### projectmem (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Commit-count drift against the cited file (threshold 3, exemptions, file deleted is stronger, one git call per file, UTC fix) | G | port | M | `lint/det.ts` `anchor-drift` with injected git oracle |
| Recall-before-action PreToolUse hook with per-session dedup | P | port | M | `packages/mcp/src/hook.ts` `--recall` (governed read only) |
| Ten-row vendor secret table | P | copy | S | `policy/secrets.ts` seed |

#### memctl (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Quarantine verdict with non-injectable read state | G | idea | L | schema PR, `plane/read.ts` |
| 35 named content-scan patterns with bounded regexes | G | port | M | `lint/det.ts` |
| MCP guard (write size, per-minute budget, batch cap) and token-bucket limiter | P | port | M | `packages/mcp/src/server.ts` with core-side accounting |

#### powercontext (Apache-2.0; XNLI data is CC BY-NC, never reuse)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Candidate review lifecycle: revise, approve exact version, reject terminal | P | idea | M | `plane/promote.ts`, schema PR |
| Decision policy manifest: disabled, shadow, advisory, enforcing, with adjudicated or unadjudicated coverage | G | port | M | `lint/model.ts`, `policy/` |
| Calibrate-freeze-held-out protocol, unadjudicated charged to error | P | idea | S | prereg addendum |
| Content-free prepared-context receipt with identity-order invariant | P | idea | S | read event digests |
| Migration replay across backends with reflected schema inventories, fail on skip | P | port | M | `core/test/db/` |

#### inspeximus (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Post-erasure residue scan: LIVE, UNRECLAIMED, PLAIN outcomes, fail closed on skipped paths | G | port | M | `plane/erasure-verify.ts`, optional adapter `residue()` |
| Cross-target deletion manifest with independent re-check and truncation check | P | port | M | `plane/offboard.ts` `complete` verdict |
| Surviving-record scan for quoted erased text | P | port | S | `offboard.ts` `derived_mentions` |
| Correction-resurrection arm (verbatim and paraphrase) | P | idea | M | `packages/bench` after prereg |
| Supersession echo-check for code symbols in procedures | G | port | S | `lint/det.ts` |

#### tenure (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Reverse index: every read that returned item X | P | idea | S | `engram explain --item`, replay projection |
| Read shadow mode (run, log, do not act) | P | idea | M | `plane/read.ts` |
| Passphrase-encrypted export (scrypt plus AES-256-GCM, node:crypto) | G | port | S | `engram export` helper |

#### metronix-memory (Apache-2.0; OpenMemory-derived SimHash unlicensed, do not copy)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| FactConsolidation contradiction fixtures labelled conflict, same, other from 37 templates | P | port | M | `packages/bench/src/faults/`, H3 |
| Same-relation different-subject look-alike near-miss class | P | port | S | `fixtures/faults/model` |
| Candidate-recall ceiling reported apart from judge recall | P | idea | S | `h3_lint_delta.py` |
| Surface-parity authorization matrix | P | idea | M | e2e layer |

#### mnemonic (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| External-fact write predicate (protected branch) with deny or candidate | G | port | M | `policy/evaluate.ts`, `WriteContext` |
| Read-only source class refused at one choke point, every mutator enumerated in a test | P | idea | M | `policy/evaluate.ts` |
| Saved routing policy that an explicit tool argument cannot override | P | idea | S | `policy/load.ts` |

#### Veracium (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Unattested-write trust floor (plane/write.ts line 130 lets an absent source claim any kind) | P | idea | M | `plane/write.ts`, `actor.ts`, ADR |
| Source-keyed revocation: pure sweep for dry-run and commit, standing state, lift | G | port | L | `plane/revoke.ts` |
| Non-revival conformance over every combining operation, totality gate | P | port | M | `invariants.test.ts` |
| Exercised-guarantees census built from the event log | G | idea | M | test helper, `make test-census` |
| Targeted single-item redaction with receipt | P | port | M | `plane/redact.ts` |
| Deterministic grounding predicate and procedural capture gate | G | port | M | `lint/det.ts` |
| Migration step postconditions, refuse to open below head | P | idea | M | `db/migrate.ts` |
| Field-placement totality gate for schema fields | G | idea | S | schema test |
| Refusal harness arm with six outcome classes | P | idea | L | prereg, runner |

#### memgres (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| memory_blame and reconstruct-at-version with attribution from events | G | port | M | `plane/blame.ts`, CLI, inspector |
| Client-facing content-hash precondition (exact bytes, typed stale) | P | idea | S | `plane/write.ts` |
| Schema compatibility floor (min_reader_version) | G | port | S | `db/migrate.ts` |
| Injective row hash and per-row hash_version | G | idea | S | chain test case |
| Erase-completeness sweep checklist | P | idea | M | invariant |

#### mentisdb (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Audience-scoped supersession: hidden successor never reveals itself by redirect | G | port | M | `core/src/supersede.ts`, new invariant |
| Redirect carries replacement owner, provenance and cross-owner flag | P | port | M | explanation schema |
| Typed strong edges and weak contests edges, correction audit script | P | idea | M | lint, `research/scripts` |
| Bounded lineage depth refused at write | G | port | S | `plane/write.ts` |
| Prompt-text rule: one entry is one line, hidden characters visible | P | port | S | `core/src/fence.ts` |

#### statewave (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Policy snapshot or hash stored with each decision | P | idea | M | `policy/load.ts`, events |
| Replay a recorded read under a policy, id-keyed diff, typed refusals | P | port | M | `plane/simulate.ts` |
| Per-rule hit and never-fired report | G | idea | S | simulator |
| Signed-verifier verdict taxonomy (true, false, null with reason) | G | port | S | `verify.ts` |
| Keyed single-valued claim contradiction lint | G | idea | M | `lint/det.ts` |

#### Membrick (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Unlinked-supersession suggestion lint (suggest, never write) with correction cues, quote-aware, fail-closed unparseable cues | G | port | M | `lint/claims.ts`, `lint.ts` |
| Over-suppression audit catalogue (eight cases, six negatives) | P | idea | S | `fixtures/faults` |
| Per-document search feedback bound to a recorded read with nDCG and MRR | G | idea | M | `plane/feedback.ts`, schema PR |
| Incremental transcript cursor with stable turn-keyed ids | P | idea | M | Distill input |

#### mnem (Apache-2.0; Rust, ideas only)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Partition invariant: returned plus filtered plus cut equals candidates | P | idea | S | property test |
| Constants-only warning catalogue, capped at 8 | G | idea | S | `read-reason.ts` |
| `engram verify` and log-head digest | G | idea | M | CLI, doctor |
| fast-check fuzzing of shell parser, adoption and policy YAML; dual-run determinism | P | idea | M | `core/test` |

#### gitmemory (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Session capture-completeness proof by byte-range tiling | G | port | M | `core/src/session-integrity.ts` |
| Prefix-hash divergence means a new generation | G | idea | S | session reader |
| Hardened pi JSONL reader (header id namespace, role only under message.role, counted skips) | P | port | S | `pi-extension/src/replay.ts` |
| Two-tier credential scanner with seam scan and masked findings | P | port | S | `lint/secrets.ts` |
| Compaction-boundary checkpoint hook | G | idea | M | `packages/mcp/src/hook.ts` |

#### cortexdb (MIT; Go, ideas only)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Closed five-value trust grade beside the producer's own word | P | port | M | derived `core/src/trust.ts` |
| min_grade read filter and unverified labelling | G | port | S | `plane/read.ts` |
| Contract tally with untagged and unknown buckets, capped needs-attention list | G | port | S | server route, UI |
| Cardinality-declared single-valued deterministic supersession; inverted and overlapping validity lints | G | port | M | `lint/det.ts` |
| Hook rules: 9000-character cut with visible count, per-session dedupe, situation query | G | port | S | `packages/mcp` |
| Deterministic number-and-term grounding check | G | port | M | `lint/det.ts` |
| Bounded time-directed model supersession with caps and abstain default | P | idea | M | `distill.ts` |

#### loom (Apache-2.0; ClickHouse)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Surface-wide cross-principal leakage suite with canaries and a closed exemption list | P | port | M | `server/test`, `mcp/test` |
| History-aware policy rules (formerly, count_within, not_since, breadth_within) with shadow per rule | G | port | L | `policy/history.ts` |
| SPRT revision gate, cost gate, strike quarantine for procedures | P | port | M | `policy/sequential.ts`, prereg |
| Data-block fence with content-derived HMAC id and confusable-folded tag neutralisation (JS, copyable) | P | copy | S | `pi-extension/src/tag.ts`, core helper |
| Governed-recall injection hook (UserPromptSubmit and PreToolUse additionalContext) | G | port | M | `packages/mcp` |
| Locks and pins that every automatic retirement re-checks | G | idea | M | schema PR |
| Delegation ceiling, fail-closed credential freshness, 401 versus 503 | G | idea | M | `server` auth |
| Recall credit only from readers that close the loop | G | idea | M | `policy/retention.ts` utility count |
| Sensitivity tiers with handling per tier, linear-time validators | P | port | M | `policy/` |

#### synapse-mem (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Decision and assumption records (rejected options, used versions) | G | port | L | schema PR |
| Suspect state with one-hop propagation and read-only at-risk view | G | port | M | `plane/cascade.ts` |
| Known-at read and invalidate versus retract versus supersede | P | port | M | `replay.ts`, `plane/read.ts` |
| Write-time clock bounds (future skew, backdate clamp, monotone stamp) | P | idea | S | `plane/write.ts`, `commit.ts` |
| Spool-then-drain PostToolUse capture | G | port | M | `packages/mcp` hook |
| Admission gate for standing rules (reason kinds, held with reason, auto-promote) | P | idea | M | `distill.ts` |

#### mind-mem (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Byte-stable hashing: versioned NUL-separated preimage, Q16.16 floats, length-prefixed served-set digest and run id | P | port | S | `core/src/preimage.ts` |
| Maturity and live-contradiction guard on eviction; PROTECTED class | G | port | M | `policy/retention.ts` |
| Recall attestation joined to a served ledger (closes finding P4-5) | P | idea | M | read event, `engram explain --replay` |
| Closed versioned slots changeable only through review | P | port | L | policy and schema |

#### governedmemory (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Privileged-action gate: deny a listed tool when any session evidence is untrusted, fail closed on empty | G | port | M | `policy/action-gate.ts`, `pi-extension` tool_call, hook |
| Purpose binding on read | G | idea | M | read matrix, schema PR |
| Runnable AgentDojo banking harness with native-defence comparison | P | idea | L | research script, prereg |
| Fail-closed tool-to-source mapping table | P | idea | S | `policy/load.ts`, doctor |
| Cascade purge preview and test shapes | G | idea | S | `plane/cascade.ts` |

#### atmem (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Live shadow mode for a candidate policy | P | port | M | `plane/shadow.ts` |
| Policy lifecycle states with generation CAS and activation receipts; rollback as a new generation | G | port | M | `policy/lifecycle.ts` |
| Hash-chained timeline with ordered verifier, run-level verdicts | G | port | M | `log/chain.ts` |
| Context disposition event per turn | P | idea | S | pi extension |

#### memfix (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Adoption audit report: one junk table per adopted store | P | idea | S | `engram audit` |
| Importer mappings for mem0 export, claude-mem SQLite, JSONL | P | idea | S | `adapters/import/` |
| Deterministic correction grammar with ambiguity refusal | G | idea | M | `core/src/correction.ts` |

#### world-model-mcp (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Epoch seal with chained roots and signed canonical payload | G | port | M | `log/epoch.ts` |
| RFC 6962 Merkle with inclusion and consistency proofs and shared vectors | G | port | S | `log/merkle.ts` |
| Offline verifier with ordered named checks and UNSIGNED verdict | G | port | M | `log/verify.ts` |
| Coverage rules, key pinning, content lock, tamper test matrix, streaming parity, fuzz smoke | G | port | S to M | `core/test`, `verify_bundle.py` |
| Tail truncation named as blind spot, closed by checkpoint plus consistency proof | G | idea | S | `log/checkpoint.ts` |

#### atelya (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| External witness ledger for the head, refuse to anchor on inconsistency | G | port | M | `log/anchor.ts` |
| Fail closed on unknown or forgotten anchor label | G | port | S | verify result |
| Digest-only chain with redaction records so the chain verifies across purges (answers MP-21) | G | port | M | `log/chain.ts` |
| Keyed digests for guessable content; HMAC erase marker | P | idea | S to M | `content-hash.ts`, `offboard.ts` |
| Post-purge hooks with ids and digests; erasure-reach check | P | port | M | `offboard.ts` |

#### memora (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| AuditEval seeded generator and scorer; destructive-update baseline | G | port | S to M | `packages/bench/src/audit-eval/` |
| Forward descendants query (taint trace) | P | idea | M | `items.ts` |
| Projection state hash after replay | P | idea | S | doctor, invariant |

#### mnemos (MIT; Go)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Retraction as append-only assertion with impact report, record-last ordering | P | port | M | `plane/retract.ts` |
| Un-retraction by generations restoring only unchanged beliefs | G | port | M | `plane/retract.ts` |
| Source dependence between items, closure walk, copies count as one | P | port | L | `plan/impact.ts` with GH-06 edges |
| BrainHealth: exact or sampled, `unknown` status, derived thresholds | G | port | M | `core/src/health.ts` |
| Append-only predictions with censoring, calibration, bounded credit | G | port | M | GH-12 events |

#### scrinium (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Three-valued validation (pass, fail, cannot_evaluate) | G | port | M | `policy/promotion.ts`, schema |
| Derived evidence grade, never caller-set | G | port | M | `policy/evidence.ts` |
| Freshness tri-state bound to input hash | P | port | M | `lint/det.ts` `stale-validation` |
| Assurance ceilings per validator | G | idea | S | Distill validators |

#### brainstack (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Predicate-keyed bulk retraction with restore overlay in a log outside rebuildable state | G | port | L | new op, ADR |
| Staging-only deterministic contradiction proposals (slot, predicate-value, condition overlap) | P | port | M | `lint/det.ts` |
| Declined candidates keep history, re-propose only when evidence changed | P | idea | M | `plane/queue.ts` |
| Truncate-then-renormalise sanitiser | G | port | S | `fence.ts` |

#### octopus-blackboard (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Ed25519 helper (56 lines, node:crypto) | G | copy | S | `log/sign.ts` |
| Signed head checkpoints with valid versus current and signed_through watermark | G | port | M | `log/checkpoint.ts` |
| Head anchor and external verifyAnchor (ok, truncated, altered) | G | port | S | `log/chain.ts` |

#### Daem0n-MCP (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Deny-with-remedy structured refusal | P | idea | M | MCP result, core remedy data |
| Argument-bound single-use 300 s confirmation token | G | port | M | `mcp/src/confirm.ts`, with human out-of-band variant (L) |
| Server `instructions` built from the active profile | G | idea | S | `mcp/src/server.ts` |

#### aionforge-memory (MIT OR Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Cross-family guard (pure verdict, vendor table, refuse or warn) | P | port | M | `core/src/model-family.ts` |
| Red-team probe report convention (denominator, naive baseline, ceiling, empty probe fails) | P | idea | S | prereg |
| Attested drift baseline; skips named, never guessed | P | idea | M | Distill drift |
| No-bypass identity gate script, negative and positive halves | P | port | S | `scripts/check-actor-gate.ts` |
| Erasure `residual_retention` report and honest-scope page | P | idea | S | `offboard.ts`, docs |
| Multi-parent survival in cascades | G | idea | S | GH-06 rule |

#### Nestor (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Item seal: serve a trusted item only if a signature verifies against a key the store does not hold | G | port | M | `core/src/seal.ts` |
| Per-verifier keyring with rotated versus compromised revocation; ed25519 verify-only, client signatures | G | port | M | `core/src/keyring.ts` |
| Two-scoped rejection; refusals never fail on authentication | P | port | M | `plane/read.ts`, event kind |
| Mutation guard (curated source mutants, frozen count) | G | port | M | `research/scripts/gate_mutation_audit.py` |
| Show-what-is-sealed check before approval | P | idea | S | promote |

#### adrkit (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| `affects` resolver and `@adr` marker scanner (window cut to a full line, fences, dedicated comment line) | G | port | M | `scripts/lib/adr-*.ts` |
| Observed-failing rule, examined counts, zero-scan guard | P | idea | S | `testing.md`, lint output |
| Cursor bound to a log head and a query hash | G | port | S | MCP and server paging |
| Stale-reference prose lint | G | port | M | `make lint-docs` |

#### verimem (AGPL-3.0; ideas only)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Admit-but-hold write outcome, recall-hidden, logged with deciding layer | G | idea | L | schema PR, ADR |
| Claim-without-evidence detectors with per-token evidence matching | G | idea | M | `lint/det.ts` |
| Lexical figure check with identifier and separator guards | G | idea | M | `lint/det.ts` |
| LIMITS.md convention | G | idea | S | `docs/limits.md` |

#### mori (AGPL-3.0; ideas only)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Cross-scope interference benchmark arm with teaser, count, nothing sub-arm | G | idea | M | prereg, `packages/bench` |
| Per-read applicability narrowing (subset of reachable scopes) | P | idea | M | `ReadQuery.scopes` |
| Counts-only rule for model-visible exclusions, pinned by test | P | idea | S | property test |
| Per-proposer open-review caps | G | idea | M | `policy/evaluate.ts` |
| Random-thinned control arm | G | idea | M | prereg |

#### anchormind (AGPL-3.0-only; ideas only)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Session-unique lesson outcomes with Beta reliability and two-regime contested rule | P | idea | M | `core/src/outcome.ts`, LIFECYCLE_TRIGGERS |
| Evidence status on recall (no_evidence, partial, conflicting, supported, uncovered terms) | G | idea | S | `plane/evidence.ts` |
| Already-seen dedupe stubs | G | idea | S | pi extension, MCP |
| Per-stage model egress default-deny | G | idea | M | policy, packages/model |
| RLS caveat (policies do not bind the owner without FORCE) | G | idea | L | GH-08 note |

#### memorizer (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Tolerant argument coercion before validation | G | port | S | `packages/mcp/src/coerce.ts` |
| Correctable error messages with a minimal valid call | P | port | S | `packages/mcp/src/errors.ts` |
| Owned-error backstop around the handler | G | port | S | `server.ts` |
| Tool-schema snapshot and required-param sweep | P | idea | S | `mcp/test` |
| Hybrid-search ADR with measured numbers (evidence for GH-14) | G | idea | M | docs |

#### dent8 (Apache-2.0 OR MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Trust-gated retire, evict and rewrite (proposed invariant 8, opt-in policy flag) | P | port | M | `policy/evaluate.ts`, `retention.ts`, invariants |
| Retraction taint as read-side derived property; cascade only on poisoning intent | P | port | S | `plane/taint.ts` after GH-06 edges |
| Signed source identity, grants with ceiling, persisted attestation | G | port | L | `core/src/identity/` |
| Grant history with entitled, unentitled, unknown | P | idea | M | doctor |
| Hash chain, signed tree heads, witness with typed monitor verdicts | G | port | M | `log/` |
| Adversarial corpus with computed verdicts, benign gate, frozen tally | P | idea | M | GH-04 template |
| Policy-counterfactual whatif (distrust a source) | P | idea | M | `plane/simulate.ts` |
| Exhaustive small-lattice test for the new invariant | P | idea | S | `core/test/property` |

#### mnemowall-sdk (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Origin-indexed confusable fold | P | port | S | `core/src/fold.ts`, `tag.ts` |
| Session taint as minimum trust over the context window | P | port | M | pi extension plus core pure min function |
| Provenance-conditioned sink signals (new registrable domain, image-beacon URLs) | G | port | M | `policy/signals.ts` |
| Obfuscation signal (tag characters, bidi, mixed-script words, decoded blobs) | P | port | S | `policy/obfuscation.ts` |
| Content-type escalation (claimed fact that reads as an instruction) | G | port | M | `policy/classify.ts` |
| Signed content-free ledger, JCS, pinned-key export verifier | G | port | M | `log/chain.ts` |
| Rollback through policy; incident query | G | port | M | `plane/revert.ts`, `plane/incident.ts` |
| Detached-signature policy with weakening delay and strict fallback | G | port | S | `policy/load.ts` |

#### sophiagraph (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Delegation grant with lineage, audience, depth, budgets, resolved per operation | G | port | L | `policy/delegation.ts`, schema PR |
| Child output handed back as parent-owned candidate | P | port | M | provenance extension, promote |
| Narrowing-only intersection and child projection with property test | G | port | M | `policy/delegation.ts`, invariants |
| Action journal with reuse-mismatch conflict | G | idea | M | write path |

#### nocetta (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| External-artifact anchors (AST path plus normalised hash, relocation fallback, ambiguity refusal) | P | port | L | `lint/det.ts`, injected locator |
| Dirtiness propagation walls and retcon worklist | G | idea | S | cascade |
| Passive citation signal and four-quadrant ledger | P | port | M | `core/src/worth.ts` |
| Pure push-recall selector with silence default | G | port | M | `plane/push.ts` |
| Plugin packaging with manifests and release check script | G | copy | M | `.claude-plugin/` |
| Store-root discovery with bare-parent refusal | G | port | S | CLI |
| MCP initialize `instructions` | G | port | S | `server.ts` |

#### hermes-dreaming (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Day-spread corroboration gate | P | port | M | `policy/promotion.ts` |
| Memory-loss guard (vanished or shrank, merged or reworded exempt) | G | port | M | `lint/det.ts` `content-loss` |
| Duplicate veto on numbers, names, order, substitution, polarity, with reasons | P | port | M | duplicate lint |
| Wake gate before model sweeps | G | idea | S | runner |
| Golden two-night regression | P | idea | S | fixtures |

#### gaptime (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Allen interval algebra over half-open windows | P | port | S | `core/src/validity.ts` |
| Heal-on-retract derived from the event log | P | idea | M | `supersede.ts` (erased content is never healed) |
| Window-aware overlapping-duplicate lint | G | idea | S | `lint/det.ts` |

#### memoripy (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Re-ingestion write barrier derived from read events | P | port | M | `policy/evaluate.ts` `engram/write/reingestion`, lint |
| QUARANTINE as a distinct write outcome | G | port | L | schema PR |
| Population audit with `--fail-on` and metrics block; retrieval dominance | P | port | S to M | `lint/`, CLI |
| Memory contracts: per-step `expect` on workloads | P | port | M | `simulate.ts`, `make test-contracts` |
| Unicode normalisation corpus for the content hash | P | idea | S | `content-hash.ts` tests |

#### dsh-auto-memory (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Reversible owner hold state, excluded from reads, kept and explainable | G | idea | L | schema PR, ADR |
| Tool-taint flag from host tool-event names, propagated from sub-agent, caps confidence | P | idea | M | `pi-extension/src/extension.ts`, hook |
| Aging lint anchored on creation, health board | P | idea | S | `lint/det.ts` |
| L0 spec shapes and capacity-versus-product reporting | P | port | S | invariants, prereg |

#### openbrain (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Max-TTL separate from default, deny or clamp with a recorded decision | P | port | M | `retention.ts`, schema PR |
| Policy constraints (max write bytes, max results) | G | port | S | `evaluate.ts` |
| Keyed memory with value-hash conflict | P | port | M | `lint/det.ts` |
| Write idempotency ledger with reuse-mismatch rejection | G | port | M | `plane/write.ts` |
| Cross-surface equivalence test | G | idea | S | e2e |

#### mcp-bitemporal-memory (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Known-at read | P | port | M | `replay.ts`, `read.ts` |
| Two-clock fixture grid with computed discriminating labels | G | idea | M | `research/scripts` |
| Single-clock baseline with silent-ignore counter | G | idea | S | runner arm |
| Gates that name what failure means, inverted gate | P | idea | S | scripts |
| Negative-control MCP server | G | idea | S | `mcp/test` |

#### plur (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Evasion-robust scan views (fold, percent-decode, JSON unescape) | G | port | S | `detect/views.ts` |
| Credential and infrastructure pattern tables with false-positive gates | G | port | M | `detect/patterns.ts` |
| Fail closed on scan truncation | G | port | S | detector result type |
| Per-scope sensitivity policy, tighten-only trust rule | P | port | M | scope policy |
| Single field classification enforced by `satisfies` | G | idea | S | `detect/fields.ts` |
| Pure recall outcome rater from the reply | G | port | M | `core/src/recall-outcome.ts` |
| Use receipt (activation, dormancy, foreign ids) | G | port | M | `lint/usage.ts` |
| PROV and ODRL views for one item | G | port | M | `explain/prov.ts` |
| Guarantee inventory anchored to tests; mutation bite check | G | port | M | `scripts/check-guarantees`, `invariant_bite.py` |
| Capability canary for silently blocked hooks | G | copy | S | doctor |
| Inversion scan | G | port | S | `lint/det.ts` |

#### nexus (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Severity table mapped to log, deny, ask | P | port | S | policy `content_screen` |
| Read set captured on write as lineage, recomputable from the log | P | port | M | `plane/write.ts`, schema PR |
| Lineage reverse index and one-query staleness | G | port | M | projection, lint |
| Audit-critical read must refuse if its event cannot be appended | P | idea | S | ADR |

#### AgentRecall-X (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Evidence-tiered outcomes: default unknown, heeded needs trigger evidence, one per day | G | port | M | `events.ts`, oracle |
| check-action pre-action matcher wired at hook level | P | port | M | `mcp/hook.ts`, MCP tool |
| Annotate-never-drop contradiction stage | P | port | S | read result |
| Two-tier content guard (local structural, egress statistical) | G | port | M | `lint/det.ts`, promotion |
| Transcript-based independent adjudication | G | idea | M | pi session reader |

#### mnemon (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Content-free per-event receipt with keyed hashes | P | port | S | `dogfood.ts`, CLI |
| gc suggest-then-keep with recorded keep event | P | port | M | `retention.ts`, CLI |
| Signed admission receipt separating transport ack from outcome | G | idea | L | federation design only |

#### devmemory (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| 17-pattern secret table with capture-group redaction and benign filter | G | copy | S | `policy/secrets.ts` |
| Reject versus redact policy mode | G | idea | S | `policy/load.ts` |
| Injection heuristics, flag on read | G | port | S | det lint |
| Untrusted-data envelope with delimiter neutraliser and token packing | G | port | S | `fence.ts` |
| Typed links with automatic same-key conflict edge | P | idea | M | GH-06 schema |
| Labelled retrieval eval corpus with floors | P | port | S | fixtures |
| Cross-scope isolation test including no existence oracle | P | idea | S | surface tests |

#### MemMachine (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Due-time deferred reclaim sweep | P | idea | M | `offboard.ts` second sweep event |
| Capped exponential backoff derived from deny events | P | idea | S | pure helper |
| Proven-empty completion criterion | P | idea | S | offboard report |
| Per-store consistency contract table | P | idea | S | architecture doc |

#### agent-memory-benchmark (Apache-2.0 text, MIT badge; ideas only)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Mutation-test the checker (frozen count, baseline must show the behaviour, replace string must match, mutant must load) | G | idea | M | gate mutation audit |
| NMR as a stale-read rate over the log | P | idea | S | `dogfood.ts`, H1 column, prereg |
| Hash-chained log with replay-verify exit code (contract only, no algorithm) | G | idea | M | GH-07 |

#### funes (Apache-2.0; funes-integrations has no licence, read for shapes only)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Normalised turn format with coordinate-derived ids, whole-file reject | P | port | S | `distill/turns.ts` |
| Egress gate: rebuild whole blocks, redact in place under same ids, rescan, hold back, fail closed | G | port | M | `lint/egress.ts` |
| Governed publish with selection as decision and per-event allow, redact, hold | G | idea | L | `plane/publish.ts`, ADR |
| Capture hooks with catch-up sweep and stale-install notice | P | idea | M | `mcp/hook.ts` |
| Oneline recall and continuation offset | P | idea | S | MCP read, CLI |

#### LightMem (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Sleep-time consolidation as injected ModelCall emitting governed events | P | port | L | `consolidate.ts`, ADR, prereg |
| Per-phase token and call ledger | P | idea | S | `usage.jsonl` phase field |
| Cross-event summaries that never replace sources, with source ids | G | idea | M | GH-06 derived items |

#### walrus-memory (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Credential redactor with refuse outcomes, kinds-only reporting, ReDoS bounds, 1,359 test lines | G | copy | M | `policy/redact.ts`, rule `engram/write/credential` |
| Idempotency with request fingerprint and derived time-bucket key | G | idea | M | GH-09 |
| Signed-request scheme with nonce TTL and uniform failure | G | idea | M | `server` auth |
| Hook and consent trust cases (repo file or env cannot grant consent) | P | idea | S | hook tests |
| Token-budget helper (code-point aware) | G | copy | S | `retrieve.ts` |

#### memanchor (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Content-hash file anchors with null hash for absent file | G | port | M | `lint/det.ts` |
| Re-anchor by confirmation as a governed write | G | idea | S | event |
| Secret rule table, specific before generic, double-redaction guard | P | port | S | `secrets.ts` |

#### lethe (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| ForgetEval five-family generators with distractors | G | port | M | `packages/bench/src/forgeteval/` |
| Substring scoring rule with pass, fail, N/A, plus a residue scan | G | copy | S | scorer |
| 112 adversarial cases (prefix collision, identifier obfuscation, shared attribute, recursive supersession) | G | copy | M | `fixtures/forgeteval/` |
| Signed purge receipt, salted hash proof, two-tier verify | G | port | M | `core/src/receipt.ts` |
| Merkle root over a content-free skeleton, RFC 6962 prefixes | G | idea | M | `log/` |

#### agent-memory-vault (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Write lease with monotonic fencing token | G | idea | L | `plane/lease.ts`, schema PR |
| Read token binding, including create-if-absent | G | idea | M | GH-09 |
| Authority tier on recall (reference_only with reasons) | P | idea | M | explanation schema |
| Shadow then attested cutover | P | idea | M | policy modes |
| verified_at, review interval, external fingerprint binding | G | idea | M | schema PR |
| Stable denial codes with recovery and forbidden lists | P | idea | S | CLI, MCP |
| Adoption ledger with version identity and task_seen denominator | P | idea | M | events |

#### forgetting-bench (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Seeded drift workload with exact ground truth and hard-update fraction | G | port | M | `research/scripts/f1_drift_workload.py` |
| Stale contradiction and stale-context metrics | G | copy | S | research module |
| Bloat trace and baselines (keep-all, last-write-wins, decay) | P | idea | M | simulator comparison |

#### Ori-Mnemos (Apache-2.0)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| ForgetEval NDJSON bridge and null controls AMNESIAC and HOARDER | G | port | M | `packages/bench` |
| Vacuous-floor and discriminating-subset reporting | P | idea | S | stats layer |
| Blast-radius cap with dry run default | P | idea | S | retention, erasure |
| Anchored deterministic matcher for forget requests | G | port | M | `plane/forget.ts` |

#### obsidian-wiki (MIT)
| Feature | Has | Mode | Effort | Engram target |
|---|---|---|---|---|
| Held-write queue with compare-and-swap approval and pin-live-absent | P | port | M | `plane/held.ts`, CLI, MCP |
| Stop-hook classifier (substitution is mutating, redirect rules, re-entry guard) | P | port | M | `no-bypass/shell.ts`, hook |
| Playbook evidence scorer, no stacking, quiet means no rewrite | P | idea | M | Distill review |
| Pinned-fact unsupported-figure check | G | port | S | det lint |
| Volatile-field-excluded fingerprint for CAS | G | idea | S | `content-hash.ts` |

### A.3 New itemised PR plans (GH-36 onward)

Deduplicated against GH-01 to GH-35. Dependencies name existing plans. Waves follow the first report (W1 earliest). Nothing here may touch `packages/core` Part I behaviour by default: each change is opt-in by policy flag with its own schema PR where needed (rule 5), and any benchmark use needs a preregistration entry first.

### GH-36 Distiller prompt data wrapper and shared confusable fold
- Absorbs: caura-memclaw `common/llm/untrusted.py` (Apache-2.0, port; NOTICE carried); Mnemowall `core/forgery.py` and `read/wrap.py` (Apache-2.0, port the origin-indexed fold); loom `prompt-recall.mjs` (Apache-2.0, copy `foldForTag` and the confusables table); brainstack `recall/sanitize.py` (truncate then re-neutralise).
- Engram files: `core/src/prompt-data.ts`, `core/src/fold.ts`, `pi-extension/src/tag.ts`, MCP read output.
- Design: pure functions for neutralise, quote-one-line, fold with origin index; Distiller transcripts pass through them; tag.ts defuses any folded opener (closes the gap tag.ts documents); truncate before the final neutralise.
- Effort S. Depends on: none. Value: High. Risks: fold false positives on legitimate Greek or Cyrillic text; the fold is used only to detect, never to rewrite stored content.
- Acceptance: property tests (no output contains a marker except the wrapper's, one record stays on one line, homoglyph opener defused); `make test-one T=packages/core/test/unit/fold.test.ts`.
- Wave W1.

### GH-37 Procedure safety scan as a Distill admission lint
- Absorbs: caura-memclaw `sentinel_scan.py` (Apache-2.0, regex tables as data with NOTICE); nexus severity table idea; devmemory injection heuristics (MIT).
- Engram files: `core/src/lint/procedural.ts`, `distill.ts` admission, `policy/promotion.ts` (override with recorded reason), `fixtures/faults/`.
- Design: deterministic checks for shell injection, destructive commands, exfiltration and prompt-injection phrases in procedure text; critical findings hold the candidate, warnings only annotate; severity-to-action table (log, deny, ask) from policy.
- Effort M. Depends on: GH-34. Value: High (replay validation proves a procedure works, not that it is safe). Risks: English-only patterns, false positives on admin lines; mitigate with a benign corpus.
- Acceptance: corpus test with per-class flag and near-miss fixtures; a held candidate is released only by a user-sourced actor with a reason.
- Wave W2.

### GH-38 Trust-gated retire, evict and rewrite (proposed invariant 8)
- Absorbs: dent8 ADR 0011 and `state.rs` authority checks (design, Apache-2.0 OR MIT); mentisdb audience rules; Mnemowall rollback trust-at-version.
- Engram files: `core/src/policy/evaluate.ts` (deny `engram/write/downgrade`), `policy/retention.ts` (victim order and never evict a kind more trusted than the triggering writer), `plane/retention.ts`, policy flag `protect_trust` (schema PR), `core/test/property/invariants.test.ts`, `oracle.ts`.
- Design: no allowed write, eviction or retire by a source less trusted than an active item's kind changes or retires it, unless the owner acts as user or policy opts out. Default off so H1 and H3 do not move. Exhaustive 7 by 7 by op lattice test.
- Effort M. Depends on: none. Value: High (appears to close a real bypass: budget eviction ignores the victim's kind; rewrite lowers provenance). Risks: verify the bypass with a failing test first; interaction with preregistered conditions.
- Acceptance: counterexample test before the fix; `make test-invariants` includes the new rule; replay equality holds.
- Wave W1.

### GH-39 Unattested-write trust floor
- Absorbs: Veracium P2 (MIT, design); loom delegation notes.
- Engram files: `core/src/plane/write.ts` (line 130 provenance step), `actor.ts`, `mcp/src/server.ts`, `cli`, `pi-extension`; ADR.
- Design: an absent `actor.source` floors to the least trusted kind; each harness declares its own source; optional per-write declared content source caps trust; invariant that no committed item is more trusted than its actor's attested source.
- Effort M. Depends on: none. Value: High. Risks: library callers and fixtures that rely on claimed provenance; needs a fixtures sweep.
- Acceptance: a write with no source lands at the floor with a reason; invariant added to the always-on file.
- Wave W1.

### GH-40 Retraction with impact report, un-retraction, and source revocation
- Absorbs: mnemos ADR 0037 (MIT, design); Veracium `revocation_sweep.py` (MIT, pure planner port); brainstack `claim_overrides.py` (Apache-2.0, bulk predicate and restore overlay); dent8 ADR 0010 (taint rule: only retracted or erased sources taint).
- Engram files: `core/src/plane/retract.ts`, `plane/impact.ts`, new event op (schema PR), CLI `engram impact`, `engram retract --dry-run`.
- Design: one pure sweep serves dry run and commit; impact lists dependents in readable scopes (out-of-reach as a count); dependents with no other live independent support are retired by one event each; decisions and procedures are listed for review, never judged; record-last ordering; un-retraction restores only items still in the retraction's own last state; source revocation keyed by source identity with a derived standing set; erased content is never healed back (reconcile with GH-05).
- Effort L (slice 1, read-only `engram impact`, is S). Depends on: GH-06, GH-05. Value: High. Risks: over-approximation; keep surfacing as default and cascade as gated action.
- Acceptance: tests on a diamond, a cycle, a dangling edge, a doubly supported item; replay yields the same state; a lifted source does not restore an item another source still revokes.
- Wave W2 (slice 1 in W1).

### GH-41 Non-revival matrix and exercised-guarantees census
- Absorbs: Veracium spec 0023 and census (MIT, design); plur guarantee inventory (Apache-2.0, port the check script); dent8 exhaustive lattice test.
- Engram files: `core/test/property/invariants.test.ts`, `core/test/unit/plane/non-revival.test.ts`, registry of combining operations, `scripts/check-guarantees.mjs`, `make test-census`.
- Design: a table of every Plane operation that can combine or renew items (write, promote, adopt, retain, distill, compaction write, offboard handover, grants change) with a row for what happens to a retired item; totality fails the build when an operation lacks a row; a census collects every `policy_id` fired across the suite and lists rule ids never exercised.
- Effort M. Depends on: none. Value: High for Part I rigour. Risks: registry maintenance; keep the list generated from the Plane's exported operations.
- Acceptance: adding an operation without a row fails; census report committed under `research/results` with a MANIFEST row.
- Wave W1.

### GH-42 Three-valued validation, derived evidence grade, freshness binding
- Absorbs: scrinium `derive.go` and `validate.go` (MIT, design); mnemos canonical trust; memorix outcome tiers.
- Engram files: `policy/promotion.ts` (ValidationRecord gets passes, fails, cannot_evaluate, n_attempted, input_hash, valid_until), `core/src/policy/evidence.ts`, `lint/det.ts` `stale-validation`, schema PR.
- Design: cannot_evaluate never counts as a pass and demotes a prior pass to stale; grade (asserted, sourced, observed, verified, challenged) is a pure function of the log and `at`, never caller-set; model-judged validation capped at observed; a record whose input hash differs from the item's current hash is stale.
- Effort M. Depends on: GH-34. Value: High for Distill drift retirement. Risks: schema change touches promotion; prereg line needed before any result uses it.
- Acceptance: invariant that a record with cannot_evaluate runs never admits what k passes alone would not; fixtures for each class.
- Wave W2.

### GH-43 Distill live-use outcome projection and contested rule
- Absorbs: anchormind lesson outcomes (AGPL, idea only, no code read while writing); AgentRecall-X tiered outcomes (MIT); mnemos predictions and censoring (MIT); plur recall rater (Apache-2.0).
- Engram files: `core/src/outcome.ts` (pure projection), `LIFECYCLE_TRIGGERS` in `lint.ts` (`outcome-contested`), `core/src/recall-outcome.ts` (pure rater from the reply), schema PR for `outcome` event.
- Design: one row per (item, session), last write wins; reliability shown with its n; contested when helped at least 3 and failed above helped, or failed in 2 distinct sessions and above helped; default unknown, never default-positive; not_applicable excluded; an outcome from an actor with no read event for that item in that session is refused; censored predictions never move trust.
- Effort M. Depends on: GH-12. Value: High (ADR 0011 promises retirement on drift but has no live-use source). Risks: thresholds are proposed values; preregister and report sensitivity.
- Acceptance: replay builds the same projection; per-session uniqueness test; refused outcome without a prior read.
- Wave W3.

### GH-44 Cross-family model guard
- Absorbs: aionforge `cross_family.rs` and `guard.rs` (MIT OR Apache-2.0, port the verdict and vendor table).
- Engram files: `core/src/model-family.ts` (pure), `lint/model.ts`, `distill.ts`, policy key `model_guard: refuse|warn`, doctor check, reason ids `engram/lint/same-family`.
- Design: verdict Same, Differ or Unverifiable from the lint model and the writer's `Provenance.model`; Same or Unverifiable fires the guard; user and tool writers decided explicitly; one event per finding.
- Effort M. Depends on: none. Value: High (threat to validity for H3 and Distill). Risks: table needs an amendment rule; family of non-model writers.
- Acceptance: table test including prefix and hyphen-boundary cases; an invariant that a model lint never reads its own family's writes unless policy says warn.
- Wave W2.

### GH-45 Known-at (belief-time) read and fixture grid
- Absorbs: mcp-bitemporal-memory `reference.py` and `generate.py` (MIT, port the fold and the grid method); synapse-mem bi-temporal predicate (MIT, design); gaptime Allen helper (Apache-2.0, port over timestamp strings).
- Engram files: `core/src/replay.ts` (`itemsAtTime`), `plane/read.ts` (`known_at`), `core/src/validity.ts`, CLI `--known-at`, ADR amending 0005, `research/scripts/known_at_grid.py`.
- Design: a pure replay that appends no event claiming current access (records itself as a history read); grants and ttls re-judged as they stood; the grid is every entity by valid time by known-at point, labelled discriminating by computation and split by cause; a projection-only baseline arm reports a silent-ignore counter.
- Effort M. Depends on: none. Value: High. Risks: grant and ttl semantics at a past instant; ADR 0005 clamps access time to the head.
- Acceptance: property test that a read at (V, K) equals the read made at K when V was current; control rows pass 100 percent.
- Wave W2.

### GH-46 Why-not-found explain and empty-result warnings
- Absorbs: caura-memclaw `recall_explain.py` (Apache-2.0, design); mnem coded warnings (Apache-2.0, idea); mori counts-only rule (AGPL, idea).
- Engram files: `plane/read.ts`, `read-reason.ts`, `Plane.explainAbsent`, `engram explain --absent <id>`, `ReadResult.warnings`.
- Design: reuse the evaluate predicates, write no event; first removing stage named for reachable items; for out-of-reach items return the same answer as not found; coded constants-only warnings; test that no model-facing surface leaks ids of filtered items.
- Effort M. Depends on: GH-11 (shares manifest vocabulary). Value: High. Risks: must not become an existence oracle.
- Acceptance: for every item and policy in the simulator fixtures the named stage equals what `Plane.read` did; leak test over tag, MCP and hook output.
- Wave W2.

### GH-47 Abstain outcome and evidence status on recall
- Absorbs: memorix `governor.ts` (Apache-2.0, port the ladder); anchormind evidence bundle (AGPL, idea only); cortexdb min_grade rank order (MIT).
- Engram files: `plane/recall-plan.ts`, `ReadResult` fields `outcome` and per-item `disposition`, `evidence: {status, uncovered_terms}`, opt-in policy flag.
- Design: pure function after the read filter; reason codes stable; stopword list written fresh.
- Effort M. Depends on: GH-15. Value: High for explained recall and abstention items. Risks: changes read output shape (Part I); additive and opt-in.
- Acceptance: ladder exhausted by tests; replay with flag off is byte identical.
- Wave W3.

### GH-48 Signed erasure receipt and residue verification
- Absorbs: lethe `receipt.py` (MIT, port); inspeximus `erasure_residue.py` and `deletion_manifest.py` (MIT, port); atelya post-purge hooks (Apache-2.0); aionforge residual_retention (idea).
- Engram files: `core/src/receipt.ts`, `plane/erasure-verify.ts`, optional adapter `residue(values)`, `offboard.ts` report (`complete`, `residual_targets`, `derived_mentions`, `residual_retention`), CLI `engram erase --receipt`, `engram verify-receipt`.
- Design: Ed25519 over canonical JSON; per-receipt salt or HMAC for hashes; Merkle root over a content-free skeleton (RFC 6962 prefixes); verifier takes a trusted key set and returns unchecked, valid or invalid; fail closed on skipped paths and empty search; a coordinator re-reads bytes instead of believing the target; states what it cannot prove.
- Effort M to L. Depends on: GH-31, GH-07. Value: High (Twin erasure claim). Risks: key custody; WAL and git history residue (report it).
- Acceptance: demo on a throwaway store with tamper cases (edit, flip a hash, swap key, truncate tail) all detected.
- Wave W3.

### GH-49 Deferred second sweep and erasure reach across derived copies
- Absorbs: MemMachine purge design (Apache-2.0, idea); atelya (Apache-2.0).
- Engram files: `plane/offboard.ts`, pure backoff helper, adapter in-flight bound, policy window.
- Design: second sweep after a stated in-flight bound, recorded as another `engram/offboard/swept` event; attempt count and next time derived from deny events; completion is proven empty on re-listing; window must exceed the adapter's declared bound.
- Effort M. Depends on: GH-48. Value: Medium. Risks: bound is heuristic; say so.
- Acceptance: a write landing after the first sweep is removed by the second; injected clock tests.
- Wave W3.

### GH-50 Item seal and per-actor keyring
- Absorbs: Nestor `signing.py` and `keyring.py` (Apache-2.0, port); mnemowall ledger (Apache-2.0); octopus-blackboard `signing.ts` (Apache-2.0, copy).
- Engram files: `core/src/seal.ts`, `keyring.ts` (file load injected), `plane/read.ts` (unsealed trusted item treated as least trusted, with a lint), doctor posture report, policy `seal.require`.
- Design: sign `[item_id, scope, content_hash, kind, actor, policy_id]` with domain tags and scope binding; verify-only public keys so the server holds no private key; rotation versus compromise distinction; a signed log timestamp bound into the message so compromise can be time-bounded; Windows key-file caveat reported honestly.
- Effort L. Depends on: GH-07. Value: High (makes trust claims verifiable against a key the store does not hold). Risks: erasure interaction; keep signed content hashes only.
- Acceptance: invariant that no served trusted item lacks a valid seal when `require` is on.
- Wave W4.

### GH-51 Shadow mode and policy lifecycle
- Absorbs: atmem lifecycle and shadow (Apache-2.0, port); powercontext decision modes (Apache-2.0); agent-memory-vault cutover (MIT, idea); loom per-rule shadow (Apache-2.0); statewave policy snapshot (Apache-2.0).
- Engram files: `plane/shadow.ts`, `policy/lifecycle.ts`, policy `mode: shadow|enforce` per rule, policy hash on events, `engram policy shadow status`.
- Design: a shadow rule decides allow and appends a normal event with reason `shadow-would-deny:<rule>`; states draft, shadow, active, suspended, retired with generation compare-and-swap; rollback restores an earlier generation as a new one; activation needs a simulator report hashed into a receipt with expiry; unadjudicated is never counted as allow.
- Effort M. Depends on: GH-32. Value: High. Risks: a second evaluator on the hot path; keep opt-in.
- Acceptance: shadow counts equal the simulator's prediction on a recorded workload; stale generation refused.
- Wave W3.

### GH-52 Write lease with fencing token
- Absorbs: agent-memory-vault `agent_memory_intent.py` (MIT, idea).
- Engram files: schema PR for a `lease` event; `plane/lease.ts`; fence derived from the log projection; MCP tools; invariant "no write applies under a superseded fence".
- Design: one live lease per target; every transfer gets a strictly larger fence; lease expiry is a logged event.
- Effort L. Depends on: GH-09. Value: Medium-high for multi-agent claims. Risks: abandoned lease must not block a scope; TTL needs the clock.
- Acceptance: two-handle test with one winner and the late-wake case.
- Wave W4.

### GH-53 Privileged-action gate and session taint
- Absorbs: governedmemory `evaluator.py` and AgentDojo wrapper (MIT, port); Mnemowall `provenance.py` (Apache-2.0); dsh tool-taint flag (MIT, idea).
- Engram files: `policy/action-gate.ts` (pure), pi extension `tool_call` (tracks recalled ids and external tool use), MCP `engram_check_action`, Claude Code hook, policy `privileged_actions`, ADR, prereg line.
- Design: a listed tool is denied if any evidence in the session is non-trusted; empty evidence set fails closed; trust of a write is the minimum over the context window; taint propagates from sub-agent to parent; lowered only by eviction or compaction; a tool-to-source table where unknown tools default to external.
- Effort M. Depends on: GH-39. Value: High (blocks the consequence of a poisoned recall). Risks: over-blocking, harness cannot see the whole window on MCP.
- Acceptance: poisoned-recall scenario where the refund tool is denied; benign false-block rate reported.
- Wave W3.

### GH-54 Delegation grants for sub-agents
- Absorbs: sophiagraph `access/policy.py` (Apache-2.0, port the pure gate and narrowing); loom delegation ceiling (Apache-2.0, design).
- Engram files: `policy/delegation.ts`, `DelegationResolver` injected like ModelCall, schema PR, reason ids `engram/delegation/*`, property tests.
- Design: grant bound to audience, subject, parent and child run, depth and budgets; resolved on every operation; child output enters as a parent-owned proposal; narrowing-only intersection (empty means deny).
- Effort L. Depends on: GH-39, GH-09. Value: High for multi-agent Twin. Risks: mostly specified, not exercised, in the source.
- Acceptance: invariant that a child grant never widens scope, class, operations or budget; revoke-after-issue never yields a read.
- Wave W4.

### GH-55 Held-write queue and review lifecycle
- Absorbs: obsidian-wiki `staging.py` (MIT, port); powercontext RFC 0050 (Apache-2.0, idea); memclaw write hold (Apache-2.0).
- Engram files: `plane/held.ts`, `plane/queue.ts`, `promote.ts`, CLI `engram review list|approve|reject`, MCP tools, inspector Actions screen, schema PR.
- Design: an `ask` decision lands as held with base hash and content hash; approve and reject run in the write queue and refuse stale or newly appeared base; reject is terminal; revise creates a new version; a per-proposer cap on open items.
- Effort M. Depends on: GH-09. Value: High. Risks: schema change, ADR 0026 interaction.
- Acceptance: stale base refused; reviewer equals authenticated actor invariant.
- Wave W2.

### GH-56 ForgetEval arm with null floors
- Absorbs: lethe `bench/forgeteval` (MIT, generators and adversarial cases, copy with notice); Ori bridge and controls (Apache-2.0, port).
- Engram files: `packages/bench/src/forgeteval/`, `fixtures/forgeteval/`, `research/configs/forgeteval.json`, script and MANIFEST row, PINS row, preregistration amendment (first).
- Design: mutations by item id through Plane (supersede, retire, offboard, bi-temporal), final probe through `Plane.read`; scorer adds read leak and residue leak columns; every result reported with null-system floor and discriminating subset (AMNESIAC and HOARDER analogues).
- Effort M. Depends on: GH-05. Value: High. Risks: template cases alone are easy; adversarial layer needed.
- Acceptance: zero model calls, deterministic from the seed; Wilson intervals per family.
- Wave W3.

### GH-57 Gate mutation audit
- Absorbs: Nestor `mutation_guard.py` and agent-memory-benchmark `mutation_test.py` (ideas, Apache-2.0); plur `bite.py` (Apache-2.0).
- Engram files: `research/scripts/gate_mutation_audit.py`, config with frozen mutant count, patches under `fixtures/mutants/`, MANIFEST row.
- Design: each mutant is one exact substitution plus the single test that must fail; guards: baseline shows the behaviour, replace string matches, mutant loads, tree clean; survivors reported.
- Effort M. Depends on: none. Value: High for Part I. Risks: slow; run locally, not in CI.
- Acceptance: all seven invariants have at least one killed mutant; survivors listed.
- Wave W2.

### GH-58 Cross-surface leakage and parity suites
- Absorbs: loom `test_cross_principal_leakage.py` (Apache-2.0, port); openbrain parity tests (Apache-2.0, idea); devmemory isolation test (MIT).
- Engram files: `packages/server/test/leakage.test.ts`, `packages/mcp/test/leakage.test.ts`, parity test over CLI, HTTP and MCP.
- Design: canary nonces seeded through every write path; probe as non-member, expired grantee, former member; closed exemption list with stale-entry check; validation errors for a non-member equal those for a member; denied equals not found; one operation through three surfaces yields equal decision, reason, policy_id and event.
- Effort M. Depends on: none. Value: High (zero leak rate over the surface is a thesis figure). Risks: payload synthesis from schemas.
- Acceptance: new route without a probe or exemption fails.
- Wave W1.

### GH-59 Governed publish with egress gate
- Absorbs: funes `push.rs`, `scan.rs`, `chunk.rs` (Apache-2.0, port the algorithm); plur fail-closed truncation (Apache-2.0).
- Engram files: `core/src/lint/egress.ts` (injected Detector), `plane/publish.ts`, adapter export, CLI `engram publish`, ADR.
- Design: selection is the decision; per item allow, redact or hold with reason and policy_id; rebuild whole blocks, redact in place under the same ids, rescan, hold back on mismatch, fail closed if the scanner is missing; recipient is a scope or principal checked against the read matrix; do not depend on TruffleHog (reported AGPL).
- Effort L. Depends on: GH-01. Value: High. Risks: scope creep; keep a first slice with a local file target.
- Acceptance: no item leaves unless the actor may read it, the recipient may be shown it and the gate passed.
- Wave W4.

### GH-60 Keyed deterministic conflict and unlinked-supersession lints
- Absorbs: membrick `semantic_relations.rs` (Apache-2.0, port the cue grammar and fail-closed rule); salience-ledger (Apache-2.0); cortexdb cardinality (MIT); statewave claims; brainstack proposals; openbrain value hash; gaptime window overlap.
- Engram files: `lint/claims.ts`, `lint.ts` ids `unlinked-supersession`, `conflicting-assertion`, `inverted-validity`, `overlapping-validity`; policy key declarations; schema PR for an optional key (share the GH-06 schema PR).
- Design: suggest, never write; unknown schema means do nothing; unparseable cue never authorises; domain-scoped keys with a doc-unique fallback; negative-control catalogue (six of eight cases) as fixtures.
- Effort M. Depends on: GH-06 schema. Value: High (deterministic floor under the L3 contradiction lint, per H3's keyed split). Risks: precision; prereg first.
- Acceptance: precision measured on L2 fault set and benign controls before use.
- Wave W3.

### GH-61 Hold or quarantine write outcome
- Absorbs: verimem (AGPL, idea only), memoripy QUARANTINE (Apache-2.0), memctl verdict (MIT), dsh hold (MIT).
- Engram files: schema PR (status or reason), `plane/write.ts`, `visible.ts`, `engram review --held`, ADR.
- Design: a noisy detector can quarantine instead of deny, keeping evidence for review; held items hidden from reads by default; owner-only reversible hold distinct from retire; hold never leaks across scopes.
- Effort L. Depends on: GH-01, GH-02, GH-55. Value: Medium-high. Risks: replay and ADR 0025 interaction; decide whether candidate plus a reason tag is enough first.
- Acceptance: held item invisible to non-owner reads and absent from recall; replay rebuilds it.
- Wave W4.

### GH-62 Re-ingestion barrier
- Absorbs: memoripy `admission.py` and `audit.py` (Apache-2.0, port idea).
- Engram files: `policy/evaluate.ts` rule `engram/write/reingestion`, `plane/write.ts` window map from the actor's recent read events, det lint `reingested`, fault fixtures pair.
- Design: deny or candidate when the content hash equals an item this actor was just shown; derived from the log, not a caller flag.
- Effort M. Depends on: none (a schema PR for the window threshold). Value: High. Risks: legitimate edits of a recalled item; owner rewrite exempt.
- Acceptance: flag and near-miss fixtures; replay identical.
- Wave W2.

### GH-63 Population and usage lints
- Absorbs: memoripy audit, plur use receipt (Apache-2.0), cortexdb growth spike and churn (MIT), mnemos BrainHealth (MIT), mind-mem (Apache-2.0).
- Engram files: `lint/population.ts`, `lint/usage.ts`, `core/src/health.ts`, CLI `engram lint --fail-on --metrics`, `engram status`, inspector header.
- Design: retrieval dominance (share and minimum reads from policy), never-retrieved, growth spike with no-baseline guard, unknown status for empty denominators, exact below a size and seeded sample above, counts only reads the linting actor may see.
- Effort M. Depends on: GH-26. Value: Medium-high. Risks: thresholds are arbitrary; preregister.
- Acceptance: fixtures per class; health vitals move on seeded degradation.
- Wave W3.

### GH-64 Deterministic grounding and claim-without-evidence floor
- Absorbs: veracium `grounding.py` and `procedural_gate.py` (MIT, port); cortexdb `check_sources.go` (MIT, design); verimem detectors (AGPL, idea only); obsidian-wiki facts checker (MIT).
- Engram files: `lint/det.ts` `ungrounded-specifics`, `figure-not-in-source`, `unsupported-status-claim`; Distill admission pre-check.
- Design: figures and identifiers in a claim must occur in its cited source; identifier, version and separator guards; applicability by provenance kind; declare language limits.
- Effort M. Depends on: GH-23. Value: Medium-high (free floor under the model unsupported-claim lint). Risks: false refusals; prereg.
- Acceptance: precision on benign controls; per-class H3 stratum.
- Wave W3.

### GH-65 Hook lifecycle, capture, and plugin packaging
- Absorbs: nocetta hooks and `.claude-plugin` (MIT, copy manifests and release script); projectmem `edit_hook.py` (MIT); funes automation (Apache-2.0); obsidian-wiki Stop classifier (MIT); synapse spool (MIT); loom governed-recall hook (Apache-2.0).
- Engram files: `packages/mcp/src/hook.ts` (UserPromptSubmit, PostToolUse, Stop, SubagentStart, PreCompact), `engram hook install|uninstall|status`, `no-bypass/shell.ts`, `.claude-plugin/marketplace.json`, `make plugin-check`, ADR amending 0022.
- Design: every advisory hook is a governed read that logs a decision; deny paths stay fail closed, advisory paths fail open with a deadline; per-session and per-agent dedup; catch-up sweep; capability canary for silently blocked hooks; no default actor identity in the plugin.
- Effort L. Depends on: GH-20, GH-36. Value: High for adoption and the demo. Risks: injection vector, so GH-02 and GH-03 first.
- Acceptance: handshake fixtures for each event; install is idempotent; stale-install notice.
- Wave W3.

### GH-66 Session integrity and transcript importers
- Absorbs: gitmemory (Apache-2.0, port the manifest and reader); funes turn format (Apache-2.0, port; converters repo unlicensed, shapes only).
- Engram files: `core/src/session-integrity.ts`, `distill/turns.ts`, `pi-extension/src/replay.ts`, `cli/src/import/{claude-code,codex,pi}.ts`.
- Design: content hash, size, entry count and prefix hash with generation on rewrite; strict whole-file validation with counted skips, bounded line reader; coordinate-derived turn ids.
- Effort M. Depends on: GH-34. Value: Medium-high (cross-harness Distill). Risks: clean-room reimplementation of converters.
- Acceptance: fixtures for truncated tail, duplicate ids, header id collision.
- Wave W2.

### GH-67 ADR and claims hygiene tooling
- Absorbs: adrkit (Apache-2.0, port scanner and resolver); Veracium field totality and stale-reference ideas; memclaw claims registry (idea).
- Engram files: `scripts/lib/adr-affects.ts`, `scripts/check-adr-links.ts`, `scripts/check-stale-adrs.ts`, `research/results/claims.json` with lint, observed-failing and zero-scan rule in `docs/conventions/testing.md`, `docs/limits.md`.
- Effort M. Depends on: none. Value: Medium (process and thesis claims). Risks: header format migration.
- Acceptance: stale marker and dangling link fail `make lint-docs`; zero-scan fails.
- Wave W1.

### GH-68 Migration parity, postconditions and reader floor
- Absorbs: powercontext replay (Apache-2.0, port); Veracium postconditions (MIT); memgres `min_reader_version` (MIT).
- Engram files: `core/test/db/` inventory comparison across SQLite and embedded Postgres, `db/migrate.ts` (postcondition callback, refuse newer database), doctor message.
- Effort M. Depends on: GH-29. Value: Medium-high (thesis log integrity). Risks: dialect differences; no Docker.
- Acceptance: a skipped backend fails; interrupted-migration scenarios roll back.
- Wave W2.

### GH-69 MCP surface hardening
- Absorbs: memorizer `ToolArgumentGuard.cs` (MIT, port); daem0n covenant (MIT, idea); nocetta instructions (MIT); memclaw and memctl guards (Apache-2.0, MIT).
- Engram files: `packages/mcp/src/coerce.ts`, `errors.ts`, `confirm.ts`, `server.ts`, tool-schema snapshot and sweep tests, structured denial `{decision, reason_code, policy_id, remedy?}`, initialize `instructions`, size and rate guards with core-side accounting.
- Design: coerce types and empties only, never scope or content, never fill provenance; try/catch backstop that states whether anything was stored; single-use argument-bound confirmation for destructive tools, with the honest limit that the agent mints it unless a human releases it out of band.
- Effort M. Depends on: none. Value: Medium-high. Risks: coercion must not turn a refusal into a write.
- Acceptance: required-param sweep returns correctable results; no generic SDK error text.
- Wave W1.

### GH-70 Retention max-TTL, blast-radius cap, preview and keep
- Absorbs: openbrain `policy.rs` (Apache-2.0, port); mnemon `gc.go` (Apache-2.0, idea); Ori `forget.ts` (Apache-2.0, idea); mind-mem maturity guard (Apache-2.0).
- Engram files: `policy/retention.ts` (max_ttl with deny or clamp and a recorded reason; per-sweep item cap), `plane/retention.ts` (`retainPreview`, `keep`), CLI `--dry-run`, `engram keep`, schema PR.
- Design: dry run default in the CLI; a kept item exempt until a named time; held young items and live contradiction sides not evicted; immunity derived from the log, not constants.
- Effort M. Depends on: none. Value: Medium-high. Risks: ADR 0025 semantics; opt-in.
- Acceptance: property that preview then sweep retires exactly the previewed set; a kept item survives sweeps in replay.
- Wave W2.

### GH-71 Consolidation with governed model verdicts, and phase cost ledger
- Absorbs: LightMem `lightmem.py` and `prompts.py` (MIT, design); mnemos and cortexdb caps on bad model answers.
- Engram files: `core/src/consolidate.ts` (pure candidate queue), `plane/consolidate.ts` with injected ModelCall, `usage.jsonl` phase field and roll-up script, ADR, prereg.
- Design: model proposes, the write gate decides; newer wins on direct conflict only by date and cap per run; abstain default; a failure retires nothing; wake gate skips a sweep with no new events.
- Effort L. Depends on: GH-06, GH-51. Value: Medium-high. Risks: model-driven write; shadow first.
- Acceptance: scripted model replays with zero calls; per-phase cost table.
- Wave W4.

### GH-72 Policy snapshot and read replay
- Absorbs: statewave `receipts.py` and `replay.py` (Apache-2.0, design).
- Engram files: policy hash recorded per event (shared with GH-32), content-addressed policy table, `plane/simulate.ts` `readReplay`, CLI `--from-read`; query stored as opt-in text or hash.
- Design: typed unreplayable reasons; nested replay refused; diff keyed by item id, not rank.
- Effort M. Depends on: GH-32. Value: Medium-high. Risks: privacy of query text.
- Acceptance: re-deciding a past read under its stored policy reproduces the event.
- Wave W3.

### GH-73 Poisoning arms: interference and action outcome
- Absorbs: mori design (AGPL, idea only); governedmemory AgentDojo harness (MIT, design); dent8 corpus (Apache-2.0 OR MIT); aionforge probe convention (idea).
- Engram files: preregistration amendment first (exact test, not bootstrap, because perfect separation breaks intervals), `packages/bench`, fixtures, PINS rows.
- Design: foreign items placed in a scope the reader cannot reach (and a per-read applicability narrowing for reachable ones); sub-arm showing titles, a count or nothing; AgentDojo run with seeds and Wilson intervals and a native-defence comparison; benign controls, computed verdicts, frozen tally.
- Effort L. Depends on: GH-04. Value: High. Risks: single model and domain in the source; report utility cost too.
- Acceptance: deterministic scoring, zero judge calls for the interference arm.
- Wave W4.

### A.4 Better sources for existing plans

| Plan | Repo and what changes |
|---|---|
| GH-01 | walrus-memory `redaction.ts` is the stricter copy source (refuse versus redact, kinds-only reporting, ReDoS bounds, two-sided tests); plur adds scan views, truncation fail closed and masking; gitmemory HIGH and SUSPECT tiers with seam scan; devmemory seed table; AgentRecall-X says tier by surface (local structural, egress statistical); memanchor and nocetta add false-positive exclusions; mind-mem and brainstack add Unicode normalisation and placeholder allowlist; loom adds sensitivity tiers with handling and linear-time validators |
| GH-02 | caura-memclaw Sentinel gives procedure-text patterns and severity; mnemowall sink and obfuscation signals are the provenance-conditioned half; anchormind canonicalisation order and negation guards (idea only); AgentRecall-X and verimem argue against a phrase-level stripper |
| GH-03 | loom data-block fence (content-derived HMAC id, confusable fold, JS copy); caura-memclaw prompt wrapper; mentisdb one entry is one line; mnemowall visible hidden characters; plur and aionforge const shared with a drift test |
| GH-04 | dent8 corpus structure (computed verdicts, detect-only class, false-positive gate); governedmemory AgentDojo; mori interference arm; powercontext source-poisoning protocol; mnemowall pack caveat (self-written corpus is optimistic) |
| GH-05 | veracium source revocation and lift asymmetry; mnemos retraction; inspeximus residue evidence; lethe receipt; gaptime reconciliation (heal versus tombstone: erased content is never healed back) |
| GH-06 | dent8 taint design and gating on poisoning intent; synapse suspect with one-hop and at-risk view; nexus read-set derivation and reverse index; mnemos source dependence; aionforge multi-parent survival; cortexdb premise validation |
| GH-07 | world-model-mcp is the best verifier and tamper-matrix source; atelya external anchor ledger and digest-only chain with redaction; octopus-blackboard signed checkpoints; mind-mem preimage encoding and boundary witness; mnemowall export verifier |
| GH-08 | octopus-blackboard append-only triggers; anchormind RLS owner caveat; world-model-mcp trigger and concurrent append regression |
| GH-09 | vault read token and lease; walrus fingerprint and derived key; openbrain reuse mismatch; memgres exact-bytes precondition; scrinium no-op is unchanged; sophiagraph action journal; nestor and obsidian-wiki pin-live-absent |
| GH-10 | none |
| GH-11 | memorix reason-code vocabulary and abstain; powercontext content-free receipt; mori counts-only constraint; mind-mem served digest and run id; statewave diff envelope; verimem hidden-record disclosure |
| GH-12 | AgentRecall-X unknown-by-default tiers; anchormind per-session uniqueness and contested rule (idea only); mnemos predictions with censoring; loom recall credit rule; nocetta passive citation; membrick read-bound judgments |
| GH-13 | mnemos age-neutral trust and derived thresholds; synapse volatility classes and verification reset; Ori ACT-R closed form (log-derived only); mind-mem Q16.16 |
| GH-14 | memorizer hybrid-search ADR with measured numbers; mnem and mind-mem determinism notes |
| GH-15 | memorix token-budget deferral; mcp-bitemporal truncation harness (announced rate must be 1.0); cortexdb 9000-character cut with visible count; anchormind already-seen stubs; funes oneline and continuation offset |
| GH-16 | mnemowall rollback through policy and incident query; mnemos unretract guard; mnem op-diff test matrix; vault revert preflight |
| GH-17 | mnem conflict taxonomy and deterministic merge property; vault argues against auto-merge of long-term memory |
| GH-18 | hermes-dreaming veto on numbers, names, polarity; nocetta IDF containment with ambient-word filter; mentisdb writer-visible dedup |
| GH-19 | memfix importer mappings; funes and gitmemory transcript importers; memorix git importer (low priority) |
| GH-20 | projectmem pre-edit recall hook; nocetta and funes lifecycle; loom injection hook; walrus consent cases; adrkit advisory-versus-deny split; obsidian-wiki Stop classifier |
| GH-21 | metronix reclaim crash windows; mnemonic and vault recovery states |
| GH-22 | projectmem and nocetta (best mechanics), memanchor (cleanest anchor model, null hash), memorix (downstream behaviour), adrkit (marker staleness), mind-mem retention hold |
| GH-23 | veracium grounding predicate, cortexdb and verimem figure check |
| GH-24 | mentisdb audience-scoped supersession (new invariant), mcp-bitemporal known-at clause, gaptime heal-on-retract, nocetta write-time guards, synapse fork lint |
| GH-25 | dent8 and veracium trust gating; hermes-dreaming day spread; loom distinct supporters; aionforge reachable-threshold check; plur tighten-only scope policy; mind-mem protect dependents |
| GH-26 | memoripy dominance and re-ingestion; cortexdb growth and churn; loom exposure ledger; plur use receipt |
| GH-27 | cortexdb private tag and credential scrub |
| GH-28 | walrus signed requests; loom delegation ceiling and fail-closed freshness; anchormind key rotation and CIDR; mori fail-closed startup check and reserved names |
| GH-29 | powercontext replay, veracium postconditions, memgres reader floor |
| GH-30 | nexus bypass audit fields; atmem activation and rollback; loom account freeze |
| GH-31 | Nestor keyring and 0600 handling; mnemowall encrypted store and AAD binding; atelya keyed digests; tenure encrypted export |
| GH-32 | atmem lifecycle; mnemowall detached signature with weakening delay; funes sha256-pinned catalog and contract-version resolution; nestor |
| GH-33 | plur PROV and ODRL view; mori allowlist-by-default export; mnemon content-free receipt; sophiagraph review bundle |
| GH-34 | scrinium three-valued validation; hermes-dreaming admission; synapse admission gate; powercontext review inbox; projectmem anchor drift for retire-on-drift |
| GH-35 | vault bite and Nestor mutation guard; adrkit observed-failing rule; plur guarantee inventory; mcp-bitemporal gates and vacuity; dsh L0 shape; Ori null floors |
