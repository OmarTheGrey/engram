# Results manifest

One row per results file. A results file exists only if `research/scripts/<script>` regenerates it from `<config>`; `make test-repro` reruns each script and compares the sha256. Measurement entries in `docs/log/` must cite a file listed here, and `make thesis` rejects one whose hash does not match.

| file | config | script | commit | sha256 | figure |
|---|---|---|---|---|---|
| research/results/h1-gatemem-reach.json | research/configs/h1-gatemem-reach.json | research/scripts/h1_gatemem_reach.py | fce3b10 | 9607555c3c9dcdee4917e10374c902589750ce0972a51f459c7294177792c4dd | none |
| research/results/h1-mem-inv-admission.json | research/configs/h1-mem-inv-admission.json | research/scripts/h1_mem_inv_admission.py | 4b03d1a | bed41bee4be4e3bb6bbf9f260b846626e3b57886d5672ccaa865b6443290ecab | none |
| research/results/h4-power.json | research/configs/h4-power.json | research/scripts/h4_power.py | 7883ed4 | 852a6776acf7dc3338c5b4fa5c1d65d64318c296464876c4b43b8e32e8c8bf53 | none |
| research/results/h1-c4-verdict-agreement.json | research/configs/h1-c4-verdict-agreement.json | research/scripts/h1_c4_verdict_agreement.py | ec07ea8 | 9335a67724db6405aa9a93ef90838869f597340ca0838a8945367a09305701f1 | none |
| research/results/h1-c4-walk.json | research/configs/h1-c4-walk.json | research/scripts/h1_c4_walk.py | ec07ea8 | 479f24192d83ec1a091dfc5b925073d79aefe1415d6171439ba74bb94fd6f8fa | none |
| research/results/h1-cost.json | research/configs/h1-cost.json | research/scripts/h1_cost.py | d86b2dd | 21b06c85d72c50591f20c165d487bfd60eab3c73a1a3127e57774872814d5314 | none |
