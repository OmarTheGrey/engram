# Results manifest

One row per results file. A results file exists only if `research/scripts/<script>` regenerates it from `<config>`; `make test-repro` reruns each script and compares the sha256. Measurement entries in `docs/log/` must cite a file listed here, and `make thesis` rejects one whose hash does not match.

| file | config | script | commit | sha256 | figure |
|---|---|---|---|---|---|
| research/results/h1-gatemem-reach.json | research/configs/h1-gatemem-reach.json | research/scripts/h1_gatemem_reach.py | fce3b10 | 9607555c3c9dcdee4917e10374c902589750ce0972a51f459c7294177792c4dd | none |
| research/results/h1-mem-inv-admission.json | research/configs/h1-mem-inv-admission.json | research/scripts/h1_mem_inv_admission.py | 2c244c7 | 6e12dde3413645939e96441da6e240c30189b62da75bea8d48a3307511ea510a | none |
| research/results/h4-power.json | research/configs/h4-power.json | research/scripts/h4_power.py | 7883ed4 | 852a6776acf7dc3338c5b4fa5c1d65d64318c296464876c4b43b8e32e8c8bf53 | none |
