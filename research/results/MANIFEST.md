# Results manifest

One row per results file. A results file exists only if `research/scripts/<script>` regenerates it from `<config>`; `make test-repro` reruns each script and compares the sha256. Measurement entries in `docs/log/` must cite a file listed here, and `make thesis` rejects one whose hash does not match.

| file | config | script | commit | sha256 | figure |
|---|---|---|---|---|---|
| research/results/h1-gatemem-reach.json | research/configs/h1-gatemem-reach.json | research/scripts/h1_gatemem_reach.py | d5f6323 | c5df3162bfa9ee60637fc40a5e119f1bed522c1e6657b1d79843b170c320fcc6 | none |
| research/results/h1-mem-inv-admission.json | research/configs/h1-mem-inv-admission.json | research/scripts/h1_mem_inv_admission.py | d5f6323 | 4b56b4d8eecd6c7ada2e7b9e66e518eb21b7b93b4e02d0bd4fc48e1c9bc84f87 | none |
| research/results/h4-power.json | research/configs/h4-power.json | research/scripts/h4_power.py | d5f6323 | 6b96f74f62375e1238461fcf80d9c144551225da812b488507208af8ddd70b6d | none |
