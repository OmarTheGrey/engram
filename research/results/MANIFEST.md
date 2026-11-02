# Results manifest

One row per results file. A results file exists only if `research/scripts/<script>` regenerates it from `<config>`; `make test-repro` reruns each script and compares the sha256. Measurement entries in `docs/log/` must cite a file listed here, and `make thesis` rejects one whose hash does not match.

| file | config | script | commit | sha256 | figure |
|---|---|---|---|---|---|
| research/results/h1-gatemem-reach.json | research/configs/h1-gatemem-reach.json | research/scripts/h1_gatemem_reach.py | 6e15530 | b04b4006f6f14fe4827dbca52a3a51b8477f7ec2aeda56b69b412001d05dcac0 | none |
| research/results/h1-mem-inv-admission.json | research/configs/h1-mem-inv-admission.json | research/scripts/h1_mem_inv_admission.py | 6e15530 | 6e12dde3413645939e96441da6e240c30189b62da75bea8d48a3307511ea510a | none |
| research/results/h4-power.json | research/configs/h4-power.json | research/scripts/h4_power.py | 6e15530 | 08e30bf6098eb218516b96f2f6df036aab6793317729c4aa21c2a4647349f74e | none |
