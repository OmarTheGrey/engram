// Timeouts every test project shares. Vitest's 5 s default fails tests that
// start a process, open SQLite or load a package for the first time when the
// machine is busy (a worker alone took about 6.5 s to start on 2026-10-29), so
// a timeout there says nothing about the code. A test that hangs still fails.
export const timeouts = { testTimeout: 30_000, hookTimeout: 60_000 };
