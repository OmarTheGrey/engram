# The absorb research, 2026-11-21

The research behind `docs/tasks/absorb-plan.md`: what Engram could take from the state of the art and from open-source projects. It was done on 2026-11-21 at the lead's request, by research agents, with every repository's licence and activity checked against GitHub, npm or Hugging Face, and every plan checked against the code in this repository.

These files are research notes, kept as written. They are evidence for the plan, not commitments. The commitments are the thirty cards the plan names.

## How to read it

1. **`../../tasks/absorb-plan.md`** (outside this folder): the thirty pull requests the project commits to, each with why and how.
2. **`long-list.md`**: all 166 candidate plans, by wave, with ids `R-001` to `R-166`, and the sources that cannot be used as code.
3. **`00-master-plan.md`**: the first merge of the area studies (60 plans, ids `MP-*`), with its own ranking and decisions.
4. **`19-github-scout.md`**: the GitHub sweep. 152 repositories found, 109 read at source level, with absorption specs and plans `GH-01` to `GH-73`.
5. **The area studies**, each with plans `AB-<area>-<n>`:

| file | area |
|---|---|
| `01-stores.md` | memory stores and adapters |
| `02-policy.md` | policy engines and authorisation |
| `03-retrieval.md` | retrieval and ranking |
| `04-security.md` | poisoning, injection and content safety |
| `05-hygiene.md` | lints, duplicates, contradiction, supersession |
| `06-distill.md` | procedural memory and skill induction |
| `07-evalops.md` | evaluation, cassettes and reproducibility |
| `08-surfaces.md` | inspector, CLI, MCP and harness hooks |
| `09-twin-privacy.md` | personal memory, erasure and encryption |
| `10-eventlog-storage.md` | the event log and storage |
| `11-ingestion.md` | document ingestion |
| `12-frameworks.md` | agent frameworks and their memory seams |
| `13-compliance.md` | regulation and evidence |
| `14-competitors.md` | commercial and open competitors |
| `15-formal.md` | formal methods and testing |
| `16-frontier-sweep.md` | the newest papers |
| `17-performance.md` | performance |
| `18a-approval-workflow.md` | gap study: approval workflows |
| `18b-read-side-ifc.md` | gap study: information-flow control on reads |
| `18c-multi-agent-sharing.md` | gap study: sharing between agents |
| `18d-memory-system-baselines.md` | gap study: memory systems as baselines |

## What to keep in mind

- **Dates.** Stars, versions and activity are as of 2026-11-21. A card re-checks the licence at the commit it takes from (`docs/conventions/absorption.md`).
- **Claims about this repository's code** were checked by reading, not always by running. Card E2.7 exists because two of them need a test before anyone acts on them.
- **Ids differ by layer.** A plan may appear as `AB-SEC-4` in an area study, `MP-09` in the master plan and `R-001` in the long list. The long list's sources column joins them.
- **The literature notes** these studies draw on are in `docs/readings/litreview/`, which stays the source of truth for papers (PR #67).
- **Not selected does not mean rejected.** Section 7 of the plan says what was left out and why.
