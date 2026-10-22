# MPBench release request (draft, not sent)

To: pritam.dash@huawei.com (corresponding author of arXiv 2606.04329)

Subject: Request for MPBench test cases and evaluation code (arXiv 2606.04329)

Dear Dr. Dash,

We are a student team at Egypt University of Informatics building Engram, a graduation-thesis project that places a governance layer (policy-checked writes, scope-filtered reads, logged decisions) between LLM agents and their memory stores. We read your AIWILD at ICML 2026 paper "From Untrusted Input to Trusted Memory" with great interest, because MPBench measures exactly the write-path and retrieval-path failures our gate is meant to stop.

We could not find a public release of the 3,240 attack cases, the 2,997 benign cases, the LLM-judge prompt and model, or the OpenClaw and Hermes harness, and we noticed an empty Hugging Face repository at pritamdash/mp-bench. Would you be willing to share the dataset and judge configuration, or tell us when and under what licence you plan to release them?

We would use them for non-commercial academic evaluation only, cite the paper, report results in the ASR and RSR definitions you use, and send you our numbers before publication.

Thank you for considering this request.

---

When this is sent, write the date into `packages/bench/PINS.md` ("none, contacted on YYYY-MM-DD") and add a `milestone` log entry.
