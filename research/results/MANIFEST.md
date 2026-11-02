# Results manifest

One row per results file. A results file exists only if `research/scripts/<script>` regenerates it from `<config>`; `make test-repro` reruns each script and compares the sha256. Measurement entries in `docs/log/` must cite a file listed here, and `make thesis` rejects one whose hash does not match.

| file | config | script | commit | sha256 | figure |
|---|---|---|---|---|---|
| research/results/h1-gatemem-reach.json | research/configs/h1-gatemem-reach.json | research/scripts/h1_gatemem_reach.py | 473e132 | 9607555c3c9dcdee4917e10374c902589750ce0972a51f459c7294177792c4dd | none |
| research/results/h1-mem-inv-admission.json | research/configs/h1-mem-inv-admission.json | research/scripts/h1_mem_inv_admission.py | 6e15530 | 6e12dde3413645939e96441da6e240c30189b62da75bea8d48a3307511ea510a | none |
| research/results/h4-power.json | research/configs/h4-power.json | research/scripts/h4_power.py | 473e132 | 043c4198a61cf4dfb88c4f1597286582f1221e17ca5f95b721c74c9c931cfefb | none |
