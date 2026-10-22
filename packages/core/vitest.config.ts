// The invariants file is red by design until card E2.1 (issue #1). It is left
// out of `make test` and run on its own by `make test-invariants`, which sets
// ENGRAM_INVARIANTS=1.
import { configDefaults, defineConfig } from "vitest/config";

const INVARIANTS = "test/property/invariants.test.ts";

export default defineConfig({
  test: {
    passWithNoTests: true,
    exclude:
      process.env.ENGRAM_INVARIANTS === "1"
        ? configDefaults.exclude
        : [...configDefaults.exclude, INVARIANTS],
  },
});
