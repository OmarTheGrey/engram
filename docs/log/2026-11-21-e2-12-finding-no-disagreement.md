---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.12
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/cedar.test.ts
  - "make test-one T=packages/core/test/property/cedar.test.ts"
supersedes: none
---

**What.** The Cedar engine and Engram's evaluator found no disagreement on any generated request in the claimed scope, modulo grants.

**Why.** ADR 0041 expected validity windows and time to disagree first; the lead asked for every disagreement to be reported.

**Result.** The committed test: 1,500 runs for each of six preset properties (reads, and writes as two Cedar requests) and 400 generated policies, at `seedFor(<test name>)`. A one-off run at 20,000 runs per preset property and 5,000 generated policies, seeds `seedFor(<test name>) + 7`, also passed: about 125,000 paired decisions. Every read and write check the export translates was reached more than 20 times, source isolation only under generated policies.

**Consequence.** No characterisation test is pinned, because none stands. The analyser card can start from the export.
