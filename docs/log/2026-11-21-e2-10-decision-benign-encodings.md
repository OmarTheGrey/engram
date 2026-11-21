---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.10
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/injection-screen.ts
  - packages/core/test/unit/policy/injection-screen.test.ts
  - research/results/h1-injection-screen.json
supersedes: none
---

**What.** encoded-blob's base64-run skips three recognised encodings, each judged as a whole token by an anchored pattern: an SSH public key body (`AAAA...`) after its key type, a data URI of an image, font, audio or video, and a JWT whose first two segments are JSON objects. A `0x`-prefixed hex run counts as hex, and hex-run, the one shape not made narrow, weighs 2 under default and 4 under hardened (Mnemowall's own risk for it is 0.4).

**Why.** The coordinator's decision 2 (review E2.10-3): such encodings are common in tool output. A text data URI, a key body without its type and a two-part token stay flagged; 64- and 128-character digests already passed.

**Result.** The six tool-encoding controls pass under default; hardened holds the calldata.

**Consequence.** A payload hidden in an image data URI or a JWT passes base64-run.
