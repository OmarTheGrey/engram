import { defineProject } from "vitest/config";
import { timeouts } from "../../vitest.shared.ts";

// test/db/global-setup.ts starts one embedded Postgres for the run, so the Db
// contract and the event, item and replay tests also run on Postgres (ADR 0024).
export default defineProject({ test: { ...timeouts, globalSetup: ["test/db/global-setup.ts"] } });
