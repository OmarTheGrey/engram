// Layer 6, run by `make test-e2e` only: not a project of the root config, so
// `make test` never runs it (testing convention: layer 6 on main and nightly).
// Core's globalSetup starts one embedded Postgres for the run (no Docker); it
// honours ENGRAM_PG_URL, ENGRAM_PG=skip and CI (where a Postgres that cannot
// start fails the run instead of skipping it).
import { defineConfig } from "vitest/config";
import { timeouts } from "../../vitest.shared.ts";

export default defineConfig({
  test: {
    name: "e2e",
    include: ["test/e2e/**/*.e2e.test.ts"],
    globalSetup: ["packages/core/test/db/global-setup.ts"],
    // The steps share one log per backend and run in order.
    sequence: { concurrent: false },
    fileParallelism: false,
    ...timeouts,
    testTimeout: 90_000,
  },
});
