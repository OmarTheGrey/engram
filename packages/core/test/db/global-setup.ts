// Vitest globalSetup for the core tests: one Postgres server for the whole
// run, so the Db contract and the event, item and replay tests run on Postgres
// as well as SQLite (ADR 0024). ENGRAM_PG_URL names an existing server (a
// throwaway database: tests create schemas in it) instead; ENGRAM_PG=skip
// skips the Postgres runs. When the embedded server cannot start, the
// Postgres runs skip and the reason is printed, except under CI, where the
// run fails instead, so CI cannot pass without having run Postgres.
import type { TestProject } from "vitest/node";
import { type EmbeddedPostgresServer, startEmbeddedPostgres } from "./embedded-postgres.ts";

export type PostgresTarget = { url: string } | { skip: string };

declare module "vitest" {
  export interface ProvidedContext {
    engramPostgres: PostgresTarget;
  }
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  let server: EmbeddedPostgresServer | undefined;
  let target: PostgresTarget;
  if (process.env.ENGRAM_PG_URL) {
    target = { url: process.env.ENGRAM_PG_URL };
  } else if (process.env.ENGRAM_PG === "skip") {
    target = { skip: "ENGRAM_PG=skip is set" };
  } else {
    try {
      server = await startEmbeddedPostgres();
      target = { url: server.url };
    } catch (e) {
      if (process.env.CI) throw e;
      target = { skip: String(e instanceof Error ? e.message : e) };
    }
  }
  if ("skip" in target) console.warn(`[core] Postgres runs skipped: ${target.skip}`);
  project.provide("engramPostgres", target);
  return async () => {
    await server?.stop();
  };
}
