// A fixture vitest project for scripts/test/vitest-exit-code.test.ts: it loads
// core's embedded-postgres global setup, as the core and cli projects do, and
// runs only *.fixture.ts, so no normal project or `make test` picks it up.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["*.fixture.ts"],
    globalSetup: ["../../../packages/core/test/db/global-setup.ts"],
  },
});
