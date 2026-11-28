import { fileURLToPath } from "node:url";

// Settings every test project shares; each project's config spreads this
// object into its `test` block.
//
// Timeouts. Vitest's 5 s default fails tests that start a process, open
// SQLite or load a package for the first time when the machine is busy (a
// worker alone took about 6.5 s to start on 2026-10-29), so a timeout there
// says nothing about the code. A test that hangs still fails.
//
// Setup files. The offline guard (card E0.7, scripts/test/offline-guard.ts):
// under ENGRAM_OFFLINE=1, which CI sets, any fetch, socket or DNS call from a
// test to a host other than the loopback fails at once with a clear message.
// The path is absolute, so it resolves from every project's root.
export const timeouts = {
  testTimeout: 30_000,
  hookTimeout: 60_000,
  setupFiles: [fileURLToPath(new URL("./scripts/test/offline-guard.setup.ts", import.meta.url))],
};
