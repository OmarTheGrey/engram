// Postgres for the CLI tests and the layer 6 run (test/e2e imports this file by
// relative path). The server comes from core's globalSetup
// (packages/core/test/db/global-setup.ts, embedded Postgres, no Docker), which
// each project names in its vitest config; it honours ENGRAM_PG_URL,
// ENGRAM_PG=skip and CI. Every test gets its own database owned by its own
// role, whose password is distinctive and holds URL-reserved characters, so a test
// can assert that neither it nor its percent-encoded form ever reaches
// the output.
import { openPostgres } from "@engram/core";
import { inject } from "vitest";
import type { PostgresTarget } from "../../core/test/db/global-setup.ts";

/** The password of every role freshDatabase makes; no command may print it. */
export const PG_PASSWORD = "p@ss:/%#?&-never-printed-7Qx";
/** PG_PASSWORD as it appears in a URL. */
export const PG_PASSWORD_ENCODED = encodeURIComponent(PG_PASSWORD);

/** The server the globalSetup started, or why Postgres runs are skipped. */
export const postgresTarget = (): PostgresTarget => inject("engramPostgres");

let made = 0;

/**
 * A new, empty database on the server at `adminUrl`, owned by a new role, and
 * the URL that connects to it as that role with PG_PASSWORD.
 */
export function freshDatabase(adminUrl: string, tag: string): string {
  const name = `engram_${tag}_${process.pid}_${made++}`;
  const admin = openPostgres(adminUrl);
  try {
    admin.exec(`CREATE ROLE ${name} LOGIN PASSWORD '${PG_PASSWORD}'`);
    admin.exec(`CREATE DATABASE ${name} OWNER ${name}`);
  } finally {
    admin.close();
  }
  const url = new URL(adminUrl);
  url.username = name;
  url.password = PG_PASSWORD_ENCODED;
  url.pathname = `/${name}`;
  return url.toString();
}

/** Whether the database at `url` holds an Engram log (its migrations table). */
export function hasLogTables(url: string): boolean {
  const db = openPostgres(url);
  try {
    const row = db
      .prepare(
        "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public' AND tablename = 'schema_migrations'",
      )
      .get();
    return Number(row?.n) > 0;
  } finally {
    db.close();
  }
}
