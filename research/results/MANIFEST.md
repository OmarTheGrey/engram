# Results manifest

One row per results file. A results file exists only if `research/scripts/<script>` regenerates it from `<config>`; `make test-repro` reruns each script and compares the sha256. Measurement entries in `docs/log/` must cite a file listed here, and `make thesis` rejects one whose hash does not match.
| file | config | script | commit | sha256 | figure |
|---|---|---|---|---|---|
| research/results/h1-gatemem-reach.json | research/configs/h1-gatemem-reach.json | research/scripts/h1_gatemem_reach.py | 00c606e | 9607555c3c9dcdee4917e10374c902589750ce0972a51f459c7294177792c4dd | none |
| research/results/h1-mem-inv-admission.json | research/configs/h1-mem-inv-admission.json | research/scripts/h1_mem_inv_admission.py | 00c606e | bed41bee4be4e3bb6bbf9f260b846626e3b57886d5672ccaa865b6443290ecab | none |
| research/results/h4-power.json | research/configs/h4-power.json | research/scripts/h4_power.py | 9a0d185 | 852a6776acf7dc3338c5b4fa5c1d65d64318c296464876c4b43b8e32e8c8bf53 | none |
| research/results/h1-c4-verdict-agreement.json | research/configs/h1-c4-verdict-agreement.json | research/scripts/h1_c4_verdict_agreement.py | 755c29d | 9335a67724db6405aa9a93ef90838869f597340ca0838a8945367a09305701f1 | none |
| research/results/h1-c4-walk.json | research/configs/h1-c4-walk.json | research/scripts/h1_c4_walk.py | 755c29d | 479f24192d83ec1a091dfc5b925073d79aefe1415d6171439ba74bb94fd6f8fa | none |
| research/results/h1-cost.json | research/configs/h1-cost.json | research/scripts/h1_cost.py | 755c29d | f147daf74c9bbec665b067ed0dc47eec97b25d5af7b8862ba582b0e7938c37fb | none |
| research/results/h4-holm-levels.json | research/configs/h4-holm-levels.json | research/scripts/h4_holm_levels.py | 9a0d185 | dcacf0c9ce70c8f6fd3055a6461ab542bdd51839dc0fea561e029372b7ed45d4 | none |
| research/results/h1-refusal-leaks.json | research/configs/h1-refusal-leaks.json | research/scripts/h1_refusal_leaks.py | 2c503aa | d7e9f3d0a54f9cce348c71fc9389b5bb150c05afeb5751588a40623be19405ed | none |
| research/results/h3-fault-set.json | research/configs/h3-fault-set.json | research/scripts/h3_fault_set.py | 00c606e | a274701dea70711537d54a556e15bf24dc9ee849b2fad4de741e97c051da199a | none |
| research/results/h3-lint-floor.json | research/configs/h3-lint-floor.json | research/scripts/h3_lint_floor.py | 00c606e | 354da5711ed36526b59051f3477bdf97bb4ff2b74fcf691982157fab9aef25a9 | none |
| research/results/h2-longmemeval-ttl.json | research/configs/h2-longmemeval-ttl.json | research/scripts/h2_longmemeval_ttl.py | 00c606e | 412941154b27162d6c55236c13ac6e609595d62c37010bb12eb842e43bde428a | none |
| research/results/h2-longmemeval-cost.json | research/configs/h2-longmemeval-cost.json | research/scripts/h2_longmemeval_cost.py | 755c29d | 529b1450b56f154202543ad7aa045eee61e2c56cce5ed7c0169b934ec91a1cb8 | none |
| research/results/h1-check-runs-cost.json | research/configs/h1-check-runs-cost.json | research/scripts/h1_check_runs_cost.py | 1347327 | fd5a250704aa3156632be4a83bf152e17e2f2f3bdc769ebde17890b215f4e41d | none |
| research/results/h1-label-audit.json | research/configs/label-audit.json | research/scripts/label_audit_draw.py | 6881e46 | 5d295d27d161e50c3f5374e7440e47e08be1c107a7b26bd2f9aca429ac36d223 | none |
| research/results/h2-label-audit-longmemeval.json | research/configs/label-audit-longmemeval.json | research/scripts/label_audit_draw.py | 6881e46 | 509268baf31ca7c2d8088f42b9c10ea5bac285a3fd3e6e720cba894390a3722e | none |
| research/results/h2-cost-table.json | research/configs/cost-table.json | research/scripts/cost_table.py | 03d5a76 | 074d4fb068460e78916c215bebcbfe0f2ac637fa65eb0ba670da9d6063fec8c1 | none |
| research/results/h2-frontier-axes.json | research/configs/frontier-axes.json | research/scripts/frontier_axes.py | 03d5a76 | 5f208b78489b78a2364edf8b2dc1a5d16a4baa8a3a4be5033b5d313debc4180f | none |
| research/results/h1-crosswalk.json | research/configs/crosswalk.json | research/scripts/crosswalk.py | 2c3503b9 | 8fad8887689f03215a3327475415bcd2cfedfc8f68aa8d184b27af96954434ac | none |
| research/results/h1-injection-screen.json | research/configs/injection-screen.json | research/scripts/injection_screen.py | 0ed347b4 | 3e35dd39db1ae69b49047678164434c8cf22b0f13c153ffca8e31da5a269b0a4 | none |
| research/results/h1-secret-guard.json | research/configs/secret-guard.json | research/scripts/secret_guard.py | 322b2ab1 | ea5b75615024cc0045a9bce7d760ce5d84f79ce2b39428a0253270377b4773d9 | none |
| research/results/h2-perf-budget.json | research/configs/perf-budget.json | research/scripts/perf_budget.py | 0cab0dad | 0ebdd59c0d61bb2126725ba713b9c9c8c929785bef78e3da4b214828f5dbc254 | none |
| research/results/h1-redteam.json | research/configs/redteam.json | research/scripts/redteam.py | fe05b8a3 | c1e73f53c9efda9de310e6bf76f8888210ad08da2311ae90d93f6088608610ae | none |
| research/results/h3-near-duplicate.json | research/configs/near-duplicate.json | research/scripts/near_duplicate.py | 8387b6a6 | f50c8f465a2479c84894d4a6fd0fcfbd55df71bcdcc7d3559515d9b46e9b8b3b | none |
| research/results/h3-lint-nli.json | research/configs/h3-lint-nli.json | research/scripts/h3_lint_nli.py | 030a7fba | 22e3c1225171941d7fac6d426942dd0d52634499a6290d709f4f8f47888763db | none |
| research/results/h3-fault-injection.json | research/configs/h3-fault-injection.json | research/scripts/h3_fault_injection.py | c209dd6c | 6bfb6faab7b74f34d5e474654aa25ec9b04fa74249cf05fc37f9b35dd85c9368 | none |
| research/results/h1-leakage.json | research/configs/leakage.json | research/scripts/leakage.py | 3018f629 | bc5c43f6e2ba848c2c0ba371d35b30ab0f7bf37ac93c0937018f578d7f1798fa | none |
| research/results/h1-quint-trace-replay.json | research/configs/quint-trace-replay.json | research/scripts/quint_trace_replay.py | 13126b4c | 07be0d26f101a9f826fe022835f7869a915c37e4e9567f0c0d7bc8bcc0176a7c | none |
| research/results/h1-gate-mutation-audit.json | research/configs/gate-mutation-audit.json | research/scripts/gate_mutation_audit.py | 50e3a293 | 842da60481d3b9b0cd630179e20ef72b3200fd64a4e7580f794c499477b50107 | none |
| research/results/h2-cedar-properties.json | research/configs/h2-cedar-properties.json | research/scripts/h2_cedar_properties.py | 4dd709e1 | 9e6d4084b0e19a6e00c7c1605e73ba808dd552fdd44dd5e67663bffff11f5d86 | none |
| research/results/h3-l9-grounding.json | research/configs/l9-grounding.json | research/scripts/l9_grounding.py | 3786ab25 | c895152f6f361ce8c9962fb25a6b02487d7bc2b4d5eaa8fc724104bc493e9ced | none |
| research/results/h1-drift-fixture.json | research/configs/drift-fixture.json | research/scripts/drift_fixture.py | 2c3503b9 | 579fa43dffc7ca6123e2b9812a6f22886c1581a70dfd59e561f20ee62e6abb71 | none |
| research/results/h5-procedure-scan.json | research/configs/procedure-scan.json | research/scripts/procedure_scan.py | b297e5b6 | 0ac5428238ea46f52fbd3d152f649f370935ebef2bee4a7ba95fb03e296cc39f | none |
| research/results/h1-audit-report.json | research/configs/audit-report.json | research/scripts/audit_report.py | aeb88f23 | d503840658800b3cd4318fe4f660df3fe49ae89c5f3bec16f07a2b4714840c5e | none |
| research/results/h1-consent-gate.json | research/configs/consent-gate.json | research/scripts/consent_gate.py | 5efb38da | 3b0a06f43051c2594424e348d503a8764b8ec31d2023e70c6e87b5896d48ec14 | none |
