---
date: 2026-11-21
author: claude-agent
type: change
card: B7
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - packages/bench/src/merit/launch.ts
  - packages/bench/test/merit/process-env.test.ts
  - "make test-one T=packages/bench/test/merit/process-env.test.ts"
supersedes: none
---

**What.** Review finding B7-2: the MERIT process's environment (`meritProcessEnv`) sets LITELLM_MODE=PRODUCTION.

**Why.** LiteLLM 1.91.1 calls `dotenv.load_dotenv()` at import in its default DEV mode (`litellm/__init__.py`, line 26), and python-dotenv walks up to the root, so a developer's `.env` with provider keys would load. The mode has no other use outside LiteLLM's own proxy server.

**Result.** The test plants a `.env` holding a variable and an OpenAI key in the working directory, which python-dotenv searches for `-c` code: with the launcher's environment the variable is absent after `import litellm`; the control without LITELLM_MODE loads it (2 tests pass).

**Consequence.** The finding of the harness at the pin is corrected by the entry that supersedes it.
