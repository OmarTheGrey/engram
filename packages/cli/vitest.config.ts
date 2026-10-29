import { defineProject } from "vitest/config";
import { timeouts } from "../../vitest.shared.ts";

// Core's globalSetup starts one embedded Postgres for this project too (no
// Docker), so the CLI's Postgres targets are tested; it honours ENGRAM_PG_URL,
// ENGRAM_PG=skip and CI as in packages/core. Imported by relative path: it is
// a test helper, not part of core's public surface.
export default defineProject({
  test: { ...timeouts, globalSetup: ["../core/test/db/global-setup.ts"] },
});
