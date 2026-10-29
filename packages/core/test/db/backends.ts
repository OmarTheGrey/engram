// The backends every Db test runs on (ADR 0024): node:sqlite always, Postgres
// when the globalSetup (global-setup.ts) provided a server. A test file runs
// its suite once per backend with `describe.each(BACKENDS)` and opens its
// databases through the backend, never through openSqlite or openPostgres.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, inject } from "vitest";
import type { Db } from "../../src/db/db.ts";
import { openPostgres } from "../../src/db/postgres.ts";
import { openSqlite } from "../../src/db/sqlite.ts";

export interface Backend {
  name: "sqlite" | "postgres";
  /** Why this backend's runs are skipped, or undefined when they run. */
  skip: string | undefined;
  /** A fresh, empty database. */
  open(): Db;
  /** Two connections to one fresh, empty database. */
  pair(): [Db, Db];
  /** A property's run count on this backend: Postgres pays a round trip per statement. */
  runs(n: number): number;
}

export const sqliteBackend: Backend = {
  name: "sqlite",
  skip: undefined,
  open: () => openSqlite(":memory:"),
  pair() {
    const path = join(mkdtempSync(join(tmpdir(), "engram-db-")), "plane.sqlite");
    return [openSqlite(path), openSqlite(path)];
  },
  runs: (n) => n,
};

/** The Postgres server's url, or undefined when the Postgres runs are skipped. */
export function postgresUrl(): string | undefined {
  const target = inject("engramPostgres");
  return target && "url" in target ? target.url : undefined;
}

let schemas = 0;

/** A schema name no other test, worker or process uses on the server. */
export function freshSchema(): string {
  return `t${process.pid}_${process.env.VITEST_POOL_ID ?? "0"}_${schemas++}`;
}

/** A Postgres Db whose log lives in `schema` (created when absent). */
export function openInSchema(url: string, schema: string): Db {
  const db = openPostgres(url);
  db.exec(`CREATE SCHEMA IF NOT EXISTS ${schema}; SET search_path TO ${schema}`);
  return db;
}

// Opening a Postgres Db starts a worker thread and a connection (about 130 ms
// here), which property tests opening a database per run cannot pay. open()
// therefore hands out a pooled connection in a new schema, and close() returns
// it to the pool; the Db the test holds refuses statements after close(), as
// any closed Db does.
const idle: Db[] = [];

function pooled(url: string): Db {
  const conn = idle.pop() ?? openPostgres(url);
  const schema = freshSchema();
  conn.exec(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  let closed = false;
  const live = () => {
    if (closed) throw new Error("this Db is closed");
    return conn;
  };
  return {
    dialect: conn.dialect,
    exec: (sql) => live().exec(sql),
    prepare(sql) {
      live().prepare(sql);
      return {
        run: (...p) =>
          live()
            .prepare(sql)
            .run(...p),
        get: (...p) =>
          live()
            .prepare(sql)
            .get(...p),
        all: (...p) =>
          live()
            .prepare(sql)
            .all(...p),
      };
    },
    transaction: (fn) => live().transaction(fn),
    close() {
      if (closed) return;
      closed = true;
      idle.push(conn);
    },
  };
}

function postgresBackend(): Backend {
  const target = inject("engramPostgres");
  const skip = target && "skip" in target ? target.skip : target ? undefined : "no globalSetup";
  const url = () => {
    const u = postgresUrl();
    if (!u) throw new Error(`Postgres runs are skipped: ${skip}`);
    return u;
  };
  return {
    name: "postgres",
    skip,
    open: () => pooled(url()),
    pair() {
      const schema = freshSchema();
      return [openInSchema(url(), schema), openInSchema(url(), schema)];
    },
    runs: (n) => Math.max(10, Math.ceil(n / 5)),
  };
}

export const BACKENDS: Backend[] = [sqliteBackend, postgresBackend()];

/** Registers `suite` once per backend, as a describe block named after it; a skipped backend's block is skipped. */
export function forEachBackend(suite: (backend: Backend) => void): void {
  for (const backend of BACKENDS) {
    describe.skipIf(backend.skip !== undefined)(backend.name, () => suite(backend));
  }
}
