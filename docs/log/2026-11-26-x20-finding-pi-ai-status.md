---
date: 2026-11-26
author: claude-agent
type: finding
card: X20
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - node_modules/.pnpm/@earendil-works+pi-ai@1.3.0_a6b6e077596278bce81134e397cc17db/node_modules/@earendil-works/pi-ai/dist/utils/error-body.js
  - node_modules/.pnpm/@earendil-works+pi-ai@1.3.0_a6b6e077596278bce81134e397cc17db/node_modules/openai/core/streaming.js
supersedes: none
---

**What.** pi-ai carries an HTTP error's status at the start of `errorMessage` only for errors raised before streaming; an error OpenRouter sends mid-stream reaches it with no status.

**Why.** The card asks for a finding if the status is not reliably readable. The openai SDK raises a mid-stream `error` chunk as an `APIError` with an undefined status, and pi-ai's `formatProviderError` then returns its bare message, for example "Insufficient credits".

**Result.** Such an error matches neither the stopping set nor a refusal and stops the run as before (tested). Its status, when in a body pi-ai folded in as `"code"`, is still read.

**Consequence.** No mid-stream error is ever excluded; a mid-stream credit failure stops the run under its own message, not as a ProviderStopError.
