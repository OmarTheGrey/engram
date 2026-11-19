---
date: 2026-11-19
author: claude-agent
type: finding
card: E9.4
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/adopt.ts
  - packages/adapters/test/plane/grants-files.test.ts
supersedes: none
---

**What.** An item the plane writes into a files-adapter folder with source `user` is re-adopted once by the next adoption of that folder: one more allowed write event, its provenance kind becoming `import`.

**Why.** Adoption compares the projected item with the store's item as the adopter would record it (`withPlaneProvenance` with source `import`), so the projected `user` provenance never matches. It predates grant changes: a probe with no grant change showed the same (one re-adoption, then none).

**Result.** Found by the first run of `packages/adapters/test/plane/grants-files.test.ts`; the test now settles that re-adoption first, and the grant survives it, since the store's copy carries it.

**Consequence.** `engram read` and the inspector's lanes adopt before every read, so each Engram-written item gains one `import` write event after it lands. A follow-up for the lead: compare provenance without its kind, or skip items whose last write the plane made.
