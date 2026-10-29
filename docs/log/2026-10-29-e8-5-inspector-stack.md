---
date: 2026-10-29
author: claude-agent
type: decision
card: E8.5
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/ui/package.json
  - packages/ui/vite.config.ts
  - packages/ui/tsconfig.json
  - docs/deps.md
  - docs/decisions/0027-http-contract-client-and-inspector.md
supersedes: none
---

**What.** The inspector is built with Vite 8.3.4 and React 19.3.1, without `@vitejs/plugin-react`, a router, a state library or a CSS framework, and type-checked by TypeScript 7 through its own tsconfig.

**Why.** The plan names Vite and React and leaves the rest open. Vite 8.3.4 is the version vitest already installs, so no second bundler enters the lock; Vite's built-in transform compiles TSX from the tsconfig's `jsx` setting, and fast refresh is not needed for a built page. React 19.3.1 (2026-10-14) is the newest release at least two weeks old (19.3.0 came out on 2026-09-09).

**Result.** `make ui` builds `packages/ui/dist` (one JS and one CSS file, 208 kB of JS) in under a second; `make lint` runs `tsc -p packages/ui/tsconfig.json` with the DOM library; the root tsconfig excludes `packages/ui`.

**Consequence.** A card that wants fast refresh in development adds the plugin with its deps row.
