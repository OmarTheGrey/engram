---
date: 2026-11-21
author: claude-agent
type: change
card: E9.8
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/cli/src/import/crypt.ts
  - docs/deps.md
  - packages/cli/package.json
  - "make test-one T=packages/cli/test/import-export.test.ts"
supersedes: none
---

**What.** A bundle may be encrypted with age by recipient key or passphrase, through typage (`age-encryption` 0.3.1, BSD-3-Clause, pinned exactly, published 2026-08-28), and is written ASCII armored.

**Why.** Card E9.8, step 5: a bundle holds a person's memory and may travel by mail or a shared drive.

**Result.** Three tests pass: a recipient round trip (refused, exit 2, without an identity; exit 1 with the wrong one), a passphrase round trip at typage's default scrypt work factor, and a refusal of both at once. The armored file holds no plaintext.

**Consequence.** One row in docs/deps.md; its noble and scure dependencies are MIT.
