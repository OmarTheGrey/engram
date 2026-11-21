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
| research/results/h1-label-audit.json | research/configs/label-audit.json | research/scripts/label_audit_draw.py | 67ec4f7 | 92aef92a7c0a89f241b034e9823984e41a04adf4017243bbffb1304b029baad8 | none |
| research/results/h2-label-audit-longmemeval.json | research/configs/label-audit-longmemeval.json | research/scripts/label_audit_draw.py | 67ec4f7 | a62a6313a32a787e503be2ae9d3cbb741b1584e679726cffd78b8aa1f5a583d4 | none |
| research/results/h2-cost-table.json | research/configs/cost-table.json | research/scripts/cost_table.py | 79f7438 | 1d9b015f128d4f16bc3a13774e90abdc1c2beff449b75954269691a6d666f036 | none |
| research/results/h2-frontier-axes.json | research/configs/frontier-axes.json | research/scripts/frontier_axes.py | 8c4db78 | 5f208b78489b78a2364edf8b2dc1a5d16a4baa8a3a4be5033b5d313debc4180f | none |
