---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.7
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - "make test-one T=packages/core/test/counterexamples/trust.test.ts"
  - packages/core/test/counterexamples/trust.test.ts
  - packages/core/src/policy/evaluate.ts
  - packages/pi-extension/src/extension.ts
  - packages/runner/src/gatemem-probe.ts
  - packages/bench/src/mem-inv-bench/plane.ts
  - packages/bench/src/faults/generate.ts
  - 'uv run python -I -c "import json,glob; print(max(len(json.loads(l)[''turns'']) for p in glob.glob(''.engram/upstream/gatemem/bench/data/*/episodes.jsonl'') for l in open(p, encoding=''utf8'') if l.strip()))"'
  - 'uv run python -I -c "import json; d=json.load(open(''.engram/upstream/longmemeval/data/longmemeval_s_cleaned.json'', encoding=''utf8'')); print(max(sum(len(s) for s in q[''haystack_sessions'']) for q in d))"'
supersedes: docs/log/2026-11-21-e2-7-finding-gh-38-lattice-confirmed.md
---

**What.** GH-38 holds under every registered preset, in team scope: a non-owner co-member rewrites or retires the owner's item at a less trusted kind, nobody else acting.

**Why.** The superseded entry showed it under a synthetic policy only.

**Result.** Medium and permissive: tool over user and document, import and document over user. Strict: tool retires a reviewed active user item (review only turns active into candidate), or rewrites it back into a candidate, hidden from reads. Person scope, all three: model over user. Grants stop non-owners; the grant rule refuses model, compaction and external content any grant.

**Consequence.** No registered number moves: the fix is opt-in; the GateMem guard (`gatemem-probe.ts:352-353`) covers ingestion only, but agents write only new ids (`extension.ts:156,378`); a GateMem session's own log holds at most 260 turns; LongMemEval at most 616 a question, both under strict's 1,000; MEM-INV-Bench has at most 3 sourced entries a case (`plane.ts:77-83`).
