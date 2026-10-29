// Layer 6, run by `make test-e2e` only: not a project of the root config, so
// `make test` never runs it (testing convention: layer 6 on main and nightly).
import { defineConfig } from "vitest/config";
import { timeouts } from "../../vitest.shared.ts";

export default defineConfig({
  test: {
    name: "e2e",
    include: ["test/e2e/**/*.e2e.test.ts"],
    // The steps share one log and run in order.
    sequence: { concurrent: false },
    fileParallelism: false,
    ...timeouts,
    testTimeout: 90_000,
  },
});
